import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Transaction } from '../entities/transaction.entity';
import { NombaService } from '../nomba/nomba.service';

export interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant?: {
      userId?: string;
      walletId?: string;
      walletBalance?: number;
    };
    transaction?: {
      aliasAccountNumber?: string;
      transactionId?: string;
      type?: string;
      transactionAmount?: number;
      time?: string;
      responseCode?: string;
      aliasAccountReference?: string;
      aliasAccountType?: string;
    };
    customer?: {
      bankCode?: string;
      senderName?: string;
      bankName?: string;
      accountNumber?: string;
    };
  };
}

const RECONCILIATION_TOLERANCE = 0.01;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly config: ConfigService,
    private readonly nombaService: NombaService,
  ) {}

  async processNombaWebhook(
    rawBody: Buffer,
    signature: string,
    timestamp: string,
    payload: NombaWebhookPayload,
  ): Promise<void> {
    const secret = this.config.get<string>('NOMBA_WEBHOOK_SECRET') ?? '';

    if (!this.verifySignature(rawBody, signature, timestamp, secret)) {
      this.logger.warn('Invalid Nomba webhook signature, ignoring');
      return;
    }

    const transactionId = payload?.data?.transaction?.transactionId;

    const existing = await this.transactionsRepository.findOne({
      where: { nombaTransactionId: transactionId },
    });

    if (existing) {
      this.logger.log('duplicate webhook, skipping');
      return;
    }

    if (payload?.event_type !== 'payment_success') {
      this.logger.log(`Ignoring Nomba webhook event: ${payload?.event_type}`);
      return;
    }

    const txData = payload.data?.transaction;
    const customer = payload.data?.customer;

    const order = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.virtual_account_number = :aliasAccountNumber', {
        aliasAccountNumber: txData?.aliasAccountNumber ?? null,
      })
      .orWhere('order.account_ref = :aliasAccountReference', {
        aliasAccountReference: txData?.aliasAccountReference ?? null,
      })
      .getOne();

    if (!order) {
      this.logger.warn(
        `No matching order found for Nomba webhook (aliasAccountNumber=${txData?.aliasAccountNumber}, aliasAccountReference=${txData?.aliasAccountReference})`,
      );
      return;
    }

    if (order.status === 'completed' || order.status === 'expired') {
      this.logger.log(
        `Order ${order.id} is already ${order.status}, ignoring webhook`,
      );
      return;
    }

    const transaction = await this.transactionsRepository.save(
      this.transactionsRepository.create({
        nombaTransactionId: txData?.transactionId ?? '',
        amount: txData?.transactionAmount ?? 0,
        type: 'payment',
        senderName: customer?.senderName,
        senderAccountNumber: customer?.accountNumber,
        senderBankCode: customer?.bankCode,
        senderBankName: customer?.bankName,
        rawPayload: payload,
        order,
      }),
    );

    const totalPaid = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'sum')
      .where('tx.order_id = :orderId', { orderId: order.id })
      .getRawOne<{ sum: string }>();

    const amountPaid = parseFloat(totalPaid?.sum ?? '') || 0;
    const expected = parseFloat(order.amountExpected.toString());

    if (amountPaid >= expected - RECONCILIATION_TOLERANCE) {
      await this.handleExactOrOverpayment(
        order,
        amountPaid,
        expected,
        transaction,
        payload,
      );
    } else {
      await this.handleUnderpayment(order, amountPaid, expected);
    }
  }

  private async handleExactOrOverpayment(
    order: Order,
    amountPaid: number,
    expected: number,
    transaction: Transaction,
    payload: NombaWebhookPayload,
  ): Promise<void> {
    order.status = 'completed';
    order.amountPaid = amountPaid;
    await this.ordersRepository.save(order);

    if (amountPaid > expected + RECONCILIATION_TOLERANCE) {
      const excess = amountPaid - expected;
      const customer = payload.data?.customer;

      this.logger.log(
        `Overpayment detected for order ${order.id}: excess=${excess}`,
      );

      await this.nombaService.transferToBank({
        amount: excess,
        accountNumber: customer?.accountNumber ?? '',
        accountName: customer?.senderName ?? '',
        bankCode: customer?.bankCode ?? '',
        merchantTxRef: `refund-${order.id}`,
        senderName: 'QR Pay',
        narration: `Refund overpayment for order ${order.id}`,
      });

      await this.transactionsRepository.save(
        this.transactionsRepository.create({
          nombaTransactionId: `refund-${transaction.id}`,
          amount: excess,
          type: 'refund',
          senderName: customer?.senderName,
          senderAccountNumber: customer?.accountNumber,
          senderBankCode: customer?.bankCode,
          senderBankName: customer?.bankName,
          rawPayload: payload,
          order,
        }),
      );

      this.logger.log(
        `Order ${order.id} completed with overpayment refund of ${excess}`,
      );
    } else {
      this.logger.log(`Order ${order.id} completed with exact payment`);
    }
  }

  private async handleUnderpayment(
    order: Order,
    amountPaid: number,
    expected: number,
  ): Promise<void> {
    const deficit = expected - amountPaid;

    order.status = 'partial';
    order.amountPaid = amountPaid;
    await this.ordersRepository.save(order);

    this.logger.log(
      `Underpayment detected for order ${order.id}: deficit=${deficit}`,
    );
  }

  verifySignature(
    rawPayload: Buffer | string,
    signature: string,
    timestamp: string,
    secret: string,
  ): boolean {
    if (!signature || !timestamp || !secret) {
      return false;
    }

    let payload: NombaWebhookPayload;
    try {
      payload = JSON.parse(rawPayload.toString()) as NombaWebhookPayload;
    } catch {
      return false;
    }

    const eventType = payload.event_type;
    const requestId = payload.requestId;
    const userId = payload.data?.merchant?.userId;
    const walletId = payload.data?.merchant?.walletId;
    const transactionId = payload.data?.transaction?.transactionId;
    const transactionType = payload.data?.transaction?.type;
    const transactionTime = payload.data?.transaction?.time;

    let responseCode = payload.data?.transaction?.responseCode ?? '';
    if (responseCode === 'null') {
      responseCode = '';
    }

    const hashString = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${responseCode}:${timestamp}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(hashString)
      .digest('base64');

    const expected = Buffer.from(expectedSignature.toLowerCase());
    const received = Buffer.from(signature.toLowerCase());

    if (expected.length !== received.length) {
      return false;
    }

    return crypto.timingSafeEqual(expected, received);
  }
}

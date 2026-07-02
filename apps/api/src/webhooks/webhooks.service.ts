import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Transaction } from '../entities/transaction.entity';

export interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant?: {
      userId?: string;
      walletId?: string;
    };
    transaction?: {
      transactionId?: string;
      type?: string;
      time?: string;
      responseCode?: string;
    };
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    private readonly config: ConfigService,
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

    // TODO: apply the payment to the matching order/transaction records.
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

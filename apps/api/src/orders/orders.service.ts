import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../entities/order.entity';
import { NombaService } from '../nomba/nomba.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly nombaService: NombaService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const id = uuidv4();

    const virtualAccount = await this.nombaService.provisionVirtualAccount(
      id,
      'QR Pay',
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = this.ordersRepository.create({
      id,
      merchantRef: dto.merchantRef,
      amountExpected: dto.amountExpected,
      amountPaid: 0,
      status: 'pending',
      virtualAccountNumber: virtualAccount.bankAccountNumber,
      virtualAccountName: virtualAccount.bankAccountName,
      bankName: virtualAccount.bankName,
      accountRef: id,
      expiresAt,
    });

    return this.ordersRepository.save(order);
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { transactions: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'pending' && new Date() > new Date(order.expiresAt)) {
      order.status = 'expired';
      return this.ordersRepository.save(order);
    }

    return order;
  }

  async getOrderSummary(id: string) {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { transactions: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      merchantRef: order.merchantRef,
      amountExpected: Number(order.amountExpected),
      amountPaid: Number(order.amountPaid),
      status: order.status,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      virtualAccount: {
        accountNumber: order.virtualAccountNumber,
        accountName: order.virtualAccountName,
        bankName: order.bankName,
      },
      timeline: order.transactions
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: Number(tx.amount),
          sender: tx.senderName
            ? `${tx.senderName} — ${tx.senderBankName}`
            : null,
          createdAt: tx.createdAt,
        })),
    };
  }
}

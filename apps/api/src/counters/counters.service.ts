import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter } from '../entities/counter.entity';
import { Order } from '../entities/order.entity';
import { NombaService } from '../nomba/nomba.service';
import { CreateCounterDto } from './dto/create-counter.dto';

@Injectable()
export class CountersService {
  constructor(
    @InjectRepository(Counter)
    private readonly countersRepository: Repository<Counter>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly nombaService: NombaService,
  ) {}

  async createCounter(dto: CreateCounterDto): Promise<Counter> {
    const counter = this.countersRepository.create({
      counterName: dto.counterName,
      merchantLabel: dto.merchantLabel,
    });

    return this.countersRepository.save(counter);
  }

  async getCounterQR(counterId: string) {
    const counter = await this.countersRepository.findOne({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    return {
      counterId: counter.id,
      counterName: counter.counterName,
      qrData: counter.id,
    };
  }

  async createSessionForCounter(
    counterId: string,
    amountExpected: number,
  ): Promise<Order> {
    const counter = await this.countersRepository.findOne({
      where: { id: counterId },
    });

    if (!counter) {
      throw new NotFoundException('Counter not found');
    }

    let paymentCode: string;
    let collision: Order | null;

    do {
      paymentCode = Math.floor(1000 + Math.random() * 9000).toString();
      collision = await this.ordersRepository.findOne({
        where: { counterId: counter.id, paymentCode, status: 'pending' },
      });
    } while (collision);

    const id = crypto.randomUUID();

    const virtualAccount = await this.nombaService.provisionVirtualAccount(
      id,
      counter.counterName,
    );

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = this.ordersRepository.create({
      id,
      merchantRef: id,
      amountExpected,
      amountPaid: 0,
      status: 'pending',
      counterId: counter.id,
      paymentCode,
      virtualAccountNumber: virtualAccount.bankAccountNumber,
      virtualAccountName: virtualAccount.bankAccountName,
      bankName: virtualAccount.bankName,
      accountRef: id,
      expiresAt,
    });

    return this.ordersRepository.save(order);
  }

  async resolvePaymentCode(counterId: string, code: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { counterId, paymentCode: code, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (!order) {
      throw new NotFoundException('Invalid or expired payment code');
    }

    return order;
  }
}

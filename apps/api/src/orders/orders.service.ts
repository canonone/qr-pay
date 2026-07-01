import { Injectable } from '@nestjs/common';
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
      virtualAccountNumber: virtualAccount.accountNumber,
      virtualAccountName: virtualAccount.accountName,
      bankName: virtualAccount.bankName,
      accountRef: id,
      expiresAt,
    });

    return this.ordersRepository.save(order);
  }
}

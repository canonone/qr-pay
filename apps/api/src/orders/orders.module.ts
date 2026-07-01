import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';
import { NombaModule } from '../nomba/nomba.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), NombaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

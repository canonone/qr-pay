import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counter } from '../entities/counter.entity';
import { Order } from '../entities/order.entity';
import { NombaModule } from '../nomba/nomba.module';
import { CountersController } from './counters.controller';
import { CountersService } from './counters.service';

@Module({
  imports: [TypeOrmModule.forFeature([Counter, Order]), NombaModule],
  controllers: [CountersController],
  providers: [CountersService],
})
export class CountersModule {}

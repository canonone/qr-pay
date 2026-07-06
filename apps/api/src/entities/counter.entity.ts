import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('counters')
export class Counter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'counter_name' })
  counterName: string;

  @Column({ name: 'merchant_label', nullable: true })
  merchantLabel: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Order, (order) => order.counter)
  orders: Order[];
}

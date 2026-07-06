import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { Counter } from './counter.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_ref', unique: true })
  merchantRef: string;

  @Column({ name: 'amount_expected', type: 'decimal', precision: 12, scale: 2 })
  amountExpected: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ default: 'pending' })
  status: string; // pending | partial | completed | expired

  @Column({ name: 'virtual_account_number', nullable: true })
  virtualAccountNumber: string;

  @Column({ name: 'virtual_account_name', nullable: true })
  virtualAccountName: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'account_ref' })
  accountRef: string;

  @Column({ name: 'payment_code', nullable: true })
  paymentCode: string;

  @Column({ name: 'counter_id', nullable: true })
  counterId: string;

  @ManyToOne(() => Counter, { nullable: true })
  @JoinColumn({ name: 'counter_id' })
  counter: Counter;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Transaction, (tx) => tx.order)
  transactions: Transaction[];
}

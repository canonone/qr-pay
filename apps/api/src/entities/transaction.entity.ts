import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'nomba_transaction_id', unique: true })
  nombaTransactionId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'payment' })
  type: string; // payment | topup_payment | refund

  @Column({ name: 'sender_name', nullable: true })
  senderName: string;

  @Column({ name: 'sender_account_number', nullable: true })
  senderAccountNumber: string;

  @Column({ name: 'sender_bank_code', nullable: true })
  senderBankCode: string;

  @Column({ name: 'sender_bank_name', nullable: true })
  senderBankName: string;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Order, (order) => order.transactions)
  @JoinColumn({ name: 'order_id' })
  order: Order;
}

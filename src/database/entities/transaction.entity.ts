import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';

export enum TransactionType {
  VIEW_EARNING = 'VIEW_EARNING',
  CONSULTANT_PAYMENT = 'CONSULTANT_PAYMENT',
  SALESMAN_COMMISSION = 'SALESMAN_COMMISSION',
  MONTHLY_PAYOUT = 'MONTHLY_PAYOUT',
  DIRECT_PAYMENT = 'DIRECT_PAYMENT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  WALLET = 'WALLET',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  promoterId: string;

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'estimated_payment_date',
    type: 'timestamptz',
    nullable: true,
  })
  estimatedPaymentDate?: Date;

  @Column({
    name: 'stripe_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeTransactionId?: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'user_id' })
  promoter: UserEntity;

  @ManyToOne(() => CampaignEntity, { eager: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: CampaignEntity;
}

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
import { PaymentRecord } from './payment-record.entity';
import { UserType } from '../../enums/user-type';

// Transformer to handle PostgreSQL DECIMAL to JavaScript number conversion
const DecimalTransformer = {
  to: (value: number): number => Number(value) || 0,
  from: (value: string): number => {
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  },
};

export enum TransactionType {
  WALLET_DEPOSIT = 'WALLET_DEPOSIT',
  CAMPAIGN_FUNDING = 'CAMPAIGN_FUNDING',
  WITHDRAWAL = 'WITHDRAWAL',
  VIEW_EARNING = 'VIEW_EARNING',
  SALESMAN_COMMISSION = 'SALESMAN_COMMISSION',
  MONTHLY_PAYOUT = 'MONTHLY_PAYOUT',
  DIRECT_PAYMENT = 'DIRECT_PAYMENT',
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
  userId: string;

  @Column({ name: 'user_type', type: 'enum', enum: UserType })
  userType: UserType;

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  amount: number;

  @Column({ name: 'gross_amount_cents', type: 'integer', nullable: true })
  grossAmountCents?: number;

  @Column({ name: 'platform_fee_cents', type: 'integer', default: 0 })
  platformFeeCents: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod?: PaymentMethod;

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

  @Column({ name: 'payment_record_id', type: 'uuid', nullable: true })
  paymentRecordId?: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => CampaignEntity, { eager: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: CampaignEntity;

  @ManyToOne(() => PaymentRecord, { eager: false })
  @JoinColumn({ name: 'payment_record_id' })
  paymentRecord?: PaymentRecord;
}

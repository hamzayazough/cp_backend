import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';

export enum PaymentTransactionType {
  CHARGE = 'CHARGE',
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
}

export enum PaymentTransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PaymentTransactionType,
  })
  type: PaymentTransactionType;

  @Column({
    type: 'enum',
    enum: PaymentTransactionStatus,
    default: PaymentTransactionStatus.PENDING,
  })
  status: PaymentTransactionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'related_campaign_id', type: 'uuid', nullable: true })
  relatedCampaignId: string;

  @Column({
    name: 'stripe_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeTransactionId: string;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { nullable: true })
  @JoinColumn({ name: 'related_campaign_id' })
  relatedCampaign: CampaignEntity;
}

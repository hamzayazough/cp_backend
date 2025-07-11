import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum UserType {
  PROMOTER = 'PROMOTER',
  ADVERTISER = 'ADVERTISER',
}

@Entity('billing_period_summaries')
@Unique(['userId', 'periodStart', 'periodEnd'])
export class BillingPeriodSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: UserType,
  })
  userType: UserType;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  // Financial summary
  @Column({ name: 'total_transactions', type: 'integer', default: 0 })
  totalTransactions: number;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalAmount: number;

  @Column({
    name: 'total_fees',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  totalFees: number;

  @Column({
    name: 'net_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  netAmount: number;

  // Promoter-specific fields
  @Column({ name: 'total_views', type: 'integer', default: 0 })
  totalViews: number;

  @Column({ name: 'total_campaigns', type: 'integer', default: 0 })
  totalCampaigns: number;

  @Column({
    name: 'average_cpv',
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0,
  })
  averageCpv: number;

  @Column({
    name: 'total_earned',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalEarned: number;

  @Column({
    name: 'total_paid_out',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalPaidOut: number;

  @Column({
    name: 'pending_payouts',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  pendingPayouts: number;

  @Column({
    name: 'below_threshold_earnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  belowThresholdEarnings: number;

  // Advertiser-specific fields
  @Column({
    name: 'total_spend',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalSpend: number;

  @Column({
    name: 'total_refunds',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  totalRefunds: number;

  @Column({ name: 'campaigns_funded', type: 'integer', default: 0 })
  campaignsFunded: number;

  @Column({
    name: 'remaining_credits',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  remainingCredits: number;

  // Campaign type breakdown
  @Column({
    name: 'visibility_earnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  visibilityEarnings: number;

  @Column({
    name: 'consultant_earnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  consultantEarnings: number;

  @Column({
    name: 'seller_earnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  sellerEarnings: number;

  @Column({
    name: 'salesman_earnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  salesmanEarnings: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

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

@Entity('financial_analytics')
export class FinancialAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Revenue metrics
  @Column({
    name: 'gross_revenue',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  grossRevenue: number;

  @Column({
    name: 'net_revenue',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  netRevenue: number;

  @Column({
    name: 'platform_fees',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  platformFees: number;

  @Column({
    name: 'payment_processing_fees',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  paymentProcessingFees: number;

  // Growth metrics
  @Column({
    name: 'revenue_growth_rate',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0.0,
  })
  revenueGrowthRate: number;

  @Column({
    name: 'user_acquisition_cost',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0.0,
  })
  userAcquisitionCost: number;

  @Column({
    name: 'lifetime_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  lifetimeValue: number;

  // Efficiency metrics
  @Column({
    name: 'conversion_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.0,
  })
  conversionRate: number;

  @Column({
    name: 'average_transaction_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  averageTransactionValue: number;

  @Column({
    name: 'churn_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.0,
  })
  churnRate: number;

  // Period
  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

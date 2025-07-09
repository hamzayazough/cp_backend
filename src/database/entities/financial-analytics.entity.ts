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

  @Column({ name: 'user_type', type: 'enum', enum: ['PROMOTER', 'ADVERTISER'] })
  userType: string;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  // Overview metrics
  @Column({ name: 'total_transactions', type: 'integer', default: 0 })
  totalTransactions: number;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({
    name: 'average_transaction_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageTransactionAmount: number;

  @Column({
    name: 'largest_transaction',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  largestTransaction: number;

  // Trends
  @Column({
    name: 'monthly_growth',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  monthlyGrowth: number;

  @Column({
    name: 'quarterly_growth',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  quarterlyGrowth: number;

  @Column({
    name: 'yearly_growth',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  yearlyGrowth: number;

  // Breakdown by campaign type
  @Column({
    name: 'visibility_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  visibilityAmount: number;

  @Column({
    name: 'consultant_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  consultantAmount: number;

  @Column({
    name: 'seller_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  sellerAmount: number;

  @Column({
    name: 'salesman_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  salesmanAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

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

@Entity('promoter_performance_metrics')
export class PromoterPerformanceMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  // Campaign metrics
  @Column({ name: 'total_campaigns', type: 'integer', default: 0 })
  totalCampaigns: number;

  @Column({ name: 'completed_campaigns', type: 'integer', default: 0 })
  completedCampaigns: number;

  @Column({ name: 'active_campaigns', type: 'integer', default: 0 })
  activeCampaigns: number;

  @Column({
    name: 'completion_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  completionRate: number;

  // Performance metrics
  @Column({ name: 'total_views_generated', type: 'bigint', default: 0 })
  totalViewsGenerated: number;

  @Column({ name: 'total_sales_generated', type: 'integer', default: 0 })
  totalSalesGenerated: number;

  @Column({
    name: 'average_campaign_duration',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageCampaignDuration: number;

  @Column({
    name: 'on_time_delivery_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  onTimeDeliveryRate: number;

  // Earnings metrics
  @Column({
    name: 'total_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalEarnings: number;

  @Column({
    name: 'average_earnings_per_campaign',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageEarningsPerCampaign: number;

  @Column({
    name: 'visibility_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  visibilityEarnings: number;

  @Column({
    name: 'consultant_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  consultantEarnings: number;

  @Column({
    name: 'seller_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  sellerEarnings: number;

  @Column({
    name: 'salesman_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  salesmanEarnings: number;

  // Quality metrics
  @Column({
    name: 'average_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  averageRating: number;

  @Column({ name: 'total_reviews', type: 'integer', default: 0 })
  totalReviews: number;

  @Column({
    name: 'response_time_hours',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  responseTimeHours: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

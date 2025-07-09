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

@Entity('advertiser_analytics')
export class AdvertiserAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_id', type: 'uuid' })
  advertiserId: string;

  @Column({ name: 'advertiser_name', type: 'varchar', length: 255 })
  advertiserName: string;

  // Campaign creation and management
  @Column({ name: 'total_campaigns', type: 'integer', default: 0 })
  totalCampaigns: number;

  @Column({ name: 'active_campaigns', type: 'integer', default: 0 })
  activeCampaigns: number;

  @Column({ name: 'completed_campaigns', type: 'integer', default: 0 })
  completedCampaigns: number;

  @Column({ name: 'cancelled_campaigns', type: 'integer', default: 0 })
  cancelledCampaigns: number;

  @Column({
    name: 'success_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  successRate: number;

  @Column({
    name: 'average_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageBudget: number;

  @Column({
    name: 'total_spent',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalSpent: number;

  // Performance metrics
  @Column({
    name: 'average_campaign_duration',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  averageCampaignDuration: number;

  @Column({
    name: 'average_time_to_find_promoter',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  averageTimeToFindPromoter: number;

  @Column({
    name: 'promoter_retention_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  promoterRetentionRate: number;

  @Column({
    name: 'average_promoter_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  averagePromoterRating: number;

  @Column({
    name: 'dispute_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  disputeRate: number;

  // ROI and effectiveness
  @Column({ name: 'total_views', type: 'bigint', nullable: true })
  totalViews: number;

  @Column({ name: 'total_sales', type: 'integer', nullable: true })
  totalSales: number;

  @Column({
    name: 'average_roi',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  averageRoi: number;

  @Column({
    name: 'cost_efficiency',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  costEfficiency: number;

  @Column({ name: 'brand_reach', type: 'bigint', nullable: true })
  brandReach: number;

  // Spending patterns
  @Column({
    name: 'spend_visibility',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  spendVisibility: number;

  @Column({
    name: 'spend_consultant',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  spendConsultant: number;

  @Column({
    name: 'spend_seller',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  spendSeller: number;

  @Column({
    name: 'spend_salesman',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  spendSalesman: number;

  @Column({
    name: 'average_monthly_spend',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  averageMonthlySpend: number;

  @Column({
    name: 'spending_trend',
    type: 'enum',
    enum: ['INCREASING', 'DECREASING', 'STABLE'],
    default: 'STABLE',
  })
  spendingTrend: string;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;
}

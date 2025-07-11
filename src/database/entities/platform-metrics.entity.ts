import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_metrics')
export class PlatformMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // User metrics
  @Column({ name: 'total_users', type: 'integer', default: 0 })
  totalUsers: number;

  @Column({ name: 'active_users', type: 'integer', default: 0 })
  activeUsers: number;

  @Column({ name: 'new_signups', type: 'integer', default: 0 })
  newSignups: number;

  @Column({
    name: 'churn_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  churnRate: number;

  @Column({
    name: 'promoter_to_advertiser_ratio',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  promoterToAdvertiserRatio: number;

  // Campaign metrics
  @Column({ name: 'total_campaigns', type: 'integer', default: 0 })
  totalCampaigns: number;

  @Column({ name: 'active_campaigns', type: 'integer', default: 0 })
  activeCampaigns: number;

  @Column({ name: 'completed_campaigns', type: 'integer', default: 0 })
  completedCampaigns: number;

  @Column({
    name: 'success_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  successRate: number;

  @Column({
    name: 'average_campaign_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageCampaignValue: number;

  @Column({ name: 'campaigns_visibility', type: 'integer', default: 0 })
  campaignsVisibility: number;

  @Column({ name: 'campaigns_consultant', type: 'integer', default: 0 })
  campaignsConsultant: number;

  @Column({ name: 'campaigns_seller', type: 'integer', default: 0 })
  campaignsSeller: number;

  @Column({ name: 'campaigns_salesman', type: 'integer', default: 0 })
  campaignsSalesman: number;

  // Financial metrics
  @Column({
    name: 'gross_marketplace_volume',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  grossMarketplaceVolume: number;

  @Column({
    name: 'total_revenue',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalRevenue: number;

  @Column({
    name: 'average_transaction_value',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageTransactionValue: number;

  @Column({
    name: 'total_payouts',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalPayouts: number;

  @Column({
    name: 'pending_payouts',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  pendingPayouts: number;

  @Column({
    name: 'revenue_growth_rate',
    type: 'decimal',
    precision: 8,
    scale: 4,
    default: 0,
  })
  revenueGrowthRate: number;

  // Engagement metrics
  @Column({
    name: 'average_session_duration',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageSessionDuration: number;

  @Column({
    name: 'average_campaigns_per_user',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 0,
  })
  averageCampaignsPerUser: number;

  @Column({
    name: 'repeat_usage_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  repeatUsageRate: number;

  @Column({ name: 'messages_sent', type: 'bigint', default: 0 })
  messagesSent: number;

  @Column({
    name: 'average_response_time',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageResponseTime: number;

  // Quality metrics
  @Column({
    name: 'average_user_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  averageUserRating: number;

  @Column({
    name: 'dispute_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  disputeRate: number;

  @Column({
    name: 'refund_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  refundRate: number;

  @Column({
    name: 'customer_satisfaction_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  customerSatisfactionScore: number;

  @Column({
    name: 'platform_trust_score',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  platformTrustScore: number;

  // Period information
  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

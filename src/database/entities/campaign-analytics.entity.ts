import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';

@Entity('campaign_analytics')
export class CampaignAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  // Performance metrics
  @Column({ name: 'views_generated', type: 'integer', default: 0 })
  viewsGenerated: number;

  @Column({
    name: 'click_through_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  clickThroughRate: number;

  @Column({
    name: 'conversion_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  conversionRate: number;

  @Column({ name: 'sales_generated', type: 'integer', default: 0 })
  salesGenerated: number;

  @Column({
    name: 'deliverable_completion',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  deliverableCompletion: number;

  @Column({
    name: 'promoter_satisfaction_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  promoterSatisfactionRating: number;

  @Column({
    name: 'advertiser_satisfaction_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  advertiserSatisfactionRating: number;

  // Financial metrics
  @Column({
    name: 'budget_allocated',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetAllocated: number;

  @Column({
    name: 'budget_spent',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetSpent: number;

  @Column({
    name: 'budget_remaining',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetRemaining: number;

  @Column({
    name: 'cost_per_result',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  costPerResult: number;

  @Column({ name: 'roi', type: 'decimal', precision: 10, scale: 4, default: 0 })
  roi: number;

  @Column({
    name: 'total_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalEarnings: number;

  // Timeline metrics
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'duration_days', type: 'integer', nullable: true })
  durationDays: number;

  @Column({ name: 'days_to_completion', type: 'integer', nullable: true })
  daysToCompletion: number;

  @Column({ name: 'deadline_met', type: 'boolean', default: false })
  deadlineMet: boolean;

  // Participation metrics
  @Column({ name: 'applications_received', type: 'integer', default: 0 })
  applicationsReceived: number;

  @Column({ name: 'promoters_participating', type: 'integer', default: 0 })
  promotersParticipating: number;

  @Column({
    name: 'promoter_engagement',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  promoterEngagement: number;

  @Column({
    name: 'average_time_to_join',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  averageTimeToJoin: number;

  @CreateDateColumn({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Campaign, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;
}

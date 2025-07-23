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

@Entity('campaign_payment_configs')
export class CampaignPaymentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid', unique: true })
  campaignId: string;

  @Column({
    name: 'payment_flow_type',
    type: 'varchar',
    length: 50,
    default: 'destination',
  })
  paymentFlowType: string; // 'destination', 'direct', 'hold_and_transfer'

  @Column({
    name: 'platform_fee_type',
    type: 'varchar',
    length: 50,
    default: 'percentage',
  })
  platformFeeType: string; // 'percentage', 'fixed', 'none'

  @Column({
    name: 'platform_fee_value',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  platformFeeValue: number; // e.g., 5.0 for 5%, or 2.50 for $2.50 fixed

  @Column({
    name: 'requires_goal_completion',
    type: 'boolean',
    default: false,
  })
  requiresGoalCompletion: boolean;

  @Column({ name: 'auto_release_funds', type: 'boolean', default: true })
  autoReleaseFunds: boolean;

  @Column({ name: 'hold_period_days', type: 'integer', default: 0 })
  holdPeriodDays: number;

  @Column({ name: 'supports_revenue_split', type: 'boolean', default: false })
  supportsRevenueplit: boolean;

  @Column({ name: 'split_configuration', type: 'jsonb', nullable: true })
  splitConfiguration: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;
}

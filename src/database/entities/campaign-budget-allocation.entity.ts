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
import { CampaignType } from '../../enums/campaign-type';

@Entity('campaign_budget_allocations')
export class CampaignBudgetAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({
    name: 'campaign_type',
    type: 'enum',
    enum: CampaignType,
  })
  campaignType: CampaignType;

  @Column({ name: 'total_budget', type: 'decimal', precision: 10, scale: 2 })
  totalBudget: number;

  @Column({
    name: 'platform_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  platformFee: number;

  @Column({
    name: 'stripe_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  stripeFee: number;

  @Column({
    name: 'promoter_payout',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  promoterPayout: number;

  @Column({
    name: 'budget_reserved',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetReserved: number;

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
    name: 'expected_promoter_share',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.8,
  })
  expectedPromoterShare: number;

  @Column({
    name: 'actual_promoter_share',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  actualPromoterShare: number;

  @Column({ name: 'is_funded', type: 'boolean', default: false })
  isFunded: boolean;

  @Column({ name: 'funded_at', type: 'timestamptz', nullable: true })
  fundedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;
}

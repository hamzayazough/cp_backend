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
import { CampaignEntity } from './campaign.entity';
import { BudgetAllocationStatus } from '../../enums/budget-allocation-status';

@Entity('campaign_budget_tracking')
@Unique(['campaignId']) // One budget record per campaign
export class CampaignBudgetTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'advertiser_id', type: 'uuid' })
  advertiserId: string;

  // Budget allocation from advertiser wallet
  @Column({ name: 'allocated_budget_cents', type: 'integer' })
  allocatedBudgetCents: number;

  @Column({ name: 'spent_budget_cents', type: 'integer', default: 0 })
  spentBudgetCents: number;

  @Column({
    name: 'platform_fees_collected_cents',
    type: 'integer',
    default: 0,
  })
  platformFeesCollectedCents: number;

  // Campaign-specific rates
  @Column({ name: 'cpv_cents', type: 'integer', nullable: true })
  cpvCents: number | null; // Cost per 100 views (for visibility campaigns) in cents

  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  commissionRate: number | null; // Commission rate percentage (for salesman campaigns)

  // Status and tracking
  @Column({
    name: 'status',
    type: 'enum',
    enum: BudgetAllocationStatus,
    default: BudgetAllocationStatus.ACTIVE,
  })
  status: BudgetAllocationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;
}

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
import { CampaignEntity } from './campaign.entity';
import { UserEntity } from './user.entity';
import { CampaignType } from '../../enums/campaign-type';
import { BudgetAllocationStatus } from '../../enums/budget-allocation-status';

@Entity('campaign_budget_allocations')
@Unique(['campaignId', 'promoterId'])
export class CampaignBudgetAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'promoter_id', type: 'uuid', nullable: true })
  promoterId: string | null; // NULL for visibility campaigns until promoter joins

  @Column({
    name: 'campaign_type',
    type: 'enum',
    enum: CampaignType,
  })
  campaignType: CampaignType;

  // Core budget fields (campaign-level)
  @Column({ name: 'total_budget', type: 'decimal', precision: 12, scale: 2 })
  totalBudget: number;

  @Column({
    name: 'min_budget',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  minBudget: number | null; // Only for Consultant/Seller campaigns

  @Column({
    name: 'allocated_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  allocatedAmount: number;

  @Column({
    name: 'spent_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  spentAmount: number;

  @Column({
    name: 'remaining_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  remainingAmount: number;

  // Visibility campaign rate (other details tracked in wallets/sales_records)
  @Column({
    name: 'rate_per_100_views',
    type: 'decimal',
    precision: 6,
    scale: 4,
    nullable: true,
  })
  ratePer100Views: number | null;

  // Salesman campaign rate (actual sales tracked in sales_records)
  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  commissionRate: number | null;

  // Stripe funding tracking
  @Column({
    name: 'stripe_payment_intent_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripePaymentIntentId: string | null;

  @Column({ name: 'is_funded', type: 'boolean', default: false })
  isFunded: boolean;

  @Column({ name: 'funded_at', type: 'timestamptz', nullable: true })
  fundedAt: Date | null;

  // Status and tracking
  @Column({
    name: 'status',
    type: 'enum',
    enum: BudgetAllocationStatus,
    default: BudgetAllocationStatus.ACTIVE,
  })
  status: BudgetAllocationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity | null;
}

/*
Simplified Campaign Budget Allocation Design:

This table now focuses on its core responsibility: tracking campaign budget allocations.
The complex payout logic has been moved to dedicated financial tables:

- Promoter earnings and thresholds → wallets table
- Salesman commission tracking → sales_records table  
- Payout processing → payout_records table
- Stripe integration → stripe_connect_accounts table

This design:
✅ Follows single responsibility principle
✅ Reduces complexity and query confusion
✅ Leverages existing financial infrastructure
✅ Makes the system more maintainable and scalable

Each campaign type uses this table differently:
- VISIBILITY: total_budget + rate_per_100_views (earnings tracked in wallets)
- CONSULTANT/SELLER: total_budget + min_budget (direct payments via payout_records)
- SALESMAN: total_budget + commission_rate (sales tracked in sales_records)
*/

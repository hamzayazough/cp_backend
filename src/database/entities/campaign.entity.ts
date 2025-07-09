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
import { CampaignType } from '../../enums/campaign-type';
import { CampaignStatus } from '../../enums/campaign-status';
import { MeetingPlan } from '../../enums/meeting-plan';
import { SalesTrackingMethod } from '../../enums/sales-tracking-method';
import { Deliverable } from '../../enums/deliverable';
import { SocialPlatform } from '../../enums/social-platform';
import { AdvertiserType } from 'src/enums/advertiser-type';

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_id' })
  advertiserId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: CampaignType,
  })
  type: CampaignType;

  @Column({
    name: 'is_public',
    type: 'boolean',
    default: false,
  })
  isPublic: boolean;

  @Column({
    name: 'expiry_date',
    type: 'timestamptz',
    nullable: true,
  })
  expiryDate?: Date;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl?: string;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.ACTIVE,
  })
  status: CampaignStatus;

  @Column({
    name: 'advertiser_types',
    type: 'enum',
    enum: AdvertiserType,
    array: true,
    default: [],
  })
  advertiserTypes?: AdvertiserType[];

  @Column({
    name: 'max_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  maxBudget: number;

  @Column({
    name: 'min_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  minBudget: number;

  @Column({
    name: 'spent_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  spentBudget: number;

  // Campaign-specific fields for VISIBILITY campaigns
  @Column({ name: 'max_views', type: 'integer', nullable: true })
  maxViews?: number;

  @Column({
    name: 'cpv',
    type: 'decimal',
    precision: 6,
    scale: 4,
    nullable: true,
  })
  cpv?: number;

  // Campaign-specific fields for CONSULTANT campaigns
  @Column({
    name: 'hourly_rate',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  hourlyRate?: number;

  @Column({ name: 'total_hours', type: 'integer', nullable: true })
  totalHours?: number;

  @Column({
    name: 'meeting_plan',
    type: 'enum',
    enum: MeetingPlan,
    nullable: true,
  })
  meetingPlan?: MeetingPlan;

  @Column({ name: 'meeting_count', type: 'integer', nullable: true })
  meetingCount?: number;

  @Column({ name: 'expertise_required', type: 'text', nullable: true })
  expertiseRequired?: string;

  // Campaign-specific fields for SELLER campaigns
  @Column({
    type: 'enum',
    enum: Deliverable,
    array: true,
    nullable: true,
  })
  deliverables?: Deliverable[];

  @Column({
    name: 'seller_requirements',
    type: 'enum',
    enum: Deliverable,
    array: true,
    nullable: true,
  })
  sellerRequirements?: Deliverable[];

  @Column({ type: 'date', nullable: true })
  deadline?: Date;

  @Column({
    name: 'deadline_strict',
    type: 'boolean',
  })
  deadlineStrict: boolean;

  @Column({
    name: 'fixed_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  fixedPrice?: number;

  // Campaign-specific fields for SALESMAN campaigns
  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  CommissionPerSale?: number;

  @Column({
    name: 'sales_tracking_method',
    type: 'enum',
    enum: SalesTrackingMethod,
    nullable: true,
  })
  trackSalesVia?: SalesTrackingMethod;

  @Column({ name: 'code_prefix', type: 'varchar', length: 50, nullable: true })
  codePrefix?: string;

  @Column({ name: 'ref_link', type: 'text', nullable: true })
  refLink?: string;

  // Common fields
  @Column({ type: 'text', nullable: true })
  requirements?: string;

  @Column({ name: 'target_audience', type: 'text', nullable: true })
  targetAudience?: string;

  @Column({
    name: 'preferred_platforms',
    type: 'enum',
    enum: SocialPlatform,
    array: true,
    nullable: true,
  })
  preferredPlatforms?: SocialPlatform[];

  @Column({ name: 'min_followers', type: 'integer', default: 0 })
  minFollowers: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt?: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date;

  @Column({ name: 'selected_promoter_id', type: 'uuid', nullable: true })
  selectedPromoterId?: string;

  @Column({ name: 'discord_invite_link', type: 'text', nullable: true })
  discordInviteLink?: string;

  @Column({
    name: 'budget_held',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  budgetHeld: number;

  @Column({
    name: 'final_payout_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  finalPayoutAmount?: number;

  @Column({ name: 'payout_executed', type: 'boolean', default: false })
  payoutExecuted: boolean;

  @Column({ name: 'payout_date', type: 'timestamptz', nullable: true })
  payoutDate?: Date;

  @Column({
    name: 'stripe_charge_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeChargeId?: string;

  @Column({
    name: 'stripe_transfer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeTransferId?: string;

  @Column({ name: 'promoter_links', type: 'text', array: true, nullable: true })
  PromoterLinks?: string[];
  // Relations

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'selected_promoter_id' })
  selectedPromoter?: UserEntity;
}

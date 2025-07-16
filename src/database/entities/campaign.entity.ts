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
    name: 'budget_allocated',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  budgetAllocated: number;

  @Column({
    name: 'max_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxBudget?: number; // Required for CONSULTANT and SELLER campaigns

  @Column({
    name: 'min_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  minBudget?: number; // Required for CONSULTANT and SELLER campaigns

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
  cpv?: number; // Required for VISIBILITY campaigns

  @Column({ name: 'tracking_link', type: 'text', nullable: true })
  trackingLink?: string; // Required for VISIBILITY campaigns

  @Column({ name: 'current_views', type: 'integer', nullable: true })
  currentViews?: number;

  // Campaign-specific fields for CONSULTANT campaigns

  @Column({
    name: 'meeting_plan',
    type: 'enum',
    enum: MeetingPlan,
    nullable: true,
  })
  meetingPlan?: MeetingPlan;

  @Column({ name: 'meeting_count', type: 'integer', nullable: true })
  meetingCount?: number;

  @Column({ name: 'need_meeting', type: 'boolean', nullable: true })
  needMeeting?: boolean;

  @Column({ name: 'expertise_required', type: 'text', nullable: true })
  expertiseRequired?: string;

  @Column({
    name: 'expected_deliverables',
    type: 'enum',
    enum: Deliverable,
    array: true,
    nullable: true,
  })
  expectedDeliverables?: Deliverable[]; // Required for CONSULTANT campaigns

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

  @Column({ type: 'date' })
  deadline: Date;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  // Campaign-specific fields for SALESMAN campaigns
  @Column({
    name: 'commission_per_sale',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  commissionPerSale?: number; // Required for SALESMAN campaigns

  @Column({ name: 'current_sales', type: 'integer', nullable: true })
  currentSales?: number; // Number of sales made by the promoter so far

  @Column({
    name: 'sales_tracking_method',
    type: 'enum',
    enum: SalesTrackingMethod,
    nullable: true,
  })
  trackSalesVia?: SalesTrackingMethod; // Required for SALESMAN campaigns

  @Column({ name: 'code_prefix', type: 'varchar', length: 50, nullable: true })
  codePrefix?: string;

  // Common fields
  @Column({ type: 'text', array: true, nullable: true })
  requirements?: string[];

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

  @Column({ name: 'min_followers', type: 'integer', nullable: true })
  minFollowers?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'discord_invite_link', type: 'text', nullable: true })
  discordInviteLink?: string;

  @Column({ name: 'promoter_links', type: 'text', array: true, nullable: true })
  promoterLinks?: string[];

  // Relations

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;
}

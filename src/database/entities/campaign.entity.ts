import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import {
  CampaignType,
  CampaignStatus,
  SalesTrackingMethod,
  Deliverable,
  MeetingPlan,
} from '../../enums/campaign-type';
import { AdvertiserType } from '../../enums/advertiser-type';
import { PromoterCampaign } from './promoter-campaign.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: CampaignType })
  type: CampaignType;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.ACTIVE,
  })
  status: CampaignStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'is_public', type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl?: string;

  @Column({ name: 'selected_promoter_id', type: 'uuid', nullable: true })
  selectedPromoterId?: string;

  @Column({ name: 'discord_invite_link', type: 'text', nullable: true })
  discordInviteLink?: string;

  // Store advertiser types as JSON array
  @Column({
    name: 'advertiser_type',
    type: 'json',
    nullable: true,
  })
  advertiserType?: AdvertiserType[];

  // VISIBILITY specific fields
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cpv?: number;

  @Column({ name: 'max_views', type: 'integer', nullable: true })
  maxViews?: number;

  @Column({ name: 'track_url', type: 'text', nullable: true })
  trackUrl?: string;

  // CONSULTANT & SELLER shared fields
  @Column({
    name: 'max_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxBudget?: number;

  @Column({
    name: 'min_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  minBudget?: number;

  @Column({ type: 'timestamptz', nullable: true })
  deadline?: Date;

  // CONSULTANT specific fields
  @Column({
    name: 'expected_deliverables',
    type: 'json',
    nullable: true,
  })
  expectedDeliverables?: Deliverable[];

  @Column({ name: 'meeting_count', type: 'integer', nullable: true })
  meetingCount?: number;

  @Column({ name: 'reference_url', type: 'text', nullable: true })
  referenceUrl?: string;

  // SELLER specific fields
  @Column({
    name: 'seller_requirements',
    type: 'json',
    nullable: true,
  })
  sellerRequirements?: Deliverable[];

  @Column({
    name: 'deliverables',
    type: 'json',
    nullable: true,
  })
  deliverables?: Deliverable[];

  @Column({
    name: 'meeting_plan',
    type: 'enum',
    enum: MeetingPlan,
    nullable: true,
  })
  meetingPlan?: MeetingPlan;

  @Column({ name: 'deadline_strict', type: 'boolean', nullable: true })
  deadlineStrict?: boolean;

  @Column({
    name: 'promoter_links',
    type: 'json',
    nullable: true,
  })
  promoterLinks?: string[];

  // SALESMAN specific fields
  @Column({
    name: 'commission_per_sale',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  commissionPerSale?: number;

  @Column({
    name: 'track_sales_via',
    type: 'enum',
    enum: SalesTrackingMethod,
    nullable: true,
  })
  trackSalesVia?: SalesTrackingMethod;

  @Column({ name: 'code_prefix', type: 'varchar', length: 50, nullable: true })
  codePrefix?: string;

  // Payment tracking fields
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'created_by' })
  advertiser: UserEntity;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'selected_promoter_id' })
  selectedPromoter?: UserEntity;

  @OneToMany(
    () => PromoterCampaign,
    (promoterCampaign) => promoterCampaign.campaign,
  )
  promoterCampaigns: PromoterCampaign[];
}

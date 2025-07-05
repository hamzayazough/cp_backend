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
import { CampaignType, CampaignStatus } from '../../enums/campaign-type';
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

  @Column({ name: 'application_required', type: 'boolean', default: false })
  applicationRequired: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deadline?: Date;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budget?: number;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl?: string;

  // VISIBILITY specific fields
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cpv?: number;

  @Column({ name: 'max_views', type: 'integer', nullable: true })
  maxViews?: number;

  @Column({ name: 'track_url', type: 'text', nullable: true })
  trackUrl?: string;

  // CONSULTANT specific fields
  @Column({
    name: 'max_quote',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxQuote?: number;

  @Column({ name: 'reference_url', type: 'text', nullable: true })
  referenceUrl?: string;

  @Column({ name: 'meeting_count', type: 'integer', nullable: true })
  meetingCount?: number;

  // SELLER specific fields
  @Column({ name: 'deadline_strict', type: 'boolean', default: false })
  deadlineStrict?: boolean;

  // SALESMAN specific fields
  @Column({
    name: 'commission_per_sale',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  commissionPerSale?: number;

  @Column({ name: 'code_prefix', type: 'varchar', length: 50, nullable: true })
  codePrefix?: string;

  @Column({ name: 'only_approved_can_sell', type: 'boolean', default: false })
  onlyApprovedCanSell?: boolean;

  // Selection result
  @Column({ name: 'selected_promoter_id', type: 'uuid', nullable: true })
  selectedPromoterId?: string;

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

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';

export enum PromoterCampaignStatus {
  ONGOING = 'ONGOING',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  COMPLETED = 'COMPLETED',
}

@Entity('promoter_campaigns')
export class PromoterCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  @Column({
    type: 'enum',
    enum: PromoterCampaignStatus,
    default: PromoterCampaignStatus.ONGOING,
  })
  status: PromoterCampaignStatus;

  @Column({ name: 'views_generated', type: 'integer', default: 0 })
  viewsGenerated: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  earnings: number;

  @Column({
    name: 'joined_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { eager: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;

  // Note: To get transactions for this promoter campaign, query Transaction entity
  // with conditions: userId = promoterId AND campaignId = campaignId
}

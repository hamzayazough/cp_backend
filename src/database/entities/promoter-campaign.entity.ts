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
  PAUSED = 'PAUSED',
  REFUSED = 'REFUSED',
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

  // Payment tracking fields
  @Column({
    name: 'budget_held',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  budgetHeld: number;

  @Column({
    name: 'spent_budget',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  spentBudget: number;

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

  // Relations
  @ManyToOne(() => CampaignEntity, { eager: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

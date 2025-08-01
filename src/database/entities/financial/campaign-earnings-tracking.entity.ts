import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../user.entity';
import { CampaignEntity } from '../campaign.entity';
import { CampaignViewTracking } from './campaign-view-tracking.entity';
import { Transaction } from '../transaction.entity';

@Entity('campaign_earnings_tracking')
@Unique(['promoterId', 'campaignId'])
export class CampaignEarningsTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  // Earnings for this specific campaign
  @Column({ name: 'views_generated', type: 'integer', default: 0 })
  viewsGenerated: number;

  @Column({ name: 'cpv_cents', type: 'integer' })
  cpvCents: number; // CPV rate for this campaign in cents (per 100 views)

  @Column({ name: 'gross_earnings_cents', type: 'integer', default: 0 })
  grossEarningsCents: number; // views_generated * cpv_cents / 100

  @Column({ name: 'platform_fee_cents', type: 'integer', default: 0 })
  platformFeeCents: number; // 20% platform fee (in cents)

  @Column({ name: 'net_earnings_cents', type: 'integer', default: 0 })
  netEarningsCents: number; // Actual earnings to promoter (in cents)

  // Payout tracking
  @Column({ name: 'qualifies_for_payout', type: 'boolean', default: false })
  qualifiesForPayout: boolean; // TRUE if net_earnings >= $5 (500 cents)

  @Column({ name: 'payout_executed', type: 'boolean', default: false })
  payoutExecuted: boolean;

  @Column({ name: 'payout_amount_cents', type: 'integer', nullable: true })
  payoutAmountCents?: number; // Amount actually paid out

  @Column({ name: 'payout_date', type: 'timestamptz', nullable: true })
  payoutDate?: Date;

  @Column({ name: 'payout_transaction_id', type: 'uuid', nullable: true })
  payoutTransactionId?: string;

  @Column({
    name: 'stripe_transfer_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeTransferId?: string; // Stripe transfer ID for tracking

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;

  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payout_transaction_id' })
  payoutTransaction?: Transaction;

  @OneToMany(
    () => CampaignViewTracking,
    (viewTracking) => viewTracking.campaignEarnings,
  )
  viewTrackings: CampaignViewTracking[];

  // Helper methods
  get cpvDollars(): number {
    return this.cpvCents / 100;
  }

  get grossEarningsDollars(): number {
    return this.grossEarningsCents / 100;
  }

  get netEarningsDollars(): number {
    return this.netEarningsCents / 100;
  }

  get payoutAmountDollars(): number | undefined {
    return this.payoutAmountCents ? this.payoutAmountCents / 100 : undefined;
  }

  get platformFeeDollars(): number {
    return this.platformFeeCents / 100;
  }
}

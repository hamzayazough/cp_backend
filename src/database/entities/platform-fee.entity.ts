import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StripePaymentIntent } from './stripe-payment-intent.entity';
import { CampaignEntity } from './campaign.entity';
import { PlatformFeeType } from './stripe-enums';

@Entity('platform_fees')
export class PlatformFee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_intent_id', type: 'uuid' })
  paymentIntentId: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'fee_amount', type: 'integer' })
  feeAmount: number; // Platform fee in cents

  @Column({ name: 'stripe_fee_amount', type: 'integer', default: 0 })
  stripeFeeAmount: number; // Stripe's processing fee in cents

  @Column({ name: 'net_fee_amount', type: 'integer' })
  netFeeAmount: number; // Platform fee minus Stripe's cut

  @Column({
    name: 'fee_type',
    type: 'enum',
    enum: PlatformFeeType,
  })
  feeType: PlatformFeeType;

  @Column({
    name: 'fee_rate',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  feeRate: number; // Rate used for calculation

  @Column({ name: 'base_amount', type: 'integer' })
  baseAmount: number; // Amount fee was calculated on

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'pending' })
  status: string; // 'pending', 'collected', 'refunded'

  @Column({
    name: 'stripe_application_fee_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeApplicationFeeId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => StripePaymentIntent, { nullable: false })
  @JoinColumn({ name: 'payment_intent_id' })
  paymentIntent: StripePaymentIntent;

  @ManyToOne(() => CampaignEntity, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { UserEntity } from './user.entity';

@Entity('stripe_payment_intents')
export class StripePaymentIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'stripe_payment_intent_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  stripePaymentIntentId: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'payer_id', type: 'uuid', nullable: true })
  payerId: string;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string;

  @Column({ name: 'amount', type: 'integer' })
  amount: number; // Amount in cents

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ name: 'application_fee_amount', type: 'integer', default: 0 })
  applicationFeeAmount: number; // Platform fee in cents

  @Column({
    name: 'payment_flow_type',
    type: 'varchar',
    length: 50,
  })
  paymentFlowType: string; // 'destination', 'direct', 'separate_transfer'

  @Column({
    name: 'destination_account_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  destinationAccountId: string;

  @Column({ name: 'transfer_data', type: 'jsonb', nullable: true })
  transferData: any;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: 'requires_payment_method',
  })
  status: string;

  @Column({ name: 'client_secret', type: 'text', nullable: true })
  clientSecret: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'succeeded_at', type: 'timestamptz', nullable: true })
  succeededAt: Date;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'payer_id' })
  payer: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: UserEntity;
}

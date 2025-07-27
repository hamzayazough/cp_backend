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
import { UserEntity } from './user.entity';
import { StripeTransferStatus } from './stripe-enums';

@Entity('stripe_transfers')
export class StripeTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'stripe_transfer_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  stripeTransferId: string;

  @Column({ name: 'payment_intent_id', type: 'uuid', nullable: true })
  paymentIntentId: string;

  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId: string;

  @Column({ name: 'amount', type: 'integer' })
  amount: number; // Amount in cents

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    name: 'destination_account_id',
    type: 'varchar',
    length: 255,
  })
  destinationAccountId: string;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StripeTransferStatus,
    default: StripeTransferStatus.PENDING,
  })
  status: StripeTransferStatus;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @Column({
    name: 'failure_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  failureCode: string;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'transferred_at', type: 'timestamptz', nullable: true })
  transferredAt: Date;

  // Relations
  @ManyToOne(() => StripePaymentIntent, { nullable: false })
  @JoinColumn({ name: 'payment_intent_id' })
  paymentIntent: StripePaymentIntent;

  @ManyToOne(() => CampaignEntity, { nullable: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: UserEntity;
}

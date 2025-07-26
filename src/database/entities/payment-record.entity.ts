import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';

@Entity('payment_records')
export class PaymentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stripe_payment_intent_id', unique: true })
  stripePaymentIntentId: string;

  @Column({ name: 'campaign_id', nullable: true })
  campaignId?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'amount_cents' })
  amountCents: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'payment_type' })
  paymentType: string; // 'campaign_funding', 'wallet_deposit', 'withdrawal'

  @Column({ default: 'pending' })
  status: string; // 'pending', 'completed', 'failed', 'cancelled'

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity)
  @JoinColumn({ name: 'campaign_id' })
  campaign?: CampaignEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}

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

export enum StripeAccountStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESTRICTED = 'restricted',
  REJECTED = 'rejected',
}

export enum CapabilityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('stripe_connect_accounts')
export class StripeConnectAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'stripe_account_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  stripeAccountId: string;

  @Column({
    type: 'enum',
    enum: StripeAccountStatus,
    default: StripeAccountStatus.PENDING,
  })
  status: StripeAccountStatus;

  // Requirements as JSON fields
  @Column({ name: 'currently_due', type: 'json', default: () => "'[]'" })
  currentlyDue: string[];

  @Column({ name: 'eventually_due', type: 'json', default: () => "'[]'" })
  eventuallyDue: string[];

  @Column({ name: 'past_due', type: 'json', default: () => "'[]'" })
  pastDue: string[];

  // Capabilities
  @Column({
    name: 'transfers_capability',
    type: 'enum',
    enum: CapabilityStatus,
    default: CapabilityStatus.INACTIVE,
  })
  transfersCapability: CapabilityStatus;

  @Column({
    name: 'card_payments_capability',
    type: 'enum',
    enum: CapabilityStatus,
    default: CapabilityStatus.INACTIVE,
  })
  cardPaymentsCapability: CapabilityStatus;

  // Additional Stripe account info
  @Column({ name: 'country', type: 'varchar', length: 2, nullable: true })
  country: string;

  @Column({
    name: 'default_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  defaultCurrency: string;

  @Column({ name: 'charges_enabled', type: 'boolean', default: false })
  chargesEnabled: boolean;

  @Column({ name: 'payouts_enabled', type: 'boolean', default: false })
  payoutsEnabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

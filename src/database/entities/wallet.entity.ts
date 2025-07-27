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
import { UserType } from '../../enums/user-type';

// Transformer to handle PostgreSQL DECIMAL to JavaScript number conversion
const DecimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_type', type: 'enum', enum: UserType })
  userType: UserType;

  // View earnings (accumulated)
  @Column({
    name: 'current_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  currentBalance: number;

  @Column({
    name: 'pending_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  pendingBalance: number;

  @Column({
    name: 'total_deposited',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalDeposited: number;

  @Column({
    name: 'total_withdrawn',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalWithdrawn: number;

  @Column({ name: 'last_payout_date', type: 'timestamptz', nullable: true })
  lastPayoutDate?: Date;

  // Advertiser-specific fields (nullable for promoters)
  @Column({
    name: 'held_for_campaigns',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: DecimalTransformer,
  })
  heldForCampaigns?: number;

  // Promoter-specific fields (nullable for advertisers)
  @Column({
    name: 'total_earned',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: DecimalTransformer,
  })
  totalEarned?: number;

  @Column({ name: 'next_payout_date', type: 'timestamptz', nullable: true })
  nextPayoutDate?: Date;

  @Column({
    name: 'minimum_threshold',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 20,
    nullable: true,
    transformer: DecimalTransformer,
  })
  minimumThreshold?: number;

  // Direct earnings (consultant/seller campaigns)
  @Column({
    name: 'direct_total_earned',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: DecimalTransformer,
  })
  directTotalEarned?: number;

  @Column({
    name: 'direct_total_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: DecimalTransformer,
  })
  directTotalPaid?: number;

  @Column({
    name: 'direct_pending_payments',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: DecimalTransformer,
  })
  directPendingPayments?: number;

  @Column({
    name: 'direct_last_payment_date',
    type: 'timestamptz',
    nullable: true,
  })
  directLastPaymentDate?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

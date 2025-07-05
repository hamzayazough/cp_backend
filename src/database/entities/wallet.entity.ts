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

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  // View earnings (accumulated)
  @Column({
    name: 'current_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  currentBalance: number;

  @Column({
    name: 'pending_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  pendingBalance: number;

  @Column({
    name: 'total_earned',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalEarned: number;

  @Column({
    name: 'total_withdrawn',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalWithdrawn: number;

  @Column({ name: 'last_payout_date', type: 'timestamptz', nullable: true })
  lastPayoutDate?: Date;

  @Column({ name: 'next_payout_date', type: 'timestamptz', nullable: true })
  nextPayoutDate?: Date;

  @Column({
    name: 'minimum_threshold',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 20,
  })
  minimumThreshold: number;

  // Direct earnings (consultant/salesman)
  @Column({
    name: 'direct_total_earned',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  directTotalEarned: number;

  @Column({
    name: 'direct_total_paid',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  directTotalPaid: number;

  @Column({
    name: 'direct_pending_payments',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  directPendingPayments: number;

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
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

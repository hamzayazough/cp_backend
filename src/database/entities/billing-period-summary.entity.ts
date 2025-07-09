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

@Entity('billing_period_summary')
export class BillingPeriodSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_type', type: 'enum', enum: ['PROMOTER', 'ADVERTISER'] })
  userType: string;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  // For promoters
  @Column({
    name: 'total_earned',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalEarned: number;

  @Column({
    name: 'total_paid_out',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalPaidOut: number;

  @Column({
    name: 'pending_payouts',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  pendingPayouts: number;

  @Column({ name: 'campaigns_completed', type: 'integer', nullable: true })
  campaignsCompleted: number;

  // For advertisers
  @Column({
    name: 'total_spent',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalSpent: number;

  @Column({
    name: 'total_charged',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalCharged: number;

  @Column({ name: 'campaigns_funded', type: 'integer', nullable: true })
  campaignsFunded: number;

  @Column({
    name: 'remaining_credits',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  remainingCredits: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

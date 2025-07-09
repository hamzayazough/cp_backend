import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('advertiser_spends')
@Index(['advertiserId', 'periodStart', 'periodEnd'], { unique: true })
export class AdvertiserSpend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_id', type: 'uuid' })
  advertiserId: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({ name: 'campaigns_funded', type: 'integer', default: 0 })
  campaignsFunded: number;

  @Column({
    name: 'total_spent',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalSpent: number;

  @Column({
    name: 'total_charged',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalCharged: number;

  @Column({
    name: 'remaining_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  remainingBalance: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;
}

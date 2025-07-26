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

@Entity('advertiser_spends')
export class AdvertiserSpend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_id', type: 'uuid', unique: true })
  advertiserId: string;

  @Column({
    name: 'total_spent',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalSpent: number;

  @Column({
    name: 'total_refunded',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0.0,
  })
  totalRefunded: number;

  @Column({
    name: 'pending_charges',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  pendingCharges: number;

  @Column({ name: 'last_charge_date', type: 'timestamptz', nullable: true })
  lastChargeDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;
}

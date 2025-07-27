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

@Entity('promoter_balances')
@Index(['promoterId', 'periodStart', 'periodEnd'], { unique: true })
export class PromoterBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({
    name: 'visibility_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  visibilityEarnings: number;

  @Column({
    name: 'consultant_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  consultantEarnings: number;

  @Column({
    name: 'seller_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  sellerEarnings: number;

  @Column({
    name: 'salesman_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  salesmanEarnings: number;

  @Column({
    name: 'total_earnings',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalEarnings: number;

  @Column({ name: 'paid_out', type: 'boolean', default: false })
  paidOut: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

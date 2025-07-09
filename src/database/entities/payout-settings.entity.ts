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

@Entity('payout_settings')
export class PayoutSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid', unique: true })
  promoterId: string;

  @Column({
    name: 'minimum_threshold',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50.0,
  })
  minimumThreshold: number;

  @Column({ name: 'auto_payout_enabled', type: 'boolean', default: false })
  autoPayoutEnabled: boolean;

  @Column({
    name: 'payout_frequency',
    type: 'enum',
    enum: ['WEEKLY', 'MONTHLY', 'MANUAL'],
    default: 'MANUAL',
  })
  payoutFrequency: string;

  @Column({
    name: 'preferred_payout_method',
    type: 'enum',
    enum: ['STRIPE', 'BANK_TRANSFER'],
    default: 'STRIPE',
  })
  preferredPayoutMethod: string;

  @Column({
    name: 'stripe_account_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeAccountId: string;

  @Column({
    name: 'bank_account_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankAccountId: string;

  // Tax information
  @Column({ name: 'tax_id_provided', type: 'boolean', default: false })
  taxIdProvided: boolean;

  @Column({ name: 'w9_submitted', type: 'boolean', default: false })
  w9Submitted: boolean;

  @Column({
    name: 'tax_form_type',
    type: 'enum',
    enum: ['W9', '1099', 'OTHER'],
    nullable: true,
  })
  taxFormType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

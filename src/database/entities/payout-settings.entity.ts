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

export enum PayoutFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  MANUAL = 'MANUAL',
}

export enum PreferredPayoutMethod {
  STRIPE = 'STRIPE',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum TaxFormType {
  W9 = 'W9',
  FORM_1099 = '1099',
  OTHER = 'OTHER',
}

@Entity('payout_settings')
export class PayoutSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id', type: 'uuid', unique: true })
  promoterId: string;

  // Payout preferences
  @Column({
    name: 'frequency',
    type: 'enum',
    enum: PayoutFrequency,
    default: PayoutFrequency.MONTHLY,
  })
  frequency: PayoutFrequency;

  @Column({
    name: 'minimum_amount',
    type: 'decimal',
    precision: 8,
    scale: 2,
    default: 20.0,
  })
  minimumAmount: number;

  @Column({
    name: 'preferred_method',
    type: 'enum',
    enum: PreferredPayoutMethod,
    default: PreferredPayoutMethod.STRIPE,
  })
  preferredMethod: PreferredPayoutMethod;

  // Bank details (if preferred_method is 'BANK_TRANSFER')
  @Column({
    name: 'bank_account_holder_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankAccountHolderName: string | null;

  @Column({
    name: 'bank_account_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankAccountNumber: string | null;

  @Column({
    name: 'bank_routing_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankRoutingNumber: string | null;

  @Column({
    name: 'bank_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  bankName: string | null;

  // Tax information
  @Column({
    name: 'tax_form_type',
    type: 'enum',
    enum: TaxFormType,
    nullable: true,
  })
  taxFormType: TaxFormType | null;

  @Column({
    name: 'tax_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  taxId: string | null;

  @Column({ name: 'tax_form_submitted', type: 'boolean', default: false })
  taxFormSubmitted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

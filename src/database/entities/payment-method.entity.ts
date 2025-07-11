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

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  SEPA_DEBIT = 'sepa_debit',
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'stripe_payment_method_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  stripePaymentMethodId: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  type: PaymentMethodType;

  // Card details (if type is 'card')
  @Column({ name: 'card_brand', type: 'varchar', length: 50, nullable: true })
  cardBrand: string | null;

  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'card_exp_month', type: 'integer', nullable: true })
  cardExpMonth: number | null;

  @Column({ name: 'card_exp_year', type: 'integer', nullable: true })
  cardExpYear: number | null;

  // Bank account details (if type is 'bank_account')
  @Column({ name: 'bank_name', type: 'varchar', length: 255, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_last4', type: 'varchar', length: 4, nullable: true })
  bankLast4: string | null;

  @Column({
    name: 'bank_account_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  bankAccountType: string | null; // 'checking', 'savings'

  // Common fields
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

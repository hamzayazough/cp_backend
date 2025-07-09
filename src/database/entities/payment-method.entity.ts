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

  @Column({ name: 'last4', type: 'varchar', length: 4 })
  last4: string;

  @Column({ name: 'brand', type: 'varchar', length: 50, nullable: true })
  brand: string;

  @Column({ name: 'expiry_month', type: 'integer', nullable: true })
  expiryMonth: number;

  @Column({ name: 'expiry_year', type: 'integer', nullable: true })
  expiryYear: number;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({
    name: 'billing_country',
    type: 'varchar',
    length: 2,
    nullable: true,
  })
  billingCountry: string;

  @Column({
    name: 'billing_postal_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  billingPostalCode: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

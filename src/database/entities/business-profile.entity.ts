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

@Entity('business_profiles')
export class BusinessProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName: string;

  @Column({ name: 'business_type', type: 'varchar', length: 100, nullable: true })
  businessType: string; // 'llc', 'corporation', 'partnership', 'sole_proprietorship'

  @Column({ name: 'tax_id', type: 'varchar', length: 50, nullable: true })
  taxId: string; // EIN for US, Business Number for Canada

  // Address fields
  @Column({
    name: 'business_address_line1',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessAddressLine1: string;

  @Column({
    name: 'business_address_line2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessAddressLine2: string;

  @Column({
    name: 'business_city',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  businessCity: string;

  @Column({
    name: 'business_state',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  businessState: string;

  @Column({
    name: 'business_postal_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  businessPostalCode: string;

  @Column({
    name: 'business_country',
    type: 'varchar',
    length: 2,
    nullable: true,
  })
  businessCountry: string;

  // Contact fields
  @Column({
    name: 'business_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  businessPhone: string;

  @Column({ name: 'business_website', type: 'text', nullable: true })
  businessWebsite: string;

  // Legal representative fields
  @Column({
    name: 'representative_first_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  representativeFirstName: string;

  @Column({
    name: 'representative_last_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  representativeLastName: string;

  @Column({
    name: 'representative_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  representativeEmail: string;

  @Column({ name: 'representative_dob', type: 'date', nullable: true })
  representativeDob: Date;

  @Column({
    name: 'representative_phone',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  representativePhone: string;

  // Verification fields
  @Column({
    name: 'verification_status',
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  verificationStatus: string; // 'pending', 'verified', 'requires_action'

  @Column({ name: 'verification_documents', type: 'jsonb', nullable: true })
  verificationDocuments: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

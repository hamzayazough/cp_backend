import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { UserEntity } from './user.entity';
import { UserType } from '../../enums/user-type';

export enum SaleVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  DISPUTED = 'DISPUTED',
}

@Entity('sales_records')
export class SalesRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'user_type',
    type: 'enum',
    enum: UserType,
    default: UserType.PROMOTER,
  })
  userType: UserType;

  @Column({
    name: 'sale_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  saleAmount: number;

  @Column({
    name: 'commission_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  commissionRate: number;

  @Column({
    name: 'commission_earned',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  commissionEarned: number;

  @Column({ name: 'sale_date', type: 'timestamptz' })
  saleDate: Date;

  @Column({
    name: 'tracking_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  trackingCode: string | null;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: SaleVerificationStatus,
    default: SaleVerificationStatus.PENDING,
  })
  verificationStatus: SaleVerificationStatus;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

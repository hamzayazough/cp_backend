import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { UserRole } from '../../interfaces/user';
import { AdvertiserDetailsEntity } from './advertiser-details.entity';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'firebase_uid', unique: true })
  firebaseUid: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'is_setup_done', default: false })
  isSetupDone: boolean;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['ADVERTISER', 'PROMOTER', 'ADMIN'],
  })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Profile information
  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl?: string;

  @Column({ name: 'background_url', nullable: true })
  backgroundUrl?: string;

  @Column({ nullable: true })
  bio?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating?: number;

  // Social Media Links
  @Column({ name: 'tiktok_url', nullable: true })
  tiktokUrl?: string;

  @Column({ name: 'instagram_url', nullable: true })
  instagramUrl?: string;

  @Column({ name: 'snapchat_url', nullable: true })
  snapchatUrl?: string;

  @Column({ name: 'youtube_url', nullable: true })
  youtubeUrl?: string;

  @Column({ name: 'twitter_url', nullable: true })
  twitterUrl?: string;

  @Column({ name: 'website_url', nullable: true })
  websiteUrl?: string;

  // Financial
  @Column({ name: 'stripe_account_id', nullable: true })
  stripeAccountId?: string;
  @Column({
    name: 'wallet_balance',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  walletBalance: number;

  // Campaign Statistics
  @Column({
    name: 'number_of_visibility_campaign_done',
    type: 'int',
    default: 0,
  })
  numberOfVisibilityCampaignDone?: number;

  @Column({
    name: 'number_of_seller_campaign_done',
    type: 'int',
    default: 0,
  })
  numberOfSellerCampaignDone?: number;

  @Column({
    name: 'number_of_salesman_campaign_done',
    type: 'int',
    default: 0,
  })
  numberOfSalesmanCampaignDone?: number;

  @Column({
    name: 'number_of_consultant_campaign_done',
    type: 'int',
    default: 0,
  })
  numberOfConsultantCampaignDone?: number;

  // Relations
  @OneToOne(() => AdvertiserDetailsEntity, (advertiser) => advertiser.user, {
    cascade: true,
  })
  advertiserDetails?: AdvertiserDetailsEntity;

  @OneToOne(() => PromoterDetailsEntity, (promoter) => promoter.user, {
    cascade: true,
  })
  promoterDetails?: PromoterDetailsEntity;
}

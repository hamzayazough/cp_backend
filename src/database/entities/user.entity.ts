import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../../interfaces/user';
import { AdvertiserDetailsEntity } from './advertiser-details.entity';
import { PromoterDetailsEntity } from './promoter-details.entity';
import { Transaction } from './transaction.entity';
import { UniqueViewEntity } from './unique-view.entity';
import { PromoterCampaign } from './promoter-campaign.entity';
import { CampaignApplicationEntity } from './campaign-applications.entity';
import { Wallet } from './wallet.entity';
import { CampaignEntity } from './campaign.entity';
import { StripeConnectAccount } from './stripe-connect-account.entity';
import { NotificationEntity } from './notification.entity';
import { UserNotificationPreferenceEntity } from './user-notification-preference.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'firebase_uid', unique: true })
  firebaseUid: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

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

  @Column({
    name: 'used_currency',
    type: 'varchar',
    length: 10,
    default: 'CAD',
  })
  usedCurrency: 'CAD' | 'USD';

  @Column({ name: 'country', type: 'varchar', length: 100, default: 'CA' })
  country: string;

  // Notification preferences
  @Column({ name: 'email_notifications_enabled', default: true })
  emailNotificationsEnabled: boolean;

  @Column({ name: 'push_token', type: 'text', nullable: true })
  pushToken?: string;

  @Column({
    name: 'timezone',
    type: 'varchar',
    length: 50,
    default: 'America/Toronto',
  })
  timezone: string;

  @Column({
    name: 'notification_quiet_hours_start',
    type: 'time',
    nullable: true,
  })
  notificationQuietHoursStart?: string;

  @Column({
    name: 'notification_quiet_hours_end',
    type: 'time',
    nullable: true,
  })
  notificationQuietHoursEnd?: string;

  // Relations
  @OneToOne(() => AdvertiserDetailsEntity, (advertiser) => advertiser.user, {
    cascade: true,
  })
  advertiserDetails?: AdvertiserDetailsEntity;

  @OneToOne(() => PromoterDetailsEntity, (promoter) => promoter.user, {
    cascade: true,
  })
  promoterDetails?: PromoterDetailsEntity;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions?: Transaction[];

  @OneToMany(() => UniqueViewEntity, (uniqueView) => uniqueView.promoter)
  uniqueViews?: UniqueViewEntity[];

  @OneToMany(
    () => PromoterCampaign,
    (promoterCampaign) => promoterCampaign.promoter,
  )
  promoterCampaigns?: PromoterCampaign[];

  @OneToMany(
    () => CampaignApplicationEntity,
    (campaignApplication) => campaignApplication.promoter,
  )
  campaignApplications?: CampaignApplicationEntity[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet?: Wallet;

  @OneToMany(() => CampaignEntity, (campaign) => campaign.advertiser)
  campaigns?: CampaignEntity[];

  @OneToOne(() => StripeConnectAccount, (stripeAccount) => stripeAccount.user)
  stripeConnectAccount?: StripeConnectAccount;

  // Notification relations
  @OneToMany(() => NotificationEntity, (notification) => notification.user)
  notifications?: NotificationEntity[];

  @OneToMany(
    () => UserNotificationPreferenceEntity,
    (preference) => preference.user,
  )
  notificationPreferences?: UserNotificationPreferenceEntity[];
}

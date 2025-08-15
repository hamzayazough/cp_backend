import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';
import { NotificationType } from '../../enums/notification-type';
import { NotificationDeliveryMethod } from '../../enums/notification-delivery-method';

@Entity('notifications')
@Index(['userId'])
@Index(['notificationType'])
@Index(['createdAt'])
@Index(['readAt'])
@Index(['expiresAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
  })
  notificationType: NotificationType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // Related entity references (nullable, depending on notification type)
  @Column({ name: 'campaign_id', nullable: true })
  campaignId?: string;

  @Column({ name: 'conversation_id', nullable: true })
  conversationId?: string;

  @Column({ name: 'meeting_id', nullable: true })
  meetingId?: string;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string;

  // Delivery tracking
  @Column({
    name: 'delivery_methods',
    type: 'enum',
    enum: NotificationDeliveryMethod,
    array: true,
    default: () => "'{}'",
  })
  deliveryMethods: NotificationDeliveryMethod[];

  @Column({ name: 'email_sent_at', nullable: true })
  emailSentAt?: Date;

  @Column({ name: 'sms_sent_at', nullable: true })
  smsSentAt?: Date;

  @Column({ name: 'push_sent_at', nullable: true })
  pushSentAt?: Date;

  @Column({ name: 'in_app_sent_at', default: () => 'CURRENT_TIMESTAMP' })
  inAppSentAt: Date;

  // User interaction
  @Column({ name: 'read_at', nullable: true })
  readAt?: Date;

  @Column({ name: 'clicked_at', nullable: true })
  clickedAt?: Date;

  @Column({ name: 'dismissed_at', nullable: true })
  dismissedAt?: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  // Relations
  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => CampaignEntity, { nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: CampaignEntity;

  // Helper methods
  get isUnread(): boolean {
    return !this.readAt;
  }

  get isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  markAsRead(): void {
    this.readAt = new Date();
  }

  markAsClicked(): void {
    this.clickedAt = new Date();
  }

  markAsDismissed(): void {
    this.dismissedAt = new Date();
  }
}

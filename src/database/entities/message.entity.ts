import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';
import { MessageSenderType } from '../../enums/message-sender-type';

@Entity('message_threads')
@Index(['advertiserId', 'promoterId', 'campaignId'], { unique: true })
export class MessageThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  promoterId: string;

  @Column({ name: 'advertiser_id', type: 'uuid' })
  advertiserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string;

  @Column({ name: 'last_message_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CampaignEntity, { eager: false })
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'advertiser_id' })
  advertiser: UserEntity;

  @OneToMany(() => Message, (message) => message.thread)
  messages: Message[];

  @OneToMany(() => ChatSummary, (summary) => summary.thread)
  summaries: ChatSummary[];
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ name: 'sender_type', type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MessageThread, { eager: false })
  @JoinColumn({ name: 'thread_id' })
  thread: MessageThread;

  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: UserEntity;
}

@Entity('chat_summaries')
export class ChatSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ name: 'key_points', type: 'text', array: true, nullable: true })
  keyPoints: string[];

  @Column({ name: 'action_items', type: 'text', array: true, nullable: true })
  actionItems: string[];

  @Column({ name: 'sentiment_score', type: 'decimal', precision: 3, scale: 2, nullable: true })
  sentimentScore: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MessageThread, (thread) => thread.summaries, { eager: false })
  @JoinColumn({ name: 'thread_id' })
  thread: MessageThread;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('stripe_webhook_events')
export class StripeWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'stripe_event_id',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  stripeEventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'livemode', type: 'boolean' })
  livemode: boolean;

  @Column({ name: 'object_id', type: 'varchar', length: 255, nullable: true })
  objectId: string;

  @Column({ name: 'object_type', type: 'varchar', length: 50, nullable: true })
  objectType: string;

  @Column({ name: 'processed', type: 'boolean', default: false })
  processed: boolean;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError: string;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number;

  @Column({ name: 'raw_event_data', type: 'jsonb' })
  rawEventData: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
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

  @Column({ name: 'processed', type: 'boolean', default: false })
  processed: boolean;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError?: string;

  @Column({ name: 'object_id', type: 'varchar', length: 255, nullable: true })
  objectId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

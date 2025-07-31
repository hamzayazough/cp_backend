import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('unique_views')
@Unique(['campaignId', 'promoterId', 'fingerprint'])
export class UniqueViewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  @Index()
  campaignId: string;

  @Column({ name: 'promoter_id', type: 'uuid' })
  @Index()
  promoterId: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  fingerprint: string;

  @Column({ type: 'inet' })
  ip: string;

  @Column({ name: 'user_agent', type: 'text' })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.uniqueViews)
  @JoinColumn({ name: 'promoter_id' })
  promoter: UserEntity;
}

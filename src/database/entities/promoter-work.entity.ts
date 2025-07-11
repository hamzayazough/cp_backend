import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SocialPlatform } from '../../enums/social-platform';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('promoter_works')
export class PromoterWorkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id' })
  promoterId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'media_url', type: 'text' })
  mediaUrl: string;

  @Column({
    type: 'enum',
    enum: SocialPlatform,
    nullable: true,
  })
  platform?: SocialPlatform;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => PromoterDetailsEntity, (promoter) => promoter.promoterWorks)
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

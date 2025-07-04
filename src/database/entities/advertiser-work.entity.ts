import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AdvertiserDetailsEntity } from './advertiser-details.entity';

@Entity('advertiser_works')
export class AdvertiserWorkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_details_id' })
  advertiserDetailsId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'media_url', nullable: true })
  mediaUrl?: string;

  @Column({ name: 'website_url', nullable: true })
  websiteUrl?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(
    () => AdvertiserDetailsEntity,
    (advertiserDetails) => advertiserDetails.advertiserWorks,
  )
  @JoinColumn({ name: 'advertiser_details_id' })
  advertiserDetails: AdvertiserDetailsEntity;
}

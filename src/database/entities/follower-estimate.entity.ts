import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SocialPlatform } from '../../enums/social-platform';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('follower_estimates')
@Unique(['promoterId', 'platform'])
export class FollowerEstimateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id' })
  promoterId: string;

  @Column({
    type: 'enum',
    enum: SocialPlatform,
  })
  platform: SocialPlatform;

  @Column({ type: 'int' })
  count: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(
    () => PromoterDetailsEntity,
    (promoter) => promoter.followerEstimates,
  )
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

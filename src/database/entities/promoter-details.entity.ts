import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { PromoterLanguageEntity } from './promoter-language.entity';
import { PromoterSkillEntity } from './promoter-skill.entity';
import { FollowerEstimateEntity } from './follower-estimate.entity';
import { PromoterWorkEntity } from './promoter-work.entity';

@Entity('promoter_details')
export class PromoterDetailsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  location: string;

  @Column({ default: false })
  verified: boolean;

  @Column({
    name: 'total_sales',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  totalSales: number;

  @Column({ name: 'is_business', type: 'boolean', default: false })
  isBusiness: boolean;

  @Column({
    name: 'business_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  businessName?: string;

  @Column({ name: 'number_of_campaign_done', default: 0 })
  numberOfCampaignDone: number;

  @Column({ name: 'total_views_generated', type: 'bigint', default: 0 })
  totalViewsGenerated: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => UserEntity, (user) => user.promoterDetails)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany('PromoterLanguageEntity', 'promoterDetails', {
    cascade: true,
  })
  promoterLanguages: PromoterLanguageEntity[];

  @OneToMany('PromoterSkillEntity', 'promoterDetails', {
    cascade: true,
  })
  promoterSkills: PromoterSkillEntity[];

  @OneToMany('FollowerEstimateEntity', 'promoterDetails', {
    cascade: true,
  })
  followerEstimates: FollowerEstimateEntity[];

  @OneToMany('PromoterWorkEntity', 'promoterDetails', {
    cascade: true,
  })
  promoterWorks: PromoterWorkEntity[];
}

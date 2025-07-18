import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { CampaignWorkCommentEntity } from './campaign-work-comment.entity';

@Entity('campaign_works')
export class CampaignWorkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  campaignId: string;

  @Column({ name: 'promoter_link', type: 'text' })
  promoterLink: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne<CampaignEntity>(
    () => CampaignEntity,
    (campaign): CampaignWorkEntity => campaign.promoterWork,
  )
  @JoinColumn({ name: 'campaign_id' })
  campaign!: CampaignEntity;

  @OneToMany<CampaignWorkCommentEntity>(
    () => CampaignWorkCommentEntity,
    (comment): CampaignWorkEntity => comment.work,
  )
  comments!: CampaignWorkCommentEntity[];
}

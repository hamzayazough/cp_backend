import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CampaignWorkEntity } from './campaign-work.entity';

@Entity('campaign_work_comments')
export class CampaignWorkCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_id' })
  workId: string;

  @Column({ name: 'comment_message', type: 'text' })
  commentMessage: string;

  @Column({ name: 'commentator_id', type: 'uuid', nullable: true })
  commentatorId?: string;

  @Column({ name: 'commentator_name', type: 'text', nullable: true })
  commentatorName?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne<CampaignWorkEntity>(
    () => CampaignWorkEntity,
    (work): CampaignWorkCommentEntity[] => work.comments,
  )
  @JoinColumn({ name: 'work_id' })
  work!: CampaignWorkEntity;
}

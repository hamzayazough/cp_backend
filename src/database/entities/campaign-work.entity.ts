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
import { CampaignWorkCommentEntity } from './campaign-work-comment.entity';
import { CampaignDeliverableEntity } from './campaign-deliverable.entity';

@Entity('campaign_works')
export class CampaignWorkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deliverable_id' })
  deliverableId: string;

  @Column({ name: 'promoter_link', type: 'text' })
  promoterLink: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(
    () => CampaignDeliverableEntity,
    (deliverable) => deliverable.promoterWork,
  )
  @JoinColumn({ name: 'deliverable_id' })
  deliverable!: CampaignDeliverableEntity;

  @OneToMany<CampaignWorkCommentEntity>(
    () => CampaignWorkCommentEntity,
    (comment): CampaignWorkEntity => comment.work,
  )
  comments!: CampaignWorkCommentEntity[];
}

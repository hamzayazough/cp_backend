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
import { CampaignWorkEntity } from './campaign-work.entity';
import { Deliverable } from '../../enums/deliverable';

@Entity('campaign_deliverables')
export class CampaignDeliverableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_id' })
  campaignId: string;

  @Column({
    type: 'enum',
    enum: Deliverable,
  })
  deliverable: Deliverable;

  @Column({ name: 'is_submitted', type: 'boolean', default: false })
  isSubmitted: boolean;

  @Column({ name: 'is_finished', type: 'boolean', default: false })
  isFinished: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.campaignDeliverables)
  @JoinColumn({ name: 'campaign_id' })
  campaign: CampaignEntity;

  @OneToMany(() => CampaignWorkEntity, (work) => work.deliverable)
  promoterWork: CampaignWorkEntity[];
}

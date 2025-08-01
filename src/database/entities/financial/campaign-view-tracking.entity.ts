import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CampaignEarningsTracking } from './campaign-earnings-tracking.entity';
import { UniqueViewEntity } from '../unique-view.entity';

@Entity('campaign_view_tracking')
@Unique(['campaignEarningsId', 'uniqueViewId'])
export class CampaignViewTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'campaign_earnings_id', type: 'uuid' })
  campaignEarningsId: string;

  @Column({ name: 'unique_view_id', type: 'uuid' })
  uniqueViewId: string;

  @Column({ name: 'view_earnings_cents', type: 'integer' })
  viewEarningsCents: number; // Earnings from this specific view (cpv_cents / 100)

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Relations
  @ManyToOne(
    () => CampaignEarningsTracking,
    (earnings) => earnings.viewTrackings,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'campaign_earnings_id' })
  campaignEarnings: CampaignEarningsTracking;

  @ManyToOne(() => UniqueViewEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unique_view_id' })
  uniqueView: UniqueViewEntity;

  // Helper methods
  get viewEarningsDollars(): number {
    return this.viewEarningsCents / 100;
  }
}

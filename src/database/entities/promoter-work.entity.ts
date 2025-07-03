import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('promoter_works')
export class PromoterWorkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id' })
  promoterId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'media_url' })
  mediaUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => PromoterDetailsEntity, (promoter) => promoter.promoterWorks)
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

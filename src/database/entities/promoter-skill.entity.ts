import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('promoter_skills')
@Unique(['promoterId', 'skill'])
export class PromoterSkillEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id' })
  promoterId: string;

  @Column()
  skill: string;

  // Relations
  @ManyToOne(() => PromoterDetailsEntity, (promoter) => promoter.promoterSkills)
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

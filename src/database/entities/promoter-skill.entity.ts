import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { ExperienceLevel } from '../../enums/experience-level';
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

  @Column({
    name: 'experience_level',
    type: 'enum',
    enum: ExperienceLevel,
    default: ExperienceLevel.BEGINNER,
  })
  experienceLevel: ExperienceLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => PromoterDetailsEntity, (promoter) => promoter.promoterSkills)
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

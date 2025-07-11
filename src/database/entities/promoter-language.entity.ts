import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Language } from '../../enums/language';
import { LanguageProficiency } from '../../enums/language-proficiency';
import { PromoterDetailsEntity } from './promoter-details.entity';

@Entity('promoter_languages')
@Unique(['promoterId', 'language'])
export class PromoterLanguageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'promoter_id' })
  promoterId: string;

  @Column({
    type: 'enum',
    enum: Language,
  })
  language: Language;

  @Column({
    type: 'enum',
    enum: LanguageProficiency,
    default: LanguageProficiency.NATIVE,
  })
  proficiency: LanguageProficiency;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(
    () => PromoterDetailsEntity,
    (promoter) => promoter.promoterLanguages,
  )
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Language } from '../../enums/language';
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

  // Relations
  @ManyToOne(
    () => PromoterDetailsEntity,
    (promoter) => promoter.promoterLanguages,
  )
  @JoinColumn({ name: 'promoter_id' })
  promoterDetails: PromoterDetailsEntity;
}

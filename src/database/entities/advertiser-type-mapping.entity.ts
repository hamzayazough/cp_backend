import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { AdvertiserType } from '../../enums/advertiser-type';
import { AdvertiserDetailsEntity } from './advertiser-details.entity';

@Entity('advertiser_type_mappings')
@Unique(['advertiserId', 'advertiserType'])
export class AdvertiserTypeMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'advertiser_id' })
  advertiserId: string;

  @Column({
    name: 'advertiser_type',
    type: 'enum',
    enum: AdvertiserType,
  })
  advertiserType: AdvertiserType;

  // Relations
  @ManyToOne('AdvertiserDetailsEntity', 'advertiserTypeMappings')
  @JoinColumn({ name: 'advertiser_id' })
  advertiserDetails: AdvertiserDetailsEntity;
}

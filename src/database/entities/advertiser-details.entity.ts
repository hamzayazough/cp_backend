import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { AdvertiserTypeMappingEntity } from './advertiser-type-mapping.entity';

@Entity('advertiser_details')
export class AdvertiserDetailsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'company_website' })
  companyWebsite: string;

  @Column({ default: false })
  verified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToOne(() => UserEntity, (user) => user.advertiserDetails)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany('AdvertiserTypeMappingEntity', 'advertiserDetails', {
    cascade: true,
  })
  advertiserTypeMappings: AdvertiserTypeMappingEntity[];
}

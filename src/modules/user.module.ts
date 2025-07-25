import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../services/user.service';
import { S3Service } from '../services/s3.service';
import { AuthController } from '../controllers/auth.controller';
import { UserController } from '../controllers/user.controller';
import {
  UserEntity,
  AdvertiserDetailsEntity,
  AdvertiserTypeMappingEntity,
  AdvertiserWorkEntity,
  PromoterDetailsEntity,
  PromoterLanguageEntity,
  PromoterSkillEntity,
  FollowerEstimateEntity,
  PromoterWorkEntity,
} from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AdvertiserDetailsEntity,
      AdvertiserTypeMappingEntity,
      AdvertiserWorkEntity,
      PromoterDetailsEntity,
      PromoterLanguageEntity,
      PromoterSkillEntity,
      FollowerEstimateEntity,
      PromoterWorkEntity,
    ]),
  ],
  controllers: [AuthController, UserController],
  providers: [UserService, S3Service],
  exports: [UserService, S3Service],
})
export class UserModule {}

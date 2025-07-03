import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { AdvertiserTypeMappingEntity } from '../database/entities/advertiser-type-mapping.entity';
import { PromoterLanguageEntity } from '../database/entities/promoter-language.entity';
import { PromoterSkillEntity } from '../database/entities/promoter-skill.entity';
import { FollowerEstimateEntity } from '../database/entities/follower-estimate.entity';
import { PromoterWorkEntity } from '../database/entities/promoter-work.entity';
import { CreateUserDto, User } from '../interfaces/user';
import { AdvertiserType } from 'src/enums/advertiser-type';
import { Language } from 'src/enums/language';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepository: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(PromoterDetailsEntity)
    private readonly promoterDetailsRepository: Repository<PromoterDetailsEntity>,
    @InjectRepository(AdvertiserTypeMappingEntity)
    private readonly advertiserTypeMappingRepository: Repository<AdvertiserTypeMappingEntity>,
    @InjectRepository(PromoterLanguageEntity)
    private readonly promoterLanguageRepository: Repository<PromoterLanguageEntity>,
    @InjectRepository(PromoterSkillEntity)
    private readonly promoterSkillRepository: Repository<PromoterSkillEntity>,
    @InjectRepository(FollowerEstimateEntity)
    private readonly followerEstimateRepository: Repository<FollowerEstimateEntity>,
    @InjectRepository(PromoterWorkEntity)
    private readonly promoterWorkRepository: Repository<PromoterWorkEntity>,
  ) {}

  /**
   * Create a new user account
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: [
        { email: createUserDto.email },
        { firebaseUid: createUserDto.firebaseUid },
      ],
    });

    if (existingUser) {
      throw new ConflictException(
        'User already exists with this email or Firebase UID',
      );
    }

    const existingName = await this.userRepository.findOne({
      where: { name: createUserDto.name },
    });

    if (existingName) {
      throw new ConflictException('Username is already taken');
    }

    if (!createUserDto.role) {
      throw new ConflictException('Role is required');
    }

    const user = this.userRepository.create({
      firebaseUid: createUserDto.firebaseUid,
      email: createUserDto.email,
      name: createUserDto.name,
      role: createUserDto.role,
      bio: createUserDto.bio,
      tiktokUrl: createUserDto.tiktokUrl,
      instagramUrl: createUserDto.instagramUrl,
      snapchatUrl: createUserDto.snapchatUrl,
      youtubeUrl: createUserDto.youtubeUrl,
      twitterUrl: createUserDto.twitterUrl,
      websiteUrl: createUserDto.websiteUrl,
      walletBalance: 0,
    });

    const savedUser = await this.userRepository.save(user);

    // Create role-specific details
    if (
      createUserDto.role === 'ADVERTISER' &&
      createUserDto.advertiserDetails
    ) {
      await this.createAdvertiserDetails(
        savedUser.id,
        createUserDto.advertiserDetails,
      );
    } else if (
      createUserDto.role === 'PROMOTER' &&
      createUserDto.promoterDetails
    ) {
      await this.createPromoterDetails(
        savedUser.id,
        createUserDto.promoterDetails,
      );
    }

    return this.getUserByFirebaseUid(createUserDto.firebaseUid);
  }

  async checkUsernameExists(name: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { name },
    });
    return !!user;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserTypeMappings',
        'promoterDetails',
        'promoterDetails.promoterLanguages',
        'promoterDetails.promoterSkills',
        'promoterDetails.followerEstimates',
        'promoterDetails.promoterWorks',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapEntityToUser(user);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserTypeMappings',
        'promoterDetails',
        'promoterDetails.promoterLanguages',
        'promoterDetails.promoterSkills',
        'promoterDetails.followerEstimates',
        'promoterDetails.promoterWorks',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapEntityToUser(user);
  }

  private async createAdvertiserDetails(
    userId: string,
    advertiserData: CreateUserDto['advertiserDetails'],
  ): Promise<void> {
    if (!advertiserData) {
      throw new Error('Advertiser data is required');
    }

    const advertiserDetails = this.advertiserDetailsRepository.create({
      userId,
      companyName: advertiserData.companyName,
      companyWebsite: advertiserData.companyWebsite,
    });

    const savedAdvertiserDetails =
      await this.advertiserDetailsRepository.save(advertiserDetails);

    // Create advertiser type mappings
    if (
      advertiserData.advertiserTypes &&
      advertiserData.advertiserTypes.length > 0
    ) {
      const typeMappings = advertiserData.advertiserTypes.map(
        (type: AdvertiserType) =>
          this.advertiserTypeMappingRepository.create({
            advertiserId: savedAdvertiserDetails.id,
            advertiserType: type,
          }),
      );

      await this.advertiserTypeMappingRepository.save(typeMappings);
    }
  }

  private async createPromoterDetails(
    userId: string,
    promoterData: CreateUserDto['promoterDetails'],
  ): Promise<void> {
    if (!promoterData) {
      throw new Error('Promoter data is required');
    }

    const promoterDetails = this.promoterDetailsRepository.create({
      userId,
      location: promoterData.location,
    });

    const savedPromoterDetails =
      await this.promoterDetailsRepository.save(promoterDetails);

    // Create language mappings
    if (
      promoterData.languagesSpoken &&
      promoterData.languagesSpoken.length > 0
    ) {
      const languages = promoterData.languagesSpoken.map((language: Language) =>
        this.promoterLanguageRepository.create({
          promoterId: savedPromoterDetails.id,
          language: language,
        }),
      );

      await this.promoterLanguageRepository.save(languages);
    }

    // Create skills
    if (promoterData.skills && promoterData.skills.length > 0) {
      const skills = promoterData.skills.map((skill) =>
        this.promoterSkillRepository.create({
          promoterId: savedPromoterDetails.id,
          skill,
        }),
      );

      await this.promoterSkillRepository.save(skills);
    }

    // Create follower estimates (optional)
    if (
      promoterData.followerEstimates &&
      promoterData.followerEstimates.length > 0
    ) {
      const estimates = promoterData.followerEstimates.map((estimate) =>
        this.followerEstimateRepository.create({
          promoterId: savedPromoterDetails.id,
          platform: estimate.platform,
          count: estimate.count,
        }),
      );

      await this.followerEstimateRepository.save(estimates);
    }

    // Create works (optional)
    if (promoterData.works && promoterData.works.length > 0) {
      const works = promoterData.works.map((work) =>
        this.promoterWorkRepository.create({
          promoterId: savedPromoterDetails.id,
          title: work.title,
          description: work.description,
          mediaUrl: work.mediaUrl,
        }),
      );

      await this.promoterWorkRepository.save(works);
    }
  }

  private mapEntityToUser(userEntity: UserEntity): User {
    const user: User = {
      id: userEntity.id,
      email: userEntity.email,
      name: userEntity.name,
      role: userEntity.role,
      createdAt: userEntity.createdAt.toISOString(),
      avatarUrl: userEntity.avatarUrl,
      backgroundUrl: userEntity.backgroundUrl,
      bio: userEntity.bio,
      rating: userEntity.rating
        ? parseFloat(userEntity.rating.toString())
        : undefined,
      tiktokUrl: userEntity.tiktokUrl,
      instagramUrl: userEntity.instagramUrl,
      snapchatUrl: userEntity.snapchatUrl,
      youtubeUrl: userEntity.youtubeUrl,
      twitterUrl: userEntity.twitterUrl,
      websiteUrl: userEntity.websiteUrl,
      stripeAccountId: userEntity.stripeAccountId,
      walletBalance: userEntity.walletBalance
        ? parseFloat(userEntity.walletBalance.toString())
        : 0,
    };

    if (userEntity.advertiserDetails) {
      user.advertiserDetails = {
        companyName: userEntity.advertiserDetails.companyName,
        companyWebsite: userEntity.advertiserDetails.companyWebsite,
        verified: userEntity.advertiserDetails.verified,
        advertiserTypes:
          userEntity.advertiserDetails.advertiserTypeMappings?.map(
            (mapping: AdvertiserTypeMappingEntity) => mapping.advertiserType,
          ) || [],
      };
    }

    // Map promoter details
    if (userEntity.promoterDetails) {
      user.promoterDetails = {
        location: userEntity.promoterDetails.location,
        verified: userEntity.promoterDetails.verified,
        languagesSpoken:
          userEntity.promoterDetails.promoterLanguages?.map(
            (lang) => lang.language,
          ) || [],
        skills:
          userEntity.promoterDetails.promoterSkills?.map(
            (skill) => skill.skill,
          ) || [],
        followersEstimate:
          userEntity.promoterDetails.followerEstimates?.map((estimate) => ({
            platform: estimate.platform,
            count: estimate.count,
          })) || [],
        works:
          userEntity.promoterDetails.promoterWorks?.map((work) => ({
            title: work.title,
            description: work.description,
            mediaUrl: work.mediaUrl,
          })) || [],
      };
    }

    return user;
  }
}

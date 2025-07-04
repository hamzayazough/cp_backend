import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { AdvertiserWorkEntity } from '../database/entities/advertiser-work.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { AdvertiserTypeMappingEntity } from '../database/entities/advertiser-type-mapping.entity';
import { PromoterLanguageEntity } from '../database/entities/promoter-language.entity';
import { PromoterSkillEntity } from '../database/entities/promoter-skill.entity';
import { FollowerEstimateEntity } from '../database/entities/follower-estimate.entity';
import { PromoterWorkEntity } from '../database/entities/promoter-work.entity';
import { CreateUserDto, User } from '../interfaces/user';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { AdvertiserType } from 'src/enums/advertiser-type';
import { Language } from 'src/enums/language';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AdvertiserDetailsEntity)
    private readonly advertiserDetailsRepository: Repository<AdvertiserDetailsEntity>,
    @InjectRepository(AdvertiserWorkEntity)
    private readonly advertiserWorkRepository: Repository<AdvertiserWorkEntity>,
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
      isSetupDone: false,
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

  /**
   * Create a basic user account from Firebase token only
   */
  async createBasicUser(firebaseUser: FirebaseUser): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: [{ email: firebaseUser.email }, { firebaseUid: firebaseUser.uid }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User already exists with this email or Firebase UID',
      );
    }

    const user = this.userRepository.create({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      isSetupDone: false,
      walletBalance: 0,
    });

    const savedUser = await this.userRepository.save(user);
    return this.mapEntityToUser(savedUser);
  }

  /**
   * Complete user setup with full profile details (supports both creation and updates)
   */
  async completeUserSetup(
    firebaseUid: string,
    createUserDto: CreateUserDto,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: ['advertiserDetails', 'promoterDetails'],
    });

    if (!existingUser) {
      throw new NotFoundException('User account not found');
    }

    if (createUserDto.name) {
      const existingName = await this.userRepository.findOne({
        where: { name: createUserDto.name },
      });

      if (existingName && existingName.id !== existingUser.id) {
        throw new ConflictException('Username is already taken');
      }
    }

    if (!createUserDto.role) {
      throw new ConflictException('Role is required');
    }

    // Update user basic info
    existingUser.name = createUserDto.name;
    existingUser.role = createUserDto.role;
    existingUser.bio = createUserDto.bio;
    existingUser.tiktokUrl = createUserDto.tiktokUrl;
    existingUser.instagramUrl = createUserDto.instagramUrl;
    existingUser.snapchatUrl = createUserDto.snapchatUrl;
    existingUser.youtubeUrl = createUserDto.youtubeUrl;
    existingUser.twitterUrl = createUserDto.twitterUrl;
    existingUser.websiteUrl = createUserDto.websiteUrl;
    existingUser.isSetupDone = true;

    const savedUser = await this.userRepository.save(existingUser);

    // Handle advertiser details
    if (
      createUserDto.role === 'ADVERTISER' &&
      createUserDto.advertiserDetails
    ) {
      if (existingUser.advertiserDetails) {
        // Update existing advertiser details
        await this.updateAdvertiserDetails(
          existingUser.advertiserDetails.id,
          createUserDto.advertiserDetails,
        );
      } else {
        // Create new advertiser details
        await this.createAdvertiserDetails(
          savedUser.id,
          createUserDto.advertiserDetails,
        );
      }
    }

    // Handle promoter details
    if (createUserDto.role === 'PROMOTER' && createUserDto.promoterDetails) {
      if (existingUser.promoterDetails) {
        // Update existing promoter details
        await this.updatePromoterDetails(
          existingUser.promoterDetails.id,
          createUserDto.promoterDetails,
        );
      } else {
        // Create new promoter details
        await this.createPromoterDetails(
          savedUser.id,
          createUserDto.promoterDetails,
        );
      }
    }

    return this.getUserByFirebaseUid(firebaseUid);
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

    if (promoterData.skills && promoterData.skills.length > 0) {
      const skills = promoterData.skills.map((skill) =>
        this.promoterSkillRepository.create({
          promoterId: savedPromoterDetails.id,
          skill,
        }),
      );

      await this.promoterSkillRepository.save(skills);
    }

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

  private async updateAdvertiserDetails(
    advertiserDetailsId: string,
    advertiserData: CreateUserDto['advertiserDetails'],
  ): Promise<void> {
    if (!advertiserData) {
      throw new Error('Advertiser data is required');
    }

    // Update advertiser details
    await this.advertiserDetailsRepository.update(advertiserDetailsId, {
      companyName: advertiserData.companyName,
      companyWebsite: advertiserData.companyWebsite,
    });

    // Remove existing advertiser type mappings
    await this.advertiserTypeMappingRepository.delete({
      advertiserId: advertiserDetailsId,
    });

    // Add new advertiser type mappings
    if (
      advertiserData.advertiserTypes &&
      advertiserData.advertiserTypes.length > 0
    ) {
      const typeMappings = advertiserData.advertiserTypes.map(
        (type: AdvertiserType) =>
          this.advertiserTypeMappingRepository.create({
            advertiserId: advertiserDetailsId,
            advertiserType: type,
          }),
      );

      await this.advertiserTypeMappingRepository.save(typeMappings);
    }
  }

  private async updatePromoterDetails(
    promoterDetailsId: string,
    promoterData: CreateUserDto['promoterDetails'],
  ): Promise<void> {
    if (!promoterData) {
      throw new Error('Promoter data is required');
    }

    // Update promoter details
    await this.promoterDetailsRepository.update(promoterDetailsId, {
      location: promoterData.location,
    });

    // Remove existing languages
    await this.promoterLanguageRepository.delete({
      promoterId: promoterDetailsId,
    });

    // Remove existing skills
    await this.promoterSkillRepository.delete({
      promoterId: promoterDetailsId,
    });

    // Remove existing follower estimates
    await this.followerEstimateRepository.delete({
      promoterId: promoterDetailsId,
    });

    // Remove existing works
    await this.promoterWorkRepository.delete({
      promoterId: promoterDetailsId,
    });

    // Add new languages
    if (
      promoterData.languagesSpoken &&
      promoterData.languagesSpoken.length > 0
    ) {
      const languages = promoterData.languagesSpoken.map((language: Language) =>
        this.promoterLanguageRepository.create({
          promoterId: promoterDetailsId,
          language: language,
        }),
      );

      await this.promoterLanguageRepository.save(languages);
    }

    // Add new skills
    if (promoterData.skills && promoterData.skills.length > 0) {
      const skills = promoterData.skills.map((skill) =>
        this.promoterSkillRepository.create({
          promoterId: promoterDetailsId,
          skill,
        }),
      );

      await this.promoterSkillRepository.save(skills);
    }

    // Add new follower estimates
    if (
      promoterData.followerEstimates &&
      promoterData.followerEstimates.length > 0
    ) {
      const estimates = promoterData.followerEstimates.map((estimate) =>
        this.followerEstimateRepository.create({
          promoterId: promoterDetailsId,
          platform: estimate.platform,
          count: estimate.count,
        }),
      );

      await this.followerEstimateRepository.save(estimates);
    }

    // Add new works
    if (promoterData.works && promoterData.works.length > 0) {
      const works = promoterData.works.map((work) =>
        this.promoterWorkRepository.create({
          promoterId: promoterDetailsId,
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
      isSetupDone: userEntity.isSetupDone,
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

  /**
   * Update user's avatar URL in database
   */
  async updateUserAvatarUrl(
    firebaseUid: string,
    avatarUrl: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(user.id, { avatarUrl });
  }

  /**
   * Update user's background URL in database
   */
  async updateUserBackgroundUrl(
    firebaseUid: string,
    backgroundUrl: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(user.id, { backgroundUrl });
  }

  /**
   * Update or add a promoter work for a user
   */
  async updatePromoterWork(
    firebaseUid: string,
    work: { title: string; description?: string; mediaUrl: string },
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: ['promoterDetails', 'promoterDetails.promoterWorks'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.promoterDetails) {
      throw new NotFoundException('User is not a promoter');
    }

    let existingWork: PromoterWorkEntity | undefined;
    if (user.promoterDetails.promoterWorks) {
      existingWork = user.promoterDetails.promoterWorks.find(
        (w: PromoterWorkEntity) => w.title === work.title,
      );
    }

    if (existingWork) {
      await this.promoterWorkRepository.update(existingWork.id, {
        description: work.description,
        mediaUrl: work.mediaUrl,
      });
    } else {
      const newWork = this.promoterWorkRepository.create({
        title: work.title,
        description: work.description,
        mediaUrl: work.mediaUrl,
        promoterDetails: user.promoterDetails,
      });
      await this.promoterWorkRepository.save(newWork);
    }
  }

  /**
   * Update or add advertiser work to the user's profile
   */
  async updateAdvertiserWork(
    firebaseUid: string,
    work: {
      title: string;
      description: string;
      mediaUrl?: string;
      websiteUrl?: string;
      price?: number;
    },
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: ['advertiserDetails', 'advertiserDetails.advertiserWorks'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.advertiserDetails) {
      throw new NotFoundException('User is not an advertiser');
    }

    let existingWork: AdvertiserWorkEntity | undefined;
    if (user.advertiserDetails.advertiserWorks) {
      existingWork = user.advertiserDetails.advertiserWorks.find(
        (w: AdvertiserWorkEntity) => w.title === work.title,
      );
    }

    if (existingWork) {
      // Update existing work
      await this.advertiserWorkRepository.update(existingWork.id, {
        description: work.description,
        mediaUrl: work.mediaUrl,
        websiteUrl: work.websiteUrl,
        price: work.price,
      });
    } else {
      // Create new work
      const newWork = this.advertiserWorkRepository.create({
        title: work.title,
        description: work.description,
        mediaUrl: work.mediaUrl,
        websiteUrl: work.websiteUrl,
        price: work.price,
        advertiserDetails: user.advertiserDetails,
      });
      await this.advertiserWorkRepository.save(newWork);
    }
  }

  /**
   * Mark user setup as complete without requiring full profile details
   */
  async markSetupComplete(firebaseUid: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!existingUser) {
      throw new NotFoundException('User account not found');
    }

    existingUser.isSetupDone = true;
    await this.userRepository.save(existingUser);

    return this.getUserByFirebaseUid(firebaseUid);
  }
}

import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/database/entities';
import { AdvertiserDetailsEntity } from '../database/entities/advertiser-details.entity';
import { AdvertiserWorkEntity } from '../database/entities/advertiser-work.entity';
import { PromoterDetailsEntity } from '../database/entities/promoter-details.entity';
import { AdvertiserTypeMappingEntity } from '../database/entities/advertiser-type-mapping.entity';
import { PromoterLanguageEntity } from '../database/entities/promoter-language.entity';
import { PromoterSkillEntity } from '../database/entities/promoter-skill.entity';
import { FollowerEstimateEntity } from '../database/entities/follower-estimate.entity';
import { PromoterWorkEntity } from '../database/entities/promoter-work.entity';
import { UniqueViewEntity } from '../database/entities/unique-view.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserNotificationPreferenceEntity } from '../database/entities/user-notification-preference.entity';
import {
  AdvertiserDetailsDto,
  CreateUserDto,
  PromoterDetailsDto,
  User,
} from '../interfaces/user';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { AdvertiserType } from 'src/enums/advertiser-type';
import { Language } from 'src/enums/language';
import { NotificationType } from '../enums/notification-type';
import { S3Service } from './s3.service';
import { DiscordService } from './discord.service';

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
    @InjectRepository(UniqueViewEntity)
    private readonly uniqueViewRepository: Repository<UniqueViewEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(UserNotificationPreferenceEntity)
    private readonly userNotificationPreferenceRepository: Repository<UserNotificationPreferenceEntity>,
    private readonly s3Service: S3Service,
    private readonly discordService: DiscordService,
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
      phoneNumber: createUserDto.phoneNumber,
      name: createUserDto.name,
      role: createUserDto.role,
      bio: createUserDto.bio,
      tiktokUrl: createUserDto.tiktokUrl,
      instagramUrl: createUserDto.instagramUrl,
      snapchatUrl: createUserDto.snapchatUrl,
      youtubeUrl: createUserDto.youtubeUrl,
      twitterUrl: createUserDto.twitterUrl,
      websiteUrl: createUserDto.websiteUrl,
      country: createUserDto.country,
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

    // Initialize basic notification preferences for new user
    await this.initializeNotificationPreferences(savedUser.id);

    return await this.mapEntityToUser(savedUser);
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
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserWorks',
        'promoterDetails',
      ],
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
    existingUser.phoneNumber = createUserDto.phoneNumber;
    existingUser.role = createUserDto.role;
    existingUser.bio = createUserDto.bio;
    existingUser.tiktokUrl = createUserDto.tiktokUrl;
    existingUser.instagramUrl = createUserDto.instagramUrl;
    existingUser.snapchatUrl = createUserDto.snapchatUrl;
    existingUser.youtubeUrl = createUserDto.youtubeUrl;
    existingUser.twitterUrl = createUserDto.twitterUrl;
    existingUser.websiteUrl = createUserDto.websiteUrl;
    existingUser.isSetupDone = false;
    existingUser.usedCurrency = createUserDto.usedCurrency || 'USD';
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

    // Initialize notification preferences for the user
    await this.initializeNotificationPreferences(savedUser.id);

    // Send welcome notification based on user role
    await this.sendWelcomeNotification(savedUser.id, createUserDto.role);

    return this.getUserByFirebaseUid(firebaseUid);
  }

  async checkUsernameExists(name: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { name },
    });
    return !!user;
  }

  async checkCompanyNameExists(companyName: string): Promise<boolean> {
    const advertiserDetails = await this.advertiserDetailsRepository.findOne({
      where: { companyName },
    });
    return !!advertiserDetails;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserTypeMappings',
        'advertiserDetails.advertiserWorks',
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

    return await this.mapEntityToUser(user);
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserTypeMappings',
        'advertiserDetails.advertiserWorks',
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

    return await this.mapEntityToUser(user);
  }

  private async createAdvertiserDetails(
    userId: string,
    advertiserData: CreateUserDto['advertiserDetails'],
  ): Promise<void> {
    if (!advertiserData) {
      throw new Error('Advertiser data is required');
    }

    // Get user information for Discord channel creation
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create Discord channel for the advertiser using Firebase UID
    let discordChannelId: string | null = null;
    try {
      console.log(
        `Creating Discord channel for advertiser: ${advertiserData.companyName}, Firebase UID: ${user.firebaseUid}`,
      );
      discordChannelId = await this.discordService.createAdvertiserChannel(
        advertiserData.companyName,
        user.firebaseUid, // Use Firebase UID instead of Discord user ID
      );
      console.log(
        `Successfully created Discord channel with ID: ${discordChannelId}`,
      );
    } catch (error) {
      console.error(
        `Failed to create Discord channel for advertiser ${advertiserData.companyName} (Firebase UID: ${user.firebaseUid}):`,
        error,
      );
      // Continue with advertiser creation even if Discord fails
    }

    const advertiserDetails = this.advertiserDetailsRepository.create({
      userId,
      companyName: advertiserData.companyName,
      companyWebsite: advertiserData.companyWebsite,
      discordChannelId: discordChannelId || undefined,
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
      isBusiness: promoterData.isBusiness,
      businessName: promoterData.businessName,
      verified: false,
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
    advertiserData: AdvertiserDetailsDto,
  ): Promise<void> {
    if (!advertiserData) {
      throw new Error('Advertiser data is required');
    }

    // Update basic advertiser details only if provided
    const updateFields: Partial<AdvertiserDetailsEntity> = {};
    if (advertiserData.companyName) {
      updateFields.companyName = advertiserData.companyName;
    }
    if (advertiserData.companyWebsite) {
      updateFields.companyWebsite = advertiserData.companyWebsite;
    }
    updateFields.verified = true; // TODO: change when we get more users

    if (Object.keys(updateFields).length > 0) {
      await this.advertiserDetailsRepository.update(
        advertiserDetailsId,
        updateFields,
      );
    }

    // Update advertiser types only if provided
    if (
      advertiserData.advertiserTypes &&
      Array.isArray(advertiserData.advertiserTypes)
    ) {
      // Remove existing advertiser type mappings
      await this.advertiserTypeMappingRepository.delete({
        advertiserId: advertiserDetailsId,
      });

      // Add new advertiser type mappings
      if (advertiserData.advertiserTypes.length > 0) {
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
  }

  private async updatePromoterDetails(
    promoterDetailsId: string,
    promoterData: PromoterDetailsDto,
  ): Promise<void> {
    if (!promoterData) {
      throw new Error('Promoter data is required');
    }

    // Update promoter details fields only if provided
    const updateFields: Partial<PromoterDetailsEntity> = {};
    if (promoterData.location !== undefined) {
      updateFields.location = promoterData.location;
    }
    updateFields.isBusiness = promoterData.isBusiness;
    updateFields.verified = true; // TODO: change when we get more users

    updateFields.totalSales = 0;
    updateFields.numberOfCampaignDone = 0;
    updateFields.totalViewsGenerated = 0;

    if (Object.keys(updateFields).length > 0) {
      await this.promoterDetailsRepository.update(
        promoterDetailsId,
        updateFields,
      );
    }

    // Update languages only if provided
    if (
      promoterData.languagesSpoken &&
      Array.isArray(promoterData.languagesSpoken)
    ) {
      // Remove existing languages
      await this.promoterLanguageRepository.delete({
        promoterId: promoterDetailsId,
      });

      // Add new languages
      if (promoterData.languagesSpoken.length > 0) {
        const languages = promoterData.languagesSpoken.map(
          (language: Language) =>
            this.promoterLanguageRepository.create({
              promoterId: promoterDetailsId,
              language: language,
            }),
        );

        await this.promoterLanguageRepository.save(languages);
      }
    }

    // Update skills only if provided
    if (promoterData.skills && Array.isArray(promoterData.skills)) {
      // Remove existing skills
      await this.promoterSkillRepository.delete({
        promoterId: promoterDetailsId,
      });

      // Add new skills
      if (promoterData.skills.length > 0) {
        const skills = promoterData.skills.map((skill) =>
          this.promoterSkillRepository.create({
            promoterId: promoterDetailsId,
            skill,
          }),
        );

        await this.promoterSkillRepository.save(skills);
      }
    }

    // Update follower estimates only if provided
    if (
      promoterData.followerEstimates &&
      Array.isArray(promoterData.followerEstimates)
    ) {
      // Remove existing follower estimates
      await this.followerEstimateRepository.delete({
        promoterId: promoterDetailsId,
      });

      // Add new follower estimates
      if (promoterData.followerEstimates.length > 0) {
        const estimates = promoterData.followerEstimates.map((estimate) =>
          this.followerEstimateRepository.create({
            promoterId: promoterDetailsId,
            platform: estimate.platform,
            count: estimate.count,
          }),
        );

        await this.followerEstimateRepository.save(estimates);
      }
    }

    // Update works only if provided
    if (promoterData.works && Array.isArray(promoterData.works)) {
      // Remove existing works
      await this.promoterWorkRepository.delete({
        promoterId: promoterDetailsId,
      });

      // Add new works
      if (promoterData.works.length > 0) {
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
  }

  private async mapEntityToUser(userEntity: UserEntity): Promise<User> {
    const user: User = {
      id: userEntity.id,
      email: userEntity.email,
      phoneNumber: userEntity.phoneNumber,
      name: userEntity.name,
      role: userEntity.role,
      createdAt: userEntity.createdAt.toISOString(),
      updatedAt: userEntity.updatedAt,
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
      usedCurrency: userEntity.usedCurrency || 'USD',
      country: userEntity.country || 'CA',
    };

    if (userEntity.advertiserDetails) {
      user.advertiserDetails = {
        companyName: userEntity.advertiserDetails.companyName,
        companyWebsite: userEntity.advertiserDetails.companyWebsite,
        verified: userEntity.advertiserDetails.verified,
        discordChannelUrl: userEntity.advertiserDetails.discordChannelId
          ? this.generateDiscordChannelUrl(
              userEntity.advertiserDetails.discordChannelId,
            )
          : undefined,
        advertiserTypes:
          userEntity.advertiserDetails.advertiserTypeMappings?.map(
            (mapping: AdvertiserTypeMappingEntity) => mapping.advertiserType,
          ) || [],
        advertiserWork:
          userEntity.advertiserDetails.advertiserWorks?.map((work) => ({
            title: work.title,
            description: work.description,
            mediaUrl: work.mediaUrl,
            websiteUrl: work.websiteUrl,
            price: work.price,
          })) || [],
      };
    }

    if (userEntity.promoterDetails) {
      // Calculate total views generated dynamically from unique views
      const totalViewsGenerated = await this.calculateTotalViewsGenerated(
        userEntity.id,
      );

      user.promoterDetails = {
        location: userEntity.promoterDetails.location,
        isBusiness: userEntity.promoterDetails.isBusiness,
        businessName: userEntity.promoterDetails.businessName,
        verified: userEntity.promoterDetails.verified,
        totalSales: userEntity.promoterDetails.totalSales
          ? parseFloat(userEntity.promoterDetails.totalSales.toString())
          : 0,
        numberOfCampaignDone:
          userEntity.promoterDetails.numberOfCampaignDone || 0,
        numberOfVisibilityCampaignDone:
          userEntity.numberOfVisibilityCampaignDone || 0,
        numberOfSellerCampaignDone: userEntity.numberOfSellerCampaignDone || 0,
        numberOfSalesmanCampaignDone:
          userEntity.numberOfSalesmanCampaignDone || 0,
        numberOfConsultantCampaignDone:
          userEntity.numberOfConsultantCampaignDone || 0,
        totalViewsGenerated: totalViewsGenerated,
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

  /**
   * Delete advertiser work by title
   */
  async deleteAdvertiserWork(
    firebaseUid: string,
    title: string,
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

    const workToDelete = user.advertiserDetails.advertiserWorks?.find(
      (work) => work.title === title,
    );

    if (!workToDelete) {
      throw new NotFoundException('Advertiser work not found');
    }

    // Delete from S3 if mediaUrl exists
    if (workToDelete.mediaUrl) {
      try {
        const key = this.s3Service.extractKeyFromUrl(workToDelete.mediaUrl);
        await this.s3Service.deleteObject(key);
      } catch (error) {
        console.error('Error deleting from S3:', error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await this.advertiserWorkRepository.delete(workToDelete.id);
  }

  /**
   * Delete promoter work by title
   */
  async deletePromoterWork(firebaseUid: string, title: string): Promise<void> {
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

    const workToDelete = user.promoterDetails.promoterWorks?.find(
      (work) => work.title === title,
    );

    if (!workToDelete) {
      throw new NotFoundException('Promoter work not found');
    }

    // Delete from S3 if mediaUrl exists
    if (workToDelete.mediaUrl) {
      try {
        const key = this.s3Service.extractKeyFromUrl(workToDelete.mediaUrl);
        await this.s3Service.deleteObject(key);
      } catch (error) {
        console.error('Error deleting from S3:', error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await this.promoterWorkRepository.delete(workToDelete.id);
  }

  /**
   * Update user profile with general information
   */
  async updateUserProfile(
    firebaseUid: string,
    updateData: Partial<User>,
  ): Promise<User> {
    // Find user by Firebase UID
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserTypeMappings',
        'advertiserDetails.advertiserWorks',
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

    // Extract fields that can be updated directly on the user entity
    const { advertiserDetails, promoterDetails, ...userFields } = updateData;

    // Update user basic fields
    if (Object.keys(userFields).length > 0) {
      await this.userRepository.update(user.id, userFields);
    }

    // Update advertiser details if provided
    if (
      advertiserDetails &&
      user.role === 'ADVERTISER' &&
      user.advertiserDetails
    ) {
      await this.updateAdvertiserDetails(
        user.advertiserDetails.id,
        advertiserDetails,
      );
    }

    // Update promoter details if provided
    if (promoterDetails && user.role === 'PROMOTER' && user.promoterDetails) {
      await this.updatePromoterDetails(
        user.promoterDetails.id,
        promoterDetails,
      );
    }

    // Return updated user
    return await this.getUserByFirebaseUid(firebaseUid);
  }

  /**
   * Delete user account
   */
  async deleteUser(firebaseUid: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
      relations: [
        'advertiserDetails',
        'advertiserDetails.advertiserWorks',
        'promoterDetails',
        'promoterDetails.promoterWorks',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete associated advertiser works
    if (user.advertiserDetails) {
      for (const work of user.advertiserDetails.advertiserWorks) {
        if (work.mediaUrl) {
          try {
            const key = this.s3Service.extractKeyFromUrl(work.mediaUrl);
            await this.s3Service.deleteObject(key);
          } catch (error) {
            console.error('Error deleting advertiser work from S3:', error);
          }
        }
      }
    }

    // Delete associated promoter works
    if (user.promoterDetails) {
      for (const work of user.promoterDetails.promoterWorks) {
        if (work.mediaUrl) {
          try {
            const key = this.s3Service.extractKeyFromUrl(work.mediaUrl);
            await this.s3Service.deleteObject(key);
          } catch (error) {
            console.error('Error deleting promoter work from S3:', error);
          }
        }
      }
    }

    // Delete user
    await this.userRepository.delete(user.id);
  }

  /**
   * Generate Discord channel URL from channel ID
   */
  private generateDiscordChannelUrl(channelId: string): string | undefined {
    try {
      return this.discordService.generateChannelUrl(channelId);
    } catch (error) {
      console.warn('Failed to generate Discord channel URL:', error);
      return undefined;
    }
  }

  /**
   * Calculate total views generated by a promoter based on unique views
   */
  private async calculateTotalViewsGenerated(
    promoterId: string,
  ): Promise<number> {
    try {
      const result: { total: string } | undefined =
        await this.uniqueViewRepository
          .createQueryBuilder('unique_view')
          .select('COUNT(*)', 'total')
          .where('unique_view.promoterId = :promoterId', { promoterId })
          .getRawOne();

      return parseInt(result?.total || '0');
    } catch (error) {
      console.error('Error calculating total views generated:', error);
      return 0;
    }
  }

  /**
   * Initialize default notification preferences for a new user
   */
  private async initializeNotificationPreferences(
    userId: string,
  ): Promise<void> {
    try {
      // Check if user already has notification preferences
      const existingPreferencesCount =
        await this.userNotificationPreferenceRepository.count({
          where: { userId },
        });

      if (existingPreferencesCount > 0) {
        console.log(
          `User ${userId} already has notification preferences, skipping initialization`,
        );
        return;
      }

      const defaultPreferences = [
        // Critical notifications - enabled by default
        {
          type: NotificationType.PAYMENT_RECEIVED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.PAYMENT_FAILED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.SECURITY_ALERT,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },

        // Campaign notifications
        {
          type: NotificationType.CAMPAIGN_APPLICATION_ACCEPTED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_APPLICATION_REJECTED,
          email: true,
          sms: false,
          push: false,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_APPLICATION_RECEIVED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_WORK_APPROVED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_WORK_REJECTED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_WORK_SUBMITTED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_ENDING_SOON,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_ENDED,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_DETAILS_CHANGED,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_BUDGET_INCREASED,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.CAMPAIGN_DEADLINE_EXTENDED,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },

        // Messaging notifications
        {
          type: NotificationType.NEW_MESSAGE,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.NEW_CONVERSATION,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },

        // Meeting notifications
        {
          type: NotificationType.MEETING_SCHEDULED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.MEETING_REMINDER,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.MEETING_CANCELLED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.MEETING_RESCHEDULED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },

        // Payment notifications
        {
          type: NotificationType.PAYMENT_SENT,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.PAYOUT_PROCESSED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.STRIPE_ACCOUNT_VERIFIED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.STRIPE_ACCOUNT_ISSUE,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.WALLET_BALANCE_LOW,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },

        // Account notifications
        {
          type: NotificationType.ACCOUNT_VERIFIED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.ACCOUNT_VERIFICATION_REQUIRED,
          email: true,
          sms: false,
          push: true,
          inApp: true,
        },
        {
          type: NotificationType.PROFILE_INCOMPLETE,
          email: false,
          sms: false,
          push: true,
          inApp: true,
        },

        // System notifications
        {
          type: NotificationType.FEATURE_ANNOUNCEMENT,
          email: false,
          sms: false,
          push: false,
          inApp: true,
        },
        {
          type: NotificationType.SYSTEM_MAINTENANCE,
          email: true,
          sms: false,
          push: false,
          inApp: true,
        },
      ];

      // Use upsert approach to handle potential conflicts
      const preferences = defaultPreferences.map((pref) =>
        this.userNotificationPreferenceRepository.create({
          userId,
          notificationType: pref.type,
          emailEnabled: pref.email,
          smsEnabled: pref.sms,
          pushEnabled: pref.push,
          inAppEnabled: pref.inApp,
        }),
      );

      // Save preferences in batches to handle potential constraint violations
      await this.userNotificationPreferenceRepository.save(preferences);
      console.log(
        `Successfully initialized ${preferences.length} notification preferences for user ${userId}`,
      );
    } catch (error) {
      console.error('Error initializing notification preferences:', error);

      // Try to create preferences one by one if batch insert fails
      console.log('Attempting to create preferences individually...');
      await this.createPreferencesIndividually(userId);
    }
  }

  /**
   * Fallback method to create notification preferences one by one
   */
  private async createPreferencesIndividually(userId: string): Promise<void> {
    const allNotificationTypes = Object.values(NotificationType);
    let createdCount = 0;

    for (const notificationType of allNotificationTypes) {
      try {
        // Check if this specific preference already exists
        const existing =
          await this.userNotificationPreferenceRepository.findOne({
            where: { userId, notificationType },
          });

        if (!existing) {
          // Set default values based on notification type
          const isImportant = [
            NotificationType.PAYMENT_RECEIVED,
            NotificationType.PAYMENT_FAILED,
            NotificationType.SECURITY_ALERT,
            NotificationType.CAMPAIGN_APPLICATION_ACCEPTED,
            NotificationType.CAMPAIGN_APPLICATION_RECEIVED,
            NotificationType.CAMPAIGN_WORK_APPROVED,
            NotificationType.CAMPAIGN_WORK_SUBMITTED,
            NotificationType.ACCOUNT_VERIFIED,
            NotificationType.MEETING_SCHEDULED,
            NotificationType.MEETING_REMINDER,
          ].includes(notificationType);

          const preference = this.userNotificationPreferenceRepository.create({
            userId,
            notificationType,
            emailEnabled: isImportant,
            smsEnabled: false, // SMS disabled by default
            pushEnabled: true, // Push enabled for most notifications
            inAppEnabled: true, // In-app always enabled
          });

          await this.userNotificationPreferenceRepository.save(preference);
          createdCount++;
        }
      } catch (individualError) {
        console.warn(
          `Failed to create preference for ${notificationType}:`,
          individualError,
        );
        // Continue with other preferences
      }
    }

    console.log(
      `Created ${createdCount} notification preferences individually for user ${userId}`,
    );
  }

  /**
   * Public method to manually ensure notification preferences exist for a user
   * Useful for existing users or when preferences need to be reset
   */
  async ensureNotificationPreferences(firebaseUid: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.initializeNotificationPreferences(user.id);
  }

  /**
   * Get user's notification preferences - creates them if they don't exist
   */
  async getUserNotificationPreferences(
    firebaseUid: string,
  ): Promise<UserNotificationPreferenceEntity[]> {
    const user = await this.userRepository.findOne({
      where: { firebaseUid },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if preferences exist
    const preferences = await this.userNotificationPreferenceRepository.find({
      where: { userId: user.id },
      order: { notificationType: 'ASC' },
    });

    // If no preferences exist, create them
    if (preferences.length === 0) {
      console.log(
        `No notification preferences found for user ${user.id}, creating defaults...`,
      );
      await this.initializeNotificationPreferences(user.id);

      // Fetch the newly created preferences
      return this.userNotificationPreferenceRepository.find({
        where: { userId: user.id },
        order: { notificationType: 'ASC' },
      });
    }

    return preferences;
  }

  /**
   * Send welcome notification to newly setup user
   */
  private async sendWelcomeNotification(
    userId: string,
    role: string,
  ): Promise<void> {
    try {
      const isAdvertiser = role === 'ADVERTISER';
      const title = `Welcome to CrowdProp!`;
      const message = isAdvertiser
        ? `Welcome to CrowdProp! Your advertiser account is now set up. You can start creating campaigns and connecting with promoters to grow your business.`
        : `Welcome to CrowdProp! Your promoter account is now set up. You can start browsing campaigns and applying to promote products you love.`;

      const notification = this.notificationRepository.create({
        userId,
        notificationType: NotificationType.ACCOUNT_VERIFIED,
        title,
        message,
        metadata: {
          accountType: role,
          isWelcomeMessage: true,
          setupCompletedAt: new Date().toISOString(),
        },
      });

      await this.notificationRepository.save(notification);
      console.log(
        `Sent welcome notification to user ${userId} with role ${role}`,
      );
    } catch (error) {
      console.error('Error sending welcome notification:', error);
      // Don't throw error - this is not critical for user setup
    }
  }

  // ============================================================================
  // NOTIFICATION PREFERENCE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get notification preferences by user ID
   */
  async getNotificationPreferences(
    userId: string,
  ): Promise<UserNotificationPreferenceEntity[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if preferences exist
    const preferences = await this.userNotificationPreferenceRepository.find({
      where: { userId },
      order: { notificationType: 'ASC' },
    });

    // If no preferences exist, create them
    if (preferences.length === 0) {
      await this.initializeNotificationPreferences(userId);
      return this.userNotificationPreferenceRepository.find({
        where: { userId },
        order: { notificationType: 'ASC' },
      });
    }

    return preferences;
  }

  /**
   * Update a specific notification preference
   */
  async updateNotificationPreference(
    userId: string,
    notificationType: NotificationType,
    updates: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
    },
  ): Promise<UserNotificationPreferenceEntity> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find existing preference or create new one
    let preference = await this.userNotificationPreferenceRepository.findOne({
      where: { userId, notificationType },
    });

    if (!preference) {
      // Create new preference with default values
      preference = this.userNotificationPreferenceRepository.create({
        userId,
        notificationType,
        emailEnabled: updates.emailEnabled ?? true,
        smsEnabled: updates.smsEnabled ?? false,
        pushEnabled: updates.pushEnabled ?? true,
        inAppEnabled: updates.inAppEnabled ?? true,
      });
    } else {
      // Update existing preference
      if (updates.emailEnabled !== undefined) {
        preference.emailEnabled = updates.emailEnabled;
      }
      if (updates.smsEnabled !== undefined) {
        preference.smsEnabled = updates.smsEnabled;
      }
      if (updates.pushEnabled !== undefined) {
        preference.pushEnabled = updates.pushEnabled;
      }
      if (updates.inAppEnabled !== undefined) {
        preference.inAppEnabled = updates.inAppEnabled;
      }
    }

    return this.userNotificationPreferenceRepository.save(preference);
  }

  /**
   * Update multiple notification preferences at once
   */
  async updateMultipleNotificationPreferences(
    userId: string,
    preferences: Array<{
      notificationType: NotificationType;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
    }>,
  ): Promise<UserNotificationPreferenceEntity[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedPreferences: UserNotificationPreferenceEntity[] = [];

    for (const prefUpdate of preferences) {
      const updated = await this.updateNotificationPreference(
        userId,
        prefUpdate.notificationType,
        {
          emailEnabled: prefUpdate.emailEnabled,
          smsEnabled: prefUpdate.smsEnabled,
          pushEnabled: prefUpdate.pushEnabled,
          inAppEnabled: prefUpdate.inAppEnabled,
        },
      );
      updatedPreferences.push(updated);
    }

    return updatedPreferences;
  }

  /**
   * Reset notification preferences to default values
   */
  async resetNotificationPreferences(
    userId: string,
  ): Promise<UserNotificationPreferenceEntity[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete existing preferences
    await this.userNotificationPreferenceRepository.delete({ userId });

    // Recreate with default values
    await this.initializeNotificationPreferences(userId);

    // Return the new preferences
    return this.userNotificationPreferenceRepository.find({
      where: { userId },
      order: { notificationType: 'ASC' },
    });
  }

  /**
   * Get user's general notification settings
   */
  async getNotificationSettings(userId: string): Promise<{
    emailNotificationsEnabled: boolean;
    pushToken?: string;
    timezone: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'emailNotificationsEnabled',
        'pushToken',
        'timezone',
        'notificationQuietHoursStart',
        'notificationQuietHoursEnd',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      pushToken: user.pushToken,
      timezone: user.timezone,
      quietHoursStart: user.notificationQuietHoursStart,
      quietHoursEnd: user.notificationQuietHoursEnd,
    };
  }

  /**
   * Update user's general notification settings
   */
  async updateNotificationSettings(
    userId: string,
    updates: {
      emailNotificationsEnabled?: boolean;
      pushToken?: string;
      timezone?: string;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    },
  ): Promise<{
    emailNotificationsEnabled: boolean;
    pushToken?: string;
    timezone: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update the user entity
    if (updates.emailNotificationsEnabled !== undefined) {
      user.emailNotificationsEnabled = updates.emailNotificationsEnabled;
    }
    if (updates.pushToken !== undefined) {
      user.pushToken = updates.pushToken;
    }
    if (updates.timezone !== undefined) {
      user.timezone = updates.timezone;
    }
    if (updates.quietHoursStart !== undefined) {
      user.notificationQuietHoursStart = updates.quietHoursStart;
    }
    if (updates.quietHoursEnd !== undefined) {
      user.notificationQuietHoursEnd = updates.quietHoursEnd;
    }

    await this.userRepository.save(user);

    return {
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      pushToken: user.pushToken,
      timezone: user.timezone,
      quietHoursStart: user.notificationQuietHoursStart,
      quietHoursEnd: user.notificationQuietHoursEnd,
    };
  }
}

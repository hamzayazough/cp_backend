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
import {
  AdvertiserDetailsDto,
  CreateUserDto,
  PromoterDetailsDto,
  User,
} from '../interfaces/user';
import { FirebaseUser } from '../interfaces/firebase-user.interface';
import { AdvertiserType } from 'src/enums/advertiser-type';
import { Language } from 'src/enums/language';
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
}

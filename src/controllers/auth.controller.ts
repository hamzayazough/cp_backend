import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from '../services/user.service';
import { S3Service, UploadResult } from '../services/s3.service';
import { CreateUserDto, User as UserInterface } from '../interfaces/user';
import { PromoterWork } from 'src/interfaces/promoter-work';
import { AdvertiserWork } from 'src/interfaces/advertiser-work';
import { User } from '../auth/user.decorator';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Create a basic user account from Firebase token
   * Input:
   *   - Headers: Firebase Auth Token (required)
   * Responses:
   *   - 201 Created: { success: true, message: string, user: User }
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 409 Conflict: User already exists
   */
  @Post('create-account')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@User() firebaseUser: FirebaseUser) {
    const user = await this.userService.createBasicUser(firebaseUser);

    return {
      success: true,
      message: 'Basic account created successfully',
      user,
    };
  }

  /**
   * Complete user account setup with full profile details (supports both creation and updates)
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Body: CreateUserDto { role, username, advertiserDetails?, promoterDetails? }
   * Responses:
   *   - 200 OK: { success: true, message: string, user: User }
   *   - 400 Bad Request: Missing advertiser/promoter details for respective roles
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: User account not found
   *   - 409 Conflict: Username already taken
   */
  @Post('complete-account')
  @HttpCode(HttpStatus.OK)
  async completeAccount(
    @User() firebaseUser: FirebaseUser,
    @Body() createUserDto: CreateUserDto,
  ) {
    try {
      if (
        createUserDto.role === 'ADVERTISER' &&
        !createUserDto.advertiserDetails
      ) {
        throw new BadRequestException(
          'Advertiser details are required for advertiser role',
        );
      }

      if (createUserDto.role === 'PROMOTER' && !createUserDto.promoterDetails) {
        throw new BadRequestException(
          'Promoter details are required for promoter role',
        );
      }

      const user = await this.userService.completeUserSetup(
        firebaseUser.uid,
        createUserDto,
      );

      return {
        success: true,
        message: 'Account updated successfully',
        user,
      };
    } catch (error) {
      console.error('Complete account error:', error);
      throw error;
    }
  }

  /**
   * Check if a username is available
   * This endpoint does NOT require authentication
   * Input:
   *   - Query: name (string, required)
   * Responses:
   *   - 200 OK: { available: boolean, exists: boolean }
   *   - 400 Bad Request: Username is required or empty
   */
  @Get('check-username')
  @HttpCode(HttpStatus.OK)
  async checkUsername(@Query('name') name: string) {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Username is required');
    }

    const exists = await this.userService.checkUsernameExists(name.trim());

    return {
      available: !exists,
      exists,
    };
  }

  /**
   * Get current user profile
   * Input:
   *   - Headers: Firebase Auth Token (required)
   * Responses:
   *   - 200 OK: { success: true, user: User }
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: User account not found, needs to create account
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@User() firebaseUser: FirebaseUser) {
    try {
      const user = await this.userService.getUserByFirebaseUid(
        firebaseUser.uid,
      );

      return {
        success: true,
        user,
      };
    } catch {
      throw new NotFoundException(
        'User account not found. Please create an account.',
      );
    }
  }

  /**
   * Get user by ID (public endpoint for viewing profiles)
   * Input:
   *   - Query: id (string, required) - User ID
   * Responses:
   *   - 200 OK: { success: true, user: User }
   *   - 400 Bad Request: User ID is required
   *   - 404 Not Found: User not found
   */
  @Get('user')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Query('id') id: string) {
    if (!id) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const user = await this.userService.getUserById(id);

      return {
        success: true,
        user,
      };
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Upload user avatar
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Form data: file (image file, required)
   * Responses:
   *   - 201 Created: { success: true, message: string, result: UploadResult }
   *   - 400 Bad Request: No file provided or invalid file type
   *   - 401 Unauthorized: Invalid or missing Firebase token
   */
  @Post('upload-avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @User() firebaseUser: FirebaseUser,
    @UploadedFile() file: UploadedFile,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum size is 5MB.',
      );
    }

    const result = await this.s3Service.uploadUserAvatar(
      file.buffer,
      file.originalname,
      file.mimetype,
      firebaseUser.uid,
    );

    await this.userService.updateUserAvatarUrl(
      firebaseUser.uid,
      result.publicUrl,
    );

    return {
      success: true,
      message: 'Avatar uploaded successfully',
      result,
    };
  }

  /**
   * Upload user background image
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Form data: file (image file, required)
   * Responses:
   *   - 201 Created: { success: true, message: string, result: UploadResult }
   *   - 400 Bad Request: No file provided or invalid file type
   *   - 401 Unauthorized: Invalid or missing Firebase token
   */
  @Post('upload-background')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackground(
    @User() firebaseUser: FirebaseUser,
    @UploadedFile() file: UploadedFile,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum size is 10MB.',
      );
    }

    const result = await this.s3Service.uploadUserBackground(
      file.buffer,
      file.originalname,
      file.mimetype,
      firebaseUser.uid,
    );

    await this.userService.updateUserBackgroundUrl(
      firebaseUser.uid,
      result.publicUrl,
    );

    return {
      success: true,
      message: 'Background image uploaded successfully',
      result,
    };
  }

  /**
   * Upload promoter work file
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Form data: file (image/video file, required)
   *   - Form data: title (string, required)
   *   - Form data: description (string, optional)
   *   - Query: workId (string, optional) - ID of specific work
   * Responses:
   *   - 201 Created: { success: true, message: string, result: UploadResult, work: PromoterWork }
   *   - 400 Bad Request: No file provided, missing title, or invalid file type
   *   - 401 Unauthorized: Invalid or missing Firebase token
   */
  @Post('upload-promoter-work')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPromoterWork(
    @User() firebaseUser: FirebaseUser,
    @UploadedFile() file: UploadedFile,
    @Body('title') title: string,
    @Body('description') description?: string,
    @Query('workId') workId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!title || title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only images (JPEG, PNG, WebP, GIF), videos (MP4, WebM, MOV), and PDFs are allowed.',
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum size is 50MB.',
      );
    }

    const result = await this.s3Service.uploadPromoterWork(
      file.buffer,
      file.originalname,
      file.mimetype,
      firebaseUser.uid,
      workId,
    );

    // Create PromoterWork object
    const work: PromoterWork = {
      title: title.trim(),
      description: description?.trim() || undefined,
      mediaUrl: result.publicUrl,
    };

    // Update user's promoter works in database
    await this.userService.updatePromoterWork(firebaseUser.uid, work);

    return {
      success: true,
      message: 'Promoter work uploaded successfully',
      result,
      work,
    };
  }

  /**
   * Upload advertiser work file
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Form data: file (image/video file, optional)
   *   - Form data: title (string, required)
   *   - Form data: description (string, required)
   *   - Form data: websiteUrl (string, optional)
   *   - Form data: price (number, optional)
   *   - Query: workId (string, optional) - ID of specific work
   * Responses:
   *   - 201 Created: { success: true, message: string, result?: UploadResult, work: AdvertiserWork }
   *   - 400 Bad Request: Missing title/description, or invalid file type
   *   - 401 Unauthorized: Invalid or missing Firebase token
   */
  @Post('upload-advertiser-work')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAdvertiserWork(
    @User() firebaseUser: FirebaseUser,
    @UploadedFile() file: UploadedFile | undefined,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('websiteUrl') websiteUrl?: string,
    @Body('price') price?: string,
  ) {
    if (!title || title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    if (!description || description.trim().length === 0) {
      throw new BadRequestException('Description is required');
    }

    let result: UploadResult | undefined = undefined;
    let mediaUrl: string | undefined = undefined;

    // Handle file upload if provided
    if (file) {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'video/quicktime',
      ];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, MOV) are allowed.',
        );
      }

      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new BadRequestException(
          'File size too large. Maximum size is 50MB.',
        );
      }

      result = await this.s3Service.uploadCampaignProduct(
        file.buffer,
        file.originalname,
        file.mimetype,
        firebaseUser.uid,
        'advertiser-work', // Use as campaign ID for folder structure
        1, // Version
      );
      mediaUrl = result?.publicUrl;
    }

    // Parse price if provided
    let parsedPrice: number | undefined = undefined;
    if (price) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new BadRequestException('Price must be a valid positive number');
      }
    }

    // Create AdvertiserWork object
    const work: AdvertiserWork = {
      title: title.trim(),
      description: description.trim(),
      mediaUrl,
      websiteUrl: websiteUrl?.trim() || undefined,
      price: parsedPrice,
    };

    // Update user's advertiser works in database
    await this.userService.updateAdvertiserWork(firebaseUser.uid, work);

    return {
      success: true,
      message: 'Advertiser work uploaded successfully',
      result,
      work,
    };
  }

  /**
   * Mark user setup as complete
   * Input:
   *   - Headers: Firebase Auth Token (required)
   * Responses:
   *   - 200 OK: { success: true, message: string, user: User }
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: User account not found
   */
  @Post('mark-setup-complete')
  @HttpCode(HttpStatus.OK)
  async markSetupComplete(@User() firebaseUser: FirebaseUser) {
    try {
      const user = await this.userService.markSetupComplete(firebaseUser.uid);

      return {
        success: true,
        message: 'Setup marked as complete successfully',
        user,
      };
    } catch (error) {
      console.error('Mark setup complete error:', error);
      throw error;
    }
  }

  /**
   * Delete advertiser work
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Body: { title: string }
   * Responses:
   *   - 200 OK: { success: true, message: string }
   *   - 400 Bad Request: Title is required
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: Work not found
   */
  @Post('delete-advertiser-work')
  @HttpCode(HttpStatus.OK)
  async deleteAdvertiserWork(
    @User() firebaseUser: FirebaseUser,
    @Body('title') title: string,
  ) {
    if (!title || title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    try {
      await this.userService.deleteAdvertiserWork(
        firebaseUser.uid,
        title.trim(),
      );

      return {
        success: true,
        message: 'Advertiser work deleted successfully',
      };
    } catch (error) {
      console.error('Delete advertiser work error:', error);
      throw error;
    }
  }

  /**
   * Delete promoter work
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Body: { title: string }
   * Responses:
   *   - 200 OK: { success: true, message: string }
   *   - 400 Bad Request: Title is required
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: Work not found
   */
  @Post('delete-promoter-work')
  @HttpCode(HttpStatus.OK)
  async deletePromoterWork(
    @User() firebaseUser: FirebaseUser,
    @Body('title') title: string,
  ) {
    if (!title || title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }

    try {
      await this.userService.deletePromoterWork(firebaseUser.uid, title.trim());

      return {
        success: true,
        message: 'Promoter work deleted successfully',
      };
    } catch (error) {
      console.error('Delete promoter work error:', error);
      throw error;
    }
  }

  /**
   * Update user profile information
   * Input:
   *   - Headers: Firebase Auth Token (required)
   *   - Body: Partial<User> (any user fields to update)
   * Responses:
   *   - 200 OK: { success: true, message: string, user: User }
   *   - 400 Bad Request: Invalid user data provided
   *   - 401 Unauthorized: Invalid or missing Firebase token
   *   - 404 Not Found: User account not found
   */
  @Post('update-profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @User() firebaseUser: FirebaseUser,
    @Body() updateData: Partial<UserInterface>,
  ) {
    try {
      // Validate that we have some data to update
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new BadRequestException('No update data provided');
      }

      // Update user profile
      const user = await this.userService.updateUserProfile(
        firebaseUser.uid,
        updateData,
      );

      return {
        success: true,
        message: 'Profile updated successfully',
        user,
      };
    } catch (error) {
      console.error('Update profile error:', error);

      // Handle specific error cases
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          'User account not found. Please contact support.',
        );
      }

      throw new BadRequestException('Invalid user data provided');
    }
  }
}

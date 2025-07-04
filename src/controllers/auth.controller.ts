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
import { S3Service } from '../services/s3.service';
import { CreateUserDto } from '../interfaces/user';
import { PromoterWork } from 'src/interfaces/promoter-work';
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
   * Complete user account setup with full profile details
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
        message: 'Account setup completed successfully',
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
}

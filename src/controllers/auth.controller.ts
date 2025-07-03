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
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../interfaces/user';
import { User } from '../auth/user.decorator';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

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
      // If user not found, throw 404
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
}

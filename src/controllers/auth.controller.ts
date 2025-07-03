import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../interfaces/user';
import { User } from '../auth/user.decorator';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create a new user account
   */
  @Post('create-account')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(
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

    const completeUserDto: CreateUserDto = {
      ...createUserDto,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
    };

    const user = await this.userService.createUser(completeUserDto);

    return {
      success: true,
      message: 'Account created successfully',
      user,
    };
  }

  /**
   * Check if a username is available
   * This endpoint does NOT require authentication
   */
  @Get('check-username')
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
   */
  @Get('profile')
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
      // If user not found, they need to create an account
      return {
        success: false,
        message: 'User account not found. Please create an account.',
        needsAccountCreation: true,
      };
    }
  }

  /**
   * Get user by ID (public endpoint for viewing profiles)
   */
  @Get('user')
  async getUserById(@Query('id') id: string) {
    if (!id) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.userService.getUserById(id);

    return {
      success: true,
      user,
    };
  }
}

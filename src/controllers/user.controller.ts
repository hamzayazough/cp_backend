import {
  Controller,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { User } from '../interfaces/user';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get user information by ID
   * Input:
   *   - Param: id (string, required) - User ID
   * Responses:
   *   - 200 OK: { success: true, user: User }
   *   - 400 Bad Request: User ID is required
   *   - 404 Not Found: User not found
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string): Promise<{
    success: boolean;
    user: User;
    message?: string;
  }> {
    if (!id || id.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const user = await this.userService.getUserById(id.trim());

      return {
        success: true,
        user,
        message: 'User retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Check if a username is available
   * Input:
   *   - Query: username (string, required) - Username to check
   * Responses:
   *   - 200 OK: { success: true, available: boolean, message: string }
   *   - 400 Bad Request: Username is required
   */
  @Get('check/username')
  @HttpCode(HttpStatus.OK)
  async checkUsernameAvailability(
    @Query('username') username: string,
  ): Promise<{
    success: boolean;
    available: boolean;
    message: string;
  }> {
    if (!username || username.trim().length === 0) {
      throw new BadRequestException('Username is required');
    }

    const exists = await this.userService.checkUsernameExists(username.trim());

    return {
      success: true,
      available: !exists,
      message: exists ? 'Username is already taken' : 'Username is available',
    };
  }

  /**
   * Check if a company name is available
   * Input:
   *   - Query: companyName (string, required) - Company name to check
   * Responses:
   *   - 200 OK: { success: true, available: boolean, message: string }
   *   - 400 Bad Request: Company name is required
   */
  @Get('check/company-name')
  @HttpCode(HttpStatus.OK)
  async checkCompanyNameAvailability(
    @Query('companyName') companyName: string,
  ): Promise<{
    success: boolean;
    available: boolean;
    message: string;
  }> {
    if (!companyName || companyName.trim().length === 0) {
      throw new BadRequestException('Company name is required');
    }

    const exists = await this.userService.checkCompanyNameExists(
      companyName.trim(),
    );

    return {
      success: true,
      available: !exists,
      message: exists
        ? 'Company name is already taken'
        : 'Company name is available',
    };
  }
}

import {
  Controller,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  HttpStatus,
  HttpCode,
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
}

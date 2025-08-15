import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { User } from '../interfaces/user';
import {
  UpdateNotificationPreferenceDto,
  UpdateMultipleNotificationPreferencesDto,
  UpdateNotificationSettingsDto,
  NotificationPreferencesResponse,
  NotificationPreferenceResponse,
  NotificationSettingsResponse,
} from '../interfaces/notification-preferences';

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

  /**
   * Get user notification preferences
   * Input:
   *   - Param: userId (string, required) - User ID
   * Responses:
   *   - 200 OK: { success: true, preferences: NotificationPreference[] }
   *   - 400 Bad Request: User ID is required
   *   - 404 Not Found: User not found
   */
  @Get(':userId/notifications/preferences')
  @HttpCode(HttpStatus.OK)
  async getNotificationPreferences(
    @Param('userId') userId: string,
  ): Promise<NotificationPreferencesResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const preferences = await this.userService.getNotificationPreferences(
        userId.trim(),
      );

      return {
        success: true,
        preferences: preferences.map((pref) => ({
          id: pref.id,
          userId: pref.userId,
          notificationType: pref.notificationType,
          emailEnabled: pref.emailEnabled,
          smsEnabled: pref.smsEnabled,
          pushEnabled: pref.pushEnabled,
          inAppEnabled: pref.inAppEnabled,
          createdAt: pref.createdAt,
          updatedAt: pref.updatedAt,
        })),
        message: 'Notification preferences retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Update notification preference for a specific notification type
   * Input:
   *   - Param: userId (string, required) - User ID
   *   - Body: UpdateNotificationPreferenceDto
   * Responses:
   *   - 200 OK: { success: true, preference: NotificationPreference }
   *   - 400 Bad Request: Invalid input
   *   - 404 Not Found: User not found
   */
  @Put(':userId/notifications/preferences')
  @HttpCode(HttpStatus.OK)
  async updateNotificationPreference(
    @Param('userId') userId: string,
    @Body() updateData: UpdateNotificationPreferenceDto,
  ): Promise<NotificationPreferenceResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    if (!updateData.notificationType) {
      throw new BadRequestException('Notification type is required');
    }

    try {
      const preference = await this.userService.updateNotificationPreference(
        userId.trim(),
        updateData.notificationType,
        {
          emailEnabled: updateData.emailEnabled,
          smsEnabled: updateData.smsEnabled,
          pushEnabled: updateData.pushEnabled,
          inAppEnabled: updateData.inAppEnabled,
        },
      );

      return {
        success: true,
        preference: {
          id: preference.id,
          userId: preference.userId,
          notificationType: preference.notificationType,
          emailEnabled: preference.emailEnabled,
          smsEnabled: preference.smsEnabled,
          pushEnabled: preference.pushEnabled,
          inAppEnabled: preference.inAppEnabled,
          createdAt: preference.createdAt,
          updatedAt: preference.updatedAt,
        },
        message: 'Notification preference updated successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update notification preference');
    }
  }

  /**
   * Update multiple notification preferences at once
   * Input:
   *   - Param: userId (string, required) - User ID
   *   - Body: UpdateMultipleNotificationPreferencesDto
   * Responses:
   *   - 200 OK: { success: true, preferences: NotificationPreference[] }
   *   - 400 Bad Request: Invalid input
   *   - 404 Not Found: User not found
   */
  @Put(':userId/notifications/preferences/bulk')
  @HttpCode(HttpStatus.OK)
  async updateMultipleNotificationPreferences(
    @Param('userId') userId: string,
    @Body() updateData: UpdateMultipleNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    if (
      !updateData.preferences ||
      !Array.isArray(updateData.preferences) ||
      updateData.preferences.length === 0
    ) {
      throw new BadRequestException(
        'Preferences array is required and must not be empty',
      );
    }

    // Validate each preference
    for (const pref of updateData.preferences) {
      if (!pref.notificationType) {
        throw new BadRequestException(
          'Each preference must have a notification type',
        );
      }
    }

    try {
      const preferences =
        await this.userService.updateMultipleNotificationPreferences(
          userId.trim(),
          updateData.preferences,
        );

      return {
        success: true,
        preferences: preferences.map((pref) => ({
          id: pref.id,
          userId: pref.userId,
          notificationType: pref.notificationType,
          emailEnabled: pref.emailEnabled,
          smsEnabled: pref.smsEnabled,
          pushEnabled: pref.pushEnabled,
          inAppEnabled: pref.inAppEnabled,
          createdAt: pref.createdAt,
          updatedAt: pref.updatedAt,
        })),
        message: 'Notification preferences updated successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update notification preferences',
      );
    }
  }

  /**
   * Reset notification preferences to default values
   * Input:
   *   - Param: userId (string, required) - User ID
   * Responses:
   *   - 200 OK: { success: true, preferences: NotificationPreference[] }
   *   - 400 Bad Request: User ID is required
   *   - 404 Not Found: User not found
   */
  @Post(':userId/notifications/preferences/reset')
  @HttpCode(HttpStatus.OK)
  async resetNotificationPreferences(
    @Param('userId') userId: string,
  ): Promise<NotificationPreferencesResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const preferences = await this.userService.resetNotificationPreferences(
        userId.trim(),
      );

      return {
        success: true,
        preferences: preferences.map((pref) => ({
          id: pref.id,
          userId: pref.userId,
          notificationType: pref.notificationType,
          emailEnabled: pref.emailEnabled,
          smsEnabled: pref.smsEnabled,
          pushEnabled: pref.pushEnabled,
          inAppEnabled: pref.inAppEnabled,
          createdAt: pref.createdAt,
          updatedAt: pref.updatedAt,
        })),
        message: 'Notification preferences reset to default values',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to reset notification preferences');
    }
  }

  /**
   * Get user's general notification settings (quiet hours, global enable/disable)
   * Input:
   *   - Param: userId (string, required) - User ID
   * Responses:
   *   - 200 OK: { success: true, settings: UserNotificationSettings }
   *   - 400 Bad Request: User ID is required
   *   - 404 Not Found: User not found
   */
  @Get(':userId/notifications/settings')
  @HttpCode(HttpStatus.OK)
  async getNotificationSettings(
    @Param('userId') userId: string,
  ): Promise<NotificationSettingsResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const settings = await this.userService.getNotificationSettings(
        userId.trim(),
      );

      return {
        success: true,
        settings,
        message: 'Notification settings retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Update user's general notification settings
   * Input:
   *   - Param: userId (string, required) - User ID
   *   - Body: UpdateNotificationSettingsDto
   * Responses:
   *   - 200 OK: { success: true, settings: UserNotificationSettings }
   *   - 400 Bad Request: Invalid input
   *   - 404 Not Found: User not found
   */
  @Put(':userId/notifications/settings')
  @HttpCode(HttpStatus.OK)
  async updateNotificationSettings(
    @Param('userId') userId: string,
    @Body() updateData: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsResponse> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('User ID is required');
    }

    // Validate quiet hours format if provided
    if (
      updateData.quietHoursStart &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.quietHoursStart)
    ) {
      throw new BadRequestException(
        'Quiet hours start must be in HH:MM format',
      );
    }

    if (
      updateData.quietHoursEnd &&
      !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.quietHoursEnd)
    ) {
      throw new BadRequestException('Quiet hours end must be in HH:MM format');
    }

    try {
      const settings = await this.userService.updateNotificationSettings(
        userId.trim(),
        updateData,
      );

      return {
        success: true,
        settings,
        message: 'Notification settings updated successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update notification settings');
    }
  }
}

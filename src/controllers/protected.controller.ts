import { Controller, Get } from '@nestjs/common';
import { User } from '../auth/user.decorator';

@Controller('protected')
export class ProtectedController {
  @Get('profile')
  getProfile(@User() user: any) {
    return {
      message: 'This is a protected route',
      user: user,
    };
  }

  @Get('user-id')
  getUserId(@User('uid') uid: string) {
    return {
      message: 'User ID extracted from token',
      uid: uid,
    };
  }

  @Get('email')
  getUserEmail(@User('email') email: string) {
    return {
      message: 'User email extracted from token',
      email: email,
    };
  }
}

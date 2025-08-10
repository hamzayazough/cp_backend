import { Module } from '@nestjs/common';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { FirebaseAuthMiddleware } from './firebase-auth.middleware';
import { UserModule } from '../modules/user.module';

@Module({
  imports: [UserModule],
  providers: [FirebaseAuthService, FirebaseAuthMiddleware],
  exports: [FirebaseAuthService, FirebaseAuthMiddleware],
})
export class AuthModule {}

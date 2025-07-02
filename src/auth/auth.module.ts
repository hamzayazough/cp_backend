import { Module } from '@nestjs/common';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { FirebaseAuthMiddleware } from './firebase-auth.middleware';

@Module({
  providers: [FirebaseAuthService, FirebaseAuthMiddleware],
  exports: [FirebaseAuthService, FirebaseAuthMiddleware],
})
export class AuthModule {}

import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FirebaseAuthService } from '../services/firebase-auth.service';
import { UserService } from '../services/user.service';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

@Injectable()
export class FirebaseAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly userService: UserService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('No valid authorization header found');
      }

      const idToken = authHeader.split('Bearer ')[1];

      if (!idToken) {
        throw new UnauthorizedException('No token provided');
      }

      const firebaseUser =
        await this.firebaseAuthService.verifyIdToken(idToken);

      const userInfo = this.firebaseAuthService.extractUserInfo(firebaseUser);

      // Fetch database user to get additional properties like role
      try {
        const dbUser = await this.userService.getUserByFirebaseUid(
          firebaseUser.uid,
        );

        // Combine Firebase user info with database user properties
        req.user = {
          ...userInfo,
          id: dbUser.id,
          role: dbUser.role,
          // Add other database properties as needed
        };
      } catch {
        // If database user not found, still allow authentication with Firebase info only
        req.user = userInfo;
      }

      next();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException(`Authentication failed: ${errorMessage}`);
    }
  }
}

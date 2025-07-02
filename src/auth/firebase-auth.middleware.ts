import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FirebaseAuthService } from '../services/firebase-auth.service';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

@Injectable()
export class FirebaseAuthMiddleware implements NestMiddleware {
  constructor(private readonly firebaseAuthService: FirebaseAuthService) {}

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

      req.user = userInfo;

      next();
    } catch (error) {
      throw new UnauthorizedException(
        `Authentication failed: ${error.message}`,
      );
    }
  }
}

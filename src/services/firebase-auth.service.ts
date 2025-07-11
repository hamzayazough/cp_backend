import { Injectable } from '@nestjs/common';
import { auth } from '../config/firebase.config';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';

@Injectable()
export class FirebaseAuthService {
  /**
   * Verify Firebase ID token and get user data
   * @param idToken - Firebase ID token from client
   * @returns Promise with user record or throws error
   */
  async verifyIdToken(idToken: string): Promise<UserRecord> {
    try {
      const decodedToken: DecodedIdToken = await auth.verifyIdToken(idToken);
      const userRecord: UserRecord = await auth.getUser(decodedToken.uid);
      return userRecord;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Extract user information from Firebase user data
   * @param firebaseUser - Firebase user object
   * @returns User information object
   */
  extractUserInfo(firebaseUser: UserRecord) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified,
      displayName: firebaseUser.displayName || null,
      photoURL: firebaseUser.photoURL || null,
      disabled: firebaseUser.disabled,
      providerData: firebaseUser.providerData || [],
      customClaims: firebaseUser.customClaims || {},
      createdAt: firebaseUser.metadata.creationTime,
      lastLoginAt: firebaseUser.metadata.lastSignInTime,
    };
  }
}

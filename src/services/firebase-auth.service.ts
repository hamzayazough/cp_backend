import { Injectable } from '@nestjs/common';

@Injectable()
export class FirebaseAuthService {
  constructor() {}

  /**
   * Verify Firebase ID token
   * @param idToken - Firebase ID token from client
   * @returns Promise with decoded token or throws error
   */
  async verifyIdToken(idToken: string) {
    try {
      // For server-side verification, we need Firebase Admin SDK
      // But for now, we'll use a basic verification approach
      // In production, you should use Firebase Admin SDK
      const response = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken: idToken,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const data = await response.json();

      if (!data.users || data.users.length === 0) {
        throw new Error('User not found');
      }

      return data.users[0];
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Extract user information from Firebase user data
   * @param firebaseUser - Firebase user object
   * @returns User information object
   */
  extractUserInfo(firebaseUser: any) {
    return {
      uid: firebaseUser.localId,
      email: firebaseUser.email,
      emailVerified: firebaseUser.emailVerified === 'true',
      displayName: firebaseUser.displayName || null,
      photoURL: firebaseUser.photoUrl || null,
      disabled: firebaseUser.disabled || false,
      providerData: firebaseUser.providerUserInfo || [],
      customClaims: firebaseUser.customAttributes
        ? JSON.parse(firebaseUser.customAttributes)
        : {},
      createdAt: firebaseUser.createdAt,
      lastLoginAt: firebaseUser.lastLoginAt,
    };
  }
}

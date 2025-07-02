export interface FirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  providerData: any[];
  customClaims: Record<string, any>;
  createdAt: string;
  lastLoginAt: string;
}

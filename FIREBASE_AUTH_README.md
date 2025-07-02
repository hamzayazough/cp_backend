# Firebase Authentication Setup

This project includes Firebase authentication with token validation middleware for your NestJS backend.

## Setup

1. **Environment Variables**: Copy `.env.example` to `.env` and fill in your Firebase configuration:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your actual Firebase values:

   ```
   FIREBASE_API_KEY=your_firebase_api_key_here
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

2. **Firebase Config**: The Firebase configuration is set up in `src/config/firebase.config.ts` and automatically reads from environment variables.

## Usage

### Protected Routes

Routes under `/protected` are automatically protected by the Firebase authentication middleware. To access these routes, include the Firebase ID token in the Authorization header:

```
Authorization: Bearer YOUR_FIREBASE_ID_TOKEN
```

### Example Endpoints

- `GET /protected/profile` - Returns user profile information
- `GET /protected/user-id` - Returns just the user ID
- `GET /protected/email` - Returns just the user email

### Using the User Decorator

You can extract user information in your controllers using the `@User()` decorator:

```typescript
import { Controller, Get } from '@nestjs/common';
import { User } from '../auth/user.decorator';

@Controller('api')
export class MyController {
  @Get('user')
  getUser(@User() user: FirebaseUser) {
    return user;
  }

  @Get('user-email')
  getUserEmail(@User('email') email: string) {
    return { email };
  }
}
```

### Adding Authentication to More Routes

To protect additional routes, modify the middleware configuration in `app.module.ts`:

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(FirebaseAuthMiddleware)
    .forRoutes('protected', 'api', 'admin'); // Add more route patterns as needed
}
```

## Client-Side Integration

From your frontend (React, Vue, etc.), obtain the Firebase ID token and include it in your requests:

```javascript
// Get the current user's ID token
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();

// Make API request with token
fetch('/protected/profile', {
  headers: {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  },
});
```

## Important Notes

1. **Production Setup**: For production use, consider implementing Firebase Admin SDK for more robust token verification
2. **Token Refresh**: Firebase ID tokens expire after 1 hour. Make sure your client refreshes tokens automatically
3. **Error Handling**: The middleware returns 401 Unauthorized for invalid or missing tokens
4. **CORS**: Make sure to configure CORS if your frontend is on a different domain

## Files Structure

```
src/
├── auth/
│   ├── auth.module.ts              # Auth module
│   ├── firebase-auth.middleware.ts # Authentication middleware
│   └── user.decorator.ts           # User parameter decorator
├── config/
│   └── firebase.config.ts          # Firebase configuration
├── controllers/
│   └── protected.controller.ts     # Example protected controller
├── interfaces/
│   └── firebase-user.interface.ts  # User interface
└── services/
    └── firebase-auth.service.ts    # Firebase authentication service
```

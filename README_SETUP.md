# CrowdProp Backend - Database & Authentication Setup

This guide will help you set up the complete backend system with PostgreSQL database and Firebase authentication.

## Quick Start

### 1. Environment Setup

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=crowdprop
DATABASE_USER=crowdprop_user
DATABASE_PASSWORD=crowdprop_password
```

### 2. Start the Database

Start PostgreSQL with Docker Compose:

```bash
docker-compose up -d postgres
```

The database will be automatically initialized with the schema from `database/init.sql`.

### 3. Install Dependencies and Start the Backend

```bash
npm install
npm run start:dev
```

## API Endpoints

### Authentication Endpoints

#### Check Username Availability (Public)

```http
GET /auth/check-username?name=desired_username
```

Response:

```json
{
  "available": true,
  "exists": false
}
```

#### Create Account (Protected - Requires Firebase Auth)

```http
POST /auth/create-account
Authorization: Bearer <firebase_id_token>
Content-Type: application/json

{
  "name": "john_doe",
  "role": "PROMOTER",
  "bio": "I'm a social media influencer",
  "promoterDetails": {
    "location": "New York, NY",
    "languagesSpoken": ["ENGLISH", "SPANISH"],
    "skills": ["Video Editing", "Content Creation"],
    "followerEstimates": [
      {
        "platform": "TIKTOK",
        "count": 50000
      },
      {
        "platform": "INSTAGRAM",
        "count": 25000
      }
    ],
    "works": [
      {
        "title": "My Latest Campaign",
        "description": "A successful brand collaboration",
        "mediaUrl": "https://s3.amazonaws.com/my-video.mp4"
      }
    ]
  }
}
```

For Advertisers:

```json
{
  "name": "acme_corp",
  "role": "ADVERTISER",
  "bio": "Leading tech company",
  "advertiserDetails": {
    "companyName": "Acme Corporation",
    "advertiserTypes": ["TECH", "ECOMMERCE"],
    "companyWebsite": "https://acme.com"
  }
}
```

#### Get User Profile (Protected)

```http
GET /auth/profile
Authorization: Bearer <firebase_id_token>
```

#### Get User by ID (Public)

```http
GET /auth/user?id=uuid
```

### Protected Routes Examples

```http
GET /protected/profile
Authorization: Bearer <firebase_id_token>
```

## Database Management

### Using pgAdmin (Optional)

If you started the full Docker Compose stack, pgAdmin is available at:

- URL: http://localhost:5050
- Email: admin@crowdprop.com
- Password: admin123

Connect to database:

- Host: postgres
- Port: 5432
- Database: crowdprop
- Username: crowdprop_user
- Password: crowdprop_password

### Manual Database Connection

```bash
# Connect directly to PostgreSQL
docker exec -it crowdprop_postgres psql -U crowdprop_user -d crowdprop
```

## Database Schema

The database includes the following main tables:

- `users` - Main user information
- `advertiser_details` - Advertiser-specific data
- `advertiser_type_mappings` - Advertiser business types
- `promoter_details` - Promoter-specific data
- `promoter_languages` - Languages spoken by promoters
- `promoter_skills` - Promoter skills
- `follower_estimates` - Social media follower counts
- `promoter_works` - Portfolio/work samples

## Development Commands

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Run tests
npm test

# Start database only
docker-compose up -d postgres

# Start database with pgAdmin
docker-compose up -d

# View database logs
docker-compose logs postgres

# Stop and remove containers
docker-compose down

# Reset database (WARNING: This will delete all data)
docker-compose down -v
docker-compose up -d postgres
```

## Frontend Integration Example

```javascript
// Get Firebase ID token
const user = firebase.auth().currentUser;
const idToken = await user.getIdToken();

// Check username availability
const checkUsername = async (username) => {
  const response = await fetch(`/auth/check-username?name=${username}`);
  const data = await response.json();
  return data.available;
};

// Create account
const createAccount = async (accountData) => {
  const response = await fetch('/auth/create-account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(accountData),
  });
  return response.json();
};

// Get user profile
const getProfile = async () => {
  const response = await fetch('/auth/profile', {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  return response.json();
};
```

## Production Considerations

1. **Environment Variables**: Use proper secrets management
2. **Database**: Use managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
3. **Firebase Admin SDK**: Consider using Firebase Admin SDK for server-side token verification
4. **Migrations**: Use TypeORM migrations instead of schema synchronization
5. **Logging**: Implement proper logging and monitoring
6. **Rate Limiting**: Add rate limiting to API endpoints
7. **Input Validation**: Add comprehensive input validation with class-validator

## Troubleshooting

### Database Connection Issues

1. Ensure Docker is running
2. Check if port 5432 is available
3. Verify environment variables in `.env`

### Authentication Issues

1. Verify Firebase configuration
2. Check that Firebase ID token is valid and not expired
3. Ensure proper Authorization header format: `Bearer <token>`

### TypeScript Errors

Some TypeScript warnings are expected due to TypeORM's reflection-based approach. These don't affect functionality in development.

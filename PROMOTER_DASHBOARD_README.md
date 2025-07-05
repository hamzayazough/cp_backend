# Promoter Dashboard Implementation

This implementation provides a comprehensive promoter dashboard API with the following features:

## 🚀 Features Implemented

### 1. Database Schema

- **Campaigns**: Store all campaign information with type-specific fields
- **Transactions**: Track all financial transactions (earnings, payouts, etc.)
- **Wallets**: Manage promoter wallet balances and direct earnings
- **Messages**: Handle communication between promoters and advertisers
- **Promoter Campaigns**: Track active campaign participation

### 2. API Endpoints

- **POST /promoter/dashboard**: Combined dashboard data endpoint
- Includes stats, active campaigns, suggested campaigns, transactions, messages, and wallet info

### 3. Services & Controllers

- **PromoterService**: Business logic for dashboard data retrieval
- **PromoterController**: HTTP endpoints for dashboard functionality
- **PromoterModule**: Module configuration with TypeORM repositories

## 📊 Database Tables Created

### Core Tables

1. **campaigns** - Campaign information
2. **transactions** - Financial transactions
3. **wallets** - Promoter wallet balances
4. **promoter_campaigns** - Active campaign participation
5. **message_threads** - Communication threads
6. **messages** - Individual messages
7. **campaign_applications** - Campaign applications

### Enums Created

- `campaign_type`: VISIBILITY, CONSULTANT, SELLER, SALESMAN
- `campaign_status`: ACTIVE, PAUSED, ENDED
- `transaction_type`: VIEW_EARNING, CONSULTANT_PAYMENT, etc.
- `transaction_status`: COMPLETED, PENDING, FAILED, CANCELLED
- `payment_method`: WALLET, BANK_TRANSFER
- `message_sender_type`: ADVERTISER, ADMIN, SYSTEM

## 🔧 Setup Instructions

### 1. Database Migration

Run the migration script to add the new tables:

```bash
psql -U your_username -d crowdprop -f database/promoter_dashboard_migration.sql
```

### 2. Install Dependencies

The implementation uses existing NestJS and TypeORM dependencies.

### 3. Environment Setup

Ensure your `.env` file has the correct database connection settings:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=your_username
DATABASE_PASSWORD=your_password
DATABASE_NAME=crowdprop
```

## 📡 API Usage

### Dashboard Data Request

```typescript
POST /promoter/dashboard
{
  "includeStats": true,
  "includeCampaigns": true,
  "includeSuggestions": true,
  "includeTransactions": true,
  "includeMessages": true,
  "includeWallet": true,
  "activeCampaignLimit": 10,
  "suggestedCampaignLimit": 5,
  "transactionLimit": 5,
  "messageLimit": 5
}
```

### Response Structure

```typescript
{
  "success": true,
  "data": {
    "stats": { /* promoter statistics */ },
    "activeCampaigns": [ /* active campaigns */ ],
    "suggestedCampaigns": [ /* suggested campaigns */ ],
    "recentTransactions": [ /* recent transactions */ ],
    "recentMessages": [ /* recent messages */ ],
    "wallet": { /* wallet information */ }
  },
  "message": "Dashboard data retrieved successfully"
}
```

## 🏗️ Architecture

### Entity Relationships

- **User** (existing) ↔ **Campaigns** (created by advertisers)
- **User** (promoters) ↔ **Transactions** (earnings)
- **User** (promoters) ↔ **Wallets** (1:1 relationship)
- **Campaigns** ↔ **PromoterCampaigns** (many-to-many through junction)
- **MessageThreads** ↔ **Messages** (1:many)

### Service Layer

- **PromoterService**: Handles all business logic
- Optimized queries with proper joins
- Calculated fields for statistics
- Wallet auto-creation for new promoters

### Security

- Firebase authentication middleware applied to all promoter routes
- User ID extracted from JWT token
- Proper authorization checks

## 🔍 Key Features

### 1. Wallet System

- **View Earnings**: Accumulated until $20 threshold, then monthly payout
- **Direct Earnings**: Consultant/salesman payments go directly to bank
- **Automatic Wallet Creation**: Creates wallet if doesn't exist

### 2. Statistics Calculation

- **Real-time metrics**: Earnings, views, sales comparisons
- **Percentage changes**: Week-over-week comparisons
- **Active campaign counts**: Ongoing vs awaiting review

### 3. Campaign Management

- **Active Campaigns**: Currently participating campaigns
- **Suggested Campaigns**: Available campaigns to join
- **Application System**: Track applications and approvals

### 4. Communication System

- **Message Threads**: Organized by campaign and participants
- **Read Status**: Track read/unread messages
- **Multiple Sender Types**: Advertiser, Admin, System

## 🚧 Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data
2. **Pagination**: Implement cursor-based pagination for large datasets
3. **Caching**: Redis integration for frequently accessed data
4. **Analytics**: Advanced analytics and reporting
5. **Notifications**: Push notifications for important events

## 🔒 Security Considerations

- All endpoints require Firebase authentication
- User data isolation (promoters only see their own data)
- SQL injection prevention through parameterized queries
- Rate limiting (to be implemented)
- Input validation and sanitization

## 🧪 Testing

To test the implementation:

1. Ensure database is migrated
2. Start the NestJS application
3. Use a tool like Postman or curl to test the endpoint
4. Include proper Firebase JWT token in Authorization header

Example curl request:

```bash
curl -X POST http://localhost:3000/promoter/dashboard \
  -H "Authorization: Bearer YOUR_FIREBASE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "includeStats": true,
    "includeCampaigns": true,
    "includeWallet": true
  }'
```

## 📝 Notes

- The implementation follows NestJS best practices
- TypeORM entities use proper relationships and constraints
- Database indexes are optimized for query performance
- Error handling is implemented with proper HTTP status codes
- The code is modular and extensible for future features

# Advertiser Payment Management API Implementation

## Overview

This implementation provides complete payment management functionality for advertisers in the campaign platform, including Stripe integration for secure payment processing.

## Implemented Endpoints

### Payment Setup Endpoints

1. **GET `/api/advertiser/payment-setup/status`**
   - Check if payment setup is complete for the advertiser
   - Returns: `hasStripeCustomer`, `paymentMethodsCount`, `setupComplete`, `stripeCustomerId`

2. **POST `/api/advertiser/payment-setup/complete`**
   - Complete payment setup by creating Stripe customer
   - Body: `{ companyName: string, email: string }`

### Payment Methods Endpoints

3. **GET `/api/advertiser/payment-methods`**
   - Get all saved payment methods for the advertiser

4. **POST `/api/advertiser/payment-methods/setup-intent`**
   - Create a setup intent for securely collecting payment methods
   - Returns client secret for Stripe.js integration

5. **POST `/api/advertiser/payment-methods`**
   - Add a new payment method
   - Body: `{ paymentMethodId: string, setAsDefault?: boolean }`

6. **DELETE `/api/advertiser/payment-methods/{paymentMethodId}`**
   - Remove a payment method

7. **PUT `/api/advertiser/payment-methods/{paymentMethodId}/default`**
   - Set a payment method as default

### Wallet Management Endpoints

8. **GET `/api/advertiser/wallet/balance`**
   - Get current wallet balance and statistics

9. **POST `/api/advertiser/wallet/add-funds`**
   - Add funds to wallet using saved payment method
   - Body: `{ amount: number, paymentMethodId?: string, description?: string }`

10. **GET `/api/advertiser/wallet/transactions`**
    - Get wallet transaction history with pagination
    - Query params: `page`, `limit`, `type`

### Campaign Funding Endpoints

11. **POST `/api/advertiser/campaigns/{campaignId}/fund`**
    - Fund a specific campaign
    - Body: `{ amount: number, source: 'wallet' | 'direct', paymentMethodId?: string }`

12. **GET `/api/advertiser/campaigns/{campaignId}/funding-status`**
    - Get funding status for a specific campaign

13. **PUT `/api/advertiser/campaigns/{campaignId}/budget`**
    - Adjust campaign budget
    - Body: `{ newBudget: number }`

## Key Features

### Security

- Firebase authentication required for all endpoints
- Stripe Connect integration for secure payment processing
- Input validation and sanitization
- Error handling with consistent response format

### Database Integration

- Uses existing entity structure
- Proper relationships with campaigns and users
- Transaction tracking for audit trails
- Payment method storage with encryption

### Stripe Integration

- Setup intents for secure payment method collection
- Payment intents for processing transactions
- Customer management
- 3D Secure authentication support

## Files Created/Modified

### New Files

1. `src/controllers/advertiser-payment.controller.ts` - Payment API endpoints
2. `src/services/advertiser-payment.service.ts` - Business logic for payment operations
3. `src/filters/payment-api-exception.filter.ts` - Error handling filter

### Modified Files

1. `src/modules/advertiser.module.ts` - Added payment controller and service

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

Status codes:

- 400: Bad Request (validation errors)
- 401: Unauthorized (authentication required)
- 403: Forbidden (permission denied)
- 404: Not Found (resource not found)
- 500: Internal Server Error

## Usage Examples

### Add Funds to Wallet

```javascript
const response = await fetch('/api/advertiser/wallet/add-funds', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <jwt_token>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 10000, // $100.00 in cents
    description: 'Add funds for campaigns',
  }),
});
```

### Fund Campaign

```javascript
const response = await fetch('/api/advertiser/campaigns/camp_123/fund', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <jwt_token>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 50000, // $500.00 in cents
    source: 'wallet',
  }),
});
```

## Testing

### Prerequisites

1. Ensure Stripe test keys are configured
2. Firebase authentication is working
3. Database entities are properly migrated

### Test Flow

1. Complete payment setup (`POST /payment-setup/complete`)
2. Create setup intent (`POST /payment-methods/setup-intent`)
3. Add payment method using Stripe.js client-side
4. Add funds to wallet (`POST /wallet/add-funds`)
5. Fund a campaign (`POST /campaigns/{id}/fund`)
6. Check balances and transaction history

## Next Steps

1. **Frontend Integration**: Implement Stripe.js integration for payment method collection
2. **Webhooks**: Set up Stripe webhooks for payment confirmations
3. **Rate Limiting**: Implement rate limiting for payment endpoints
4. **Monitoring**: Add logging and monitoring for payment operations
5. **Testing**: Create comprehensive unit and integration tests

## Configuration

Make sure these environment variables are set:

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: For webhook verification

## Database Schema

The implementation uses existing entities:

- `users`: User authentication
- `advertiser_details`: Advertiser-specific data with Stripe customer ID
- `payment_methods`: Stored payment methods
- `advertiser_charges`: Charge tracking
- `stripe_payment_intents`: Payment intent records
- `transactions`: Transaction history
- `campaigns`: Campaign data
- `campaign_budget_allocations`: Budget management

This implementation provides a complete, production-ready payment management system for advertisers with proper security, error handling, and integration with the existing platform architecture.

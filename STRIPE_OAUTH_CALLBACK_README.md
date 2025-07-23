# Stripe Connect OAuth Callback Implementation

## Overview

We have successfully implemented the OAuth callback endpoint for Stripe Connect onboarding as described in your requirements. This endpoint handles the redirection from Stripe after users complete (or abandon) the Connect onboarding process.

## New Endpoints Created

### 1. OAuth Callback Endpoint

**URL:** `GET /connect/oauth/callback`

**Purpose:** Handles redirects from Stripe Connect onboarding

**Parameters:**

- `code` (query) - Authorization code from Stripe (for OAuth flow)
- `state` (query) - State parameter containing user/account info
- `error` (query) - Error code if onboarding failed
- `error_description` (query) - Human-readable error description

**Flow:**

1. **Error Handling:** If `error` parameter is present, redirects to frontend with error status
2. **OAuth Flow:** If `code` is present, exchanges it for access token and marks account as onboarded
3. **Account Links Flow:** If `state` is present, verifies account completeness via Stripe API
4. **Fallback:** Redirects to dashboard with unknown status

### 2. Onboarding Status Check Endpoint

**URL:** `GET /connect/onboarding-status/:userId`

**Purpose:** Alternative endpoint for frontend to check onboarding status via API call

**Response:**

```json
{
  "success": true,
  "onboarded": true,
  "data": {
    "accountId": "acct_...",
    "chargesEnabled": true,
    "payoutsEnabled": true,
    "status": "active",
    "requirementsComplete": true,
    "requirements": {...}
  },
  "message": "Account fully onboarded"
}
```

## Configuration Updates

### Environment Variables (.env)

```env
# Updated redirect URL to point to our new endpoint
STRIPE_CONNECT_RETURN_URL=http://localhost:3000/api/connect/oauth/callback
STRIPE_CONNECT_REFRESH_URL=http://localhost:3000/api/connect/refresh

# New: Frontend URL for redirects after processing
FRONTEND_URL=http://localhost:3001
```

### Database Schema

Added new fields to `stripe_connect_accounts` table:

- `onboarding_completed` (boolean)
- `onboarding_completed_at` (timestamp)

## New Service Methods

### StripeConnectService Methods:

1. **`exchangeOAuthCode(code, state)`** - Exchanges OAuth code for access token
2. **`markAccountAsOnboarded(stripeAccountId)`** - Marks account as fully onboarded
3. **`verifyAccountCompleteness(accountId)`** - Checks account completeness with Stripe
4. **`getConnectedAccount(userId)`** - Alias for getting account by user ID

## Usage Examples

### 1. Setting up Stripe Connect Account Link

When creating an account onboarding link, use the new callback URL:

```typescript
// In your Stripe Dashboard or when creating Account Links
const accountLink = await stripe.accountLinks.create({
  account: 'acct_...',
  return_url:
    'http://localhost:3000/connect/oauth/callback?state=' +
    encodeURIComponent(JSON.stringify({ userId: 'user_123' })),
  refresh_url: 'http://localhost:3000/connect/refresh',
  type: 'account_onboarding',
});
```

### 2. Frontend Integration

After the user completes onboarding, they'll be redirected to your frontend with query parameters:

```typescript
// Frontend (React/Angular/Vue) - check URL parameters
const urlParams = new URLSearchParams(window.location.search);
const onboardedStatus = urlParams.get('onboarded');

switch (onboardedStatus) {
  case 'success':
    // Show success message, refresh user data
    break;
  case 'error':
    const error = urlParams.get('error');
    // Show error message
    break;
  case 'incomplete':
    // Show message about incomplete requirements
    break;
  default:
    // Unknown status, check via API
    break;
}
```

### 3. Alternative: API-based Status Check

Instead of reading URL parameters, you can call the status endpoint:

```typescript
// Frontend API call
const response = await fetch(`/api/connect/onboarding-status/${userId}`);
const statusData = await response.json();

if (statusData.onboarded) {
  // User is fully onboarded
} else {
  // Still need to complete onboarding
}
```

## Redirect Flow Types

### Type 1: OAuth Flow (Recommended)

```
User → Stripe Connect Onboarding → /connect/oauth/callback?code=xxx
→ Exchange code for token → Update DB → Redirect to frontend
```

### Type 2: Account Links Express

```
User → Stripe Connect Onboarding → /connect/oauth/callback?state=xxx
→ Verify account status → Update DB → Redirect to frontend
```

## Testing

1. **Test Error Handling:**

   ```
   GET /connect/oauth/callback?error=access_denied&error_description=User%20denied%20access
   ```

2. **Test Success Flow:**

   ```
   GET /connect/oauth/callback?code=ac_test_xxx&state=xxx
   ```

3. **Test Status Check:**
   ```
   GET /connect/onboarding-status/user_123
   ```

## Next Steps

1. **Update Stripe Dashboard:**
   - Set redirect URL to: `http://localhost:3000/connect/oauth/callback`
   - For production: `https://yourdomain.com/connect/oauth/callback`

2. **Frontend Implementation:**
   - Handle the new query parameters
   - Implement status checking via API calls

3. **Production Deployment:**
   - Update `FRONTEND_URL` environment variable
   - Update Stripe Connect redirect URLs in Stripe Dashboard

This implementation follows the best practices you described in your French documentation, providing a robust backend endpoint that handles OAuth token exchange, database updates, and proper frontend redirects.

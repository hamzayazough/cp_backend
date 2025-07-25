# Payment Controller Endpoints Documentation

This document explains each endpoint in the Payment Controller and when to use them in the campaign platform.

## Overview

The Payment Controller handles the complete payment lifecycle:

- **Advertiser Funding**: Creating and confirming payments from advertisers
- **Promoter Payouts**: Transferring funds to promoters via Stripe Connect
- **Campaign Configuration**: Setting up payment terms and rates
- **Fee Management**: Calculating platform and processing fees

## Payment Intent Endpoints (Advertiser Funding)

### `POST /stripe/payments/intent`

**Purpose**: Create a payment intent when an advertiser wants to fund a campaign

**When to use**:

- Advertiser creates a new campaign and needs to fund it
- Advertiser wants to add more budget to an existing campaign
- Initial step in the payment flow before actual charge

**Request Body**:

```typescript
{
  campaignId: string;
  payerId: string;        // Advertiser's user ID
  recipientId: string;    // Can be promoter ID or platform ID
  amount: number;         // Amount in cents
  description?: string;
  metadata?: Record<string, string>;
}
```

**Example Scenario**:
Advertiser creates a visibility campaign with $500 budget - this endpoint creates the payment intent but doesn't charge yet.

**Response**: Payment intent object with client_secret for frontend confirmation

---

### `POST /stripe/payments/intent/:paymentIntentId/confirm`

**Purpose**: Confirm and charge the advertiser's payment method

**When to use**:

- After payment intent is created, this actually charges the advertiser
- Requires payment method ID (card/bank account)
- Completes the funding process

**Request Body**:

```typescript
{
  paymentMethodId: string;  // Stripe payment method ID
  returnUrl?: string;       // For 3D Secure redirects
}
```

**Example Scenario**:
Advertiser enters card details and clicks "Fund Campaign" - this charges their card.

**Response**: Confirmed payment intent with status

---

### `POST /stripe/payments/intent/:paymentIntentId/capture`

**Purpose**: Capture a previously authorized payment (for auth-then-capture flow)

**When to use**:

- When using two-step payments (authorize first, capture later)
- Useful for campaigns where you want to hold funds but not charge immediately
- Can capture partial amounts

**Request Body**:

```typescript
{
  amountToCapture?: number;  // Optional, captures full amount if not specified
}
```

**Example Scenario**:
For consultant campaigns, authorize full budget but only capture as work is completed.

---

### `GET /stripe/payments/intent/:paymentIntentId`

**Purpose**: Retrieve payment intent details and status

**When to use**:

- Check if advertiser payment was successful
- Get payment status for UI updates
- Debugging payment issues

**Response**: Complete payment intent object with current status

## Transfer Endpoints (Promoter Payouts)

### `POST /stripe/payments/transfer`

**Purpose**: Transfer money from held funds to a promoter's Stripe Connect account

**When to use**:

- Monthly payouts for visibility campaigns (if >$20)
- Final payments for consultant/seller campaigns
- Commission payouts for salesman campaigns

**Request Body**:

```typescript
{
  paymentIntentId: string;      // Source payment intent
  destinationAccountId: string; // Promoter's Stripe Connect account
  amount: number;               // Amount in cents
  description?: string;
  metadata?: Record<string, string>;
}
```

**Example Scenarios**:

- End of month: Transfer $85 to promoter who generated 2,850 views at $3/100 views
- Consultant project: Transfer $500 final payment upon work completion
- Salesman commission: Transfer $120 monthly commission for sales generated

---

### `GET /stripe/payments/intent/:paymentIntentId/transfers`

**Purpose**: See all transfers made from a specific payment intent

**When to use**:

- Track how advertiser's payment was distributed to promoters
- Audit trail for financial reporting
- Verify payout completion

**Response**: Array of transfer objects showing distribution of funds

## Customer Management Endpoints (Advertiser Setup)

### `POST /stripe/payments/customer/setup`

**Purpose**: Create Stripe customer for advertiser and save ID to database

**When to use**:

- During advertiser onboarding process
- When advertiser first adds a payment method
- Before creating any payment intents for campaigns
- One-time setup for each advertiser

**Request Body**:

```typescript
{
  email?: string;        // Override user email if needed
  name?: string;         // Customer display name
  companyName?: string;  // Business name for Stripe customer
}
```

**Example Scenario**:
New advertiser completes profile setup - this endpoint creates their Stripe customer account for future billing.

**Response**:

```typescript
{
  success: true,
  data: {
    stripeCustomerId: string;    // Stripe customer ID (cus_...)
    customer: Stripe.Customer;   // Full Stripe customer object
  }
}
```

**Important Notes**:

- Creates Stripe customer if none exists
- Returns existing customer if already setup
- Updates `advertiser_details.stripe_customer_id` in database
- Required before any campaign funding

---

### `GET /stripe/payments/customer/status`

**Purpose**: Check if advertiser has Stripe customer setup

**When to use**:

- Check if customer setup is needed before payment flows
- Validate advertiser billing readiness
- Frontend conditional rendering for payment UI
- Onboarding progress tracking

**Query Parameters**: None (uses authenticated user)

**Example Scenario**:
Before showing "Create Campaign" button, check if advertiser has completed Stripe setup.

**Response**:

```typescript
{
  success: true,
  data: {
    hasStripeCustomer: boolean;     // Whether customer exists
    stripeCustomerId?: string;      // Customer ID if exists
    setupRequired: boolean;         // Whether setup is needed
  }
}
```

**Response Examples**:

```typescript
// Customer not setup
{
  hasStripeCustomer: false,
  setupRequired: true
}

// Customer already setup
{
  hasStripeCustomer: true,
  stripeCustomerId: "cus_...",
  setupRequired: false
}
```

## Campaign Configuration Endpoints

### `GET /stripe/payments/campaign/:campaignId/config`

**Purpose**: Get payment configuration for a specific campaign

**When to use**:

- Display payment terms on campaign page
- Check rates and fee structures
- Validate payment setup before processing

**Example Scenario**:
Show promoter "This campaign pays $3 per 100 views" on campaign details page.

**Response**: Campaign payment configuration including rates and terms

---

### `POST /stripe/payments/campaign/:campaignId/config`

**Purpose**: Set up payment configuration for a campaign

**When to use**:

- When advertiser creates a campaign and sets payment terms
- Configure rates, fees, and payment methods
- Link campaign to Stripe payment processing

**Request Body**:

```typescript
{
  campaignType: 'visibility' | 'consultant' | 'seller' | 'salesman';
  ratePerHundredViews?: number;  // For visibility campaigns
  commissionRate?: number;       // For salesman campaigns
  minBudget?: number;           // For consultant/seller campaigns
  maxBudget?: number;           // For consultant/seller campaigns
  // Additional configuration fields
}
```

## Utility Endpoints

### `GET /stripe/payments/fees/calculate`

**Purpose**: Calculate platform and Stripe fees for a given amount

**Query Parameters**:

- `amount`: Amount in cents
- `currency`: Currency code (default: 'usd')

**When to use**:

- Show advertiser total cost including fees during campaign creation
- Display net amount promoter will receive
- Fee transparency in UI

**Example Scenario**:
Advertiser enters $100 budget - show "Total cost: $103.50 (includes $3.50 in fees)"

**Response**:

```typescript
{
  originalAmount: number;
  stripeFee: number;
  platformFee: number;
  totalFees: number;
  netAmount: number; // Amount promoter receives
  totalCharge: number; // Amount advertiser pays
}
```

## Typical Usage Flows

### 0. Advertiser Onboarding Flow (Required First)

```
1. GET /customer/status
   → Check if Stripe customer setup is needed

2. POST /customer/setup (if needed)
   → Create Stripe customer and save ID to database

3. Now ready for campaign creation and funding
```

### 1. Visibility Campaign Flow

```
1. [Ensure customer setup completed - see flow 0]

2. POST /campaign/:id/config
   → Set $3/100 views rate and terms

3. POST /intent
   → Create payment intent for $500 campaign budget

4. POST /intent/:id/confirm
   → Charge advertiser's card for $500

5. [Views are generated over time by promoters]

6. POST /transfer (monthly)
   → Payout accumulated earnings to promoters if >$20
```

### 2. Consultant Campaign Flow

```
1. [Ensure customer setup completed - see flow 0]

2. POST /campaign/:id/config
   → Set $200-$800 budget range for consulting work

3. POST /intent
   → Create payment intent for max budget $800

4. POST /intent/:id/confirm
   → Charge advertiser $800 (or authorize for later capture)

5. [Work is delivered in milestones]

6. POST /transfer
   → Pay $300 for milestone 1 completion

7. POST /transfer
   → Pay $500 for final delivery and project completion
```

### 3. Salesman Campaign Flow

```
1. [Ensure customer setup completed - see flow 0]

2. POST /campaign/:id/config
   → Set 10% commission rate for sales

3. [No upfront payment - commission-based]

4. [Sales are generated and tracked]

5. POST /transfer (monthly)
   → Pay accumulated commissions if >$20 threshold
```

### 4. Fee Calculation (Before any payment)

```
1. GET /fees/calculate?amount=50000
   → Calculate fees for $500 campaign

2. Show UI: "Campaign budget: $500, Platform fee: $15, Total: $515"

3. POST /intent with total amount including fees
```

## Error Handling

All endpoints return standardized error responses:

```typescript
{
  success: false,
  error: {
    message: string;
    code?: string;
    details?: any;
  }
}
```

Common error scenarios:

- **Invalid amount**: Amount must be greater than 0
- **Payment failed**: Card declined or insufficient funds
- **Transfer failed**: Invalid destination account or insufficient balance
- **Campaign not found**: Invalid campaign ID
- **Authorization required**: Missing or invalid authentication

## Security & Authentication

- All endpoints require **Firebase authentication** via `@User()` decorator
- **reCAPTCHA protection** via `@UseGuards(RecaptchaGuard)` prevents bot abuse
- **Input validation** ensures data integrity and prevents injection attacks
- **Rate limiting** (if implemented) prevents payment spam

## Integration Notes

### Frontend Integration

```javascript
// 0. Check customer setup status (during advertiser onboarding)
const statusResponse = await fetch('/stripe/payments/customer/status');
const { hasStripeCustomer, setupRequired } = statusResponse.data;

if (setupRequired) {
  // Setup Stripe customer first
  await fetch('/stripe/payments/customer/setup', {
    method: 'POST',
    body: JSON.stringify({
      companyName: 'Acme Corp',
      email: 'user@example.com',
    }),
  });
}

// 1. Create payment intent (after customer setup is complete)
const intent = await fetch('/stripe/payments/intent', {
  method: 'POST',
  body: JSON.stringify({ campaignId, amount: 50000 }),
});

// 2. Confirm with Stripe.js
const result = await stripe.confirmCardPayment(intent.client_secret, {
  payment_method: paymentMethodId,
});

// 3. Confirm on backend
await fetch(`/stripe/payments/intent/${intent.id}/confirm`, {
  method: 'POST',
  body: JSON.stringify({ paymentMethodId }),
});
```

### Database Updates

Each endpoint automatically updates relevant database tables:

- `stripe_payment_intents` - Payment tracking
- `stripe_transfers` - Payout records
- `campaign_budget_allocations` - Budget management
- `platform_fees` - Fee collection
- `wallets` - Promoter balance updates

This controller serves as the core payment processing hub for the entire campaign platform, handling billions of dollars in transactions between advertisers and promoters.

# CrowdProp Database Schema Summary

## Overview

This document provides a comprehensive overview of the CrowdProp database schema, designed to support a platform where advertisers create campaigns and promoters participate to earn money. The schema handles complex financial flows, campaign management, and user interactions while maintaining data integrity and audit trails.

## Core Architecture Principles

### Financial Flow Architecture

- **Real Money Tracking**: `payment_records` tracks actual Stripe transactions
- **Virtual Balance Management**: `wallets` maintains user balances without constant Stripe API calls
- **Complete Audit Trail**: `transactions` records every internal money movement with platform fees
- **Campaign Budget Control**: `campaign_budget_tracking` manages campaign-specific budget allocation

### User Types

- **Advertisers**: Create campaigns, fund them, pay promoters
- **Promoters**: Participate in campaigns, earn money, get paid
- **Platform**: Takes 20% fee on all promoter payments

## Table Categories

### 1. Core User Tables

- `users` - Main user registry for both advertisers and promoters
- `advertiser_details` - Advertiser-specific information and company data
- `promoter_details` - Promoter-specific information and statistics

### 2. Campaign Management Tables

- `campaigns` - Campaign definitions with type-specific fields
- `campaign_applications` - Promoter applications for consultant/seller campaigns
- `promoter_campaigns` - Active campaign participation tracking
- `view_stats` - Daily view tracking for visibility campaigns
- `sales_records` - Sales tracking for salesman campaigns

### 3. Financial Core Tables (The Heart of the System)

- `payment_records` - Stripe transaction log (real money)
- `wallets` - Virtual balance management (both advertisers and promoters)
- `transactions` - Internal money movements with platform fees
- `campaign_budget_tracking` - Campaign-specific budget management

### 4. Payment Infrastructure Tables

- `payment_methods` - Stored payment methods for users
- `stripe_connect_accounts` - Stripe Connect account management
- `stripe_webhook_events` - Webhook processing log

---

## Detailed Table Reference

## Core User Tables

### `users`

**Purpose**: Central user registry for authentication and basic profile data
**When to use**:

- User authentication and profile management
- Linking all user-related data across the platform
- User discovery and matching

**Key Fields**:

- `firebase_uid` - Authentication identifier
- `role` - User type (ADVERTISER, PROMOTER, ADMIN)
- `stripe_account_id` - Links to Stripe Connect accounts

### `advertiser_details`

**Purpose**: Extended information for advertisers including company data
**When to use**:

- Advertiser onboarding and profile completion
- Company verification processes
- Stripe customer/connected account management

**Key Fields**:

- `stripe_customer_id` - For payment processing (charging cards)
- `stripe_connected_account_id` - For receiving payouts
- `company_name`, `company_website` - Business information

### `promoter_details`

**Purpose**: Extended information for promoters including demographics and performance
**When to use**:

- Promoter onboarding and profile completion
- Campaign matching based on location, age, interests
- Performance tracking and analytics

**Key Fields**:

- `age`, `location` - Demographics for campaign targeting
- `total_sales`, `total_views_generated` - Performance metrics

---

## Campaign Management Tables

### `campaigns`

**Purpose**: Campaign definitions with type-specific configuration
**When to use**:

- Creating and managing campaigns
- Campaign discovery and search
- Type-specific logic (visibility, consultant, seller, salesman)

**Key Fields**:

- `type` - Campaign type (VISIBILITY, CONSULTANT, SELLER, SALESMAN)
- `budget_allocated` - Total budget allocated by advertiser
- `cpv` - Cost per 100 views (visibility campaigns)
- `commission_per_sale` - Commission rate (salesman campaigns)

**Type-Specific Fields**:

- **Visibility**: `cpv`, `max_views`, `tracking_link`
- **Consultant**: `meeting_plan`, `expertise_required`
- **Seller**: `deliverables`, `deadline`, `start_date`
- **Salesman**: `commission_per_sale`, `sales_tracking_method`

### `promoter_campaigns`

**Purpose**: Track active promoter participation in campaigns
**When to use**:

- Managing promoter engagement in campaigns
- Tracking progress and earnings
- Payment processing and payout management

**Key Fields**:

- `status` - Participation status (ONGOING, COMPLETED, etc.)
- `views_generated` - For visibility campaigns
- `earnings` - Total earnings from this campaign
- `payout_executed` - Payment status tracking

### `view_stats`

**Purpose**: Daily view tracking for visibility campaigns
**When to use**:

- Recording daily view counts per promoter
- Calculating monthly payouts for visibility campaigns
- Analytics and performance reporting

**Key Fields**:

- `view_count`, `unique_views`, `clicks` - Daily metrics
- `date_tracked` - Daily granularity for reporting

### `sales_records`

**Purpose**: Track sales for salesman campaigns
**When to use**:

- Recording individual sales with commission calculations
- Verifying sales before payout
- Commission-based earnings tracking

**Key Fields**:

- `sale_amount` - Total sale value
- `commission_rate`, `commission_earned` - Commission calculation
- `verification_status` - Sales verification workflow

---

## Financial Core Tables (Critical for Money Flow)

### `payment_records`

**Purpose**: Single source of truth for all Stripe transactions
**When to use in services**:

- **Advertiser wallet deposits**: Record net amount after Stripe fees
- **Withdrawal processing**: Create withdrawal records
- **Campaign funding**: Track campaign-specific payments
- **Balance calculations**: Calculate advertiser wallet balance in real-time

**Architecture**:

- Tracks REAL money movements through Stripe
- Links to actual Stripe payment intents
- Used to calculate advertiser wallet balance without maintaining separate balance field

**Key Fields**:

```sql
stripe_payment_intent_id VARCHAR(255) -- Links to Stripe
user_id UUID -- Advertiser ID
amount_cents INTEGER -- Net amount (after Stripe fees)
payment_type VARCHAR(50) -- 'WALLET_DEPOSIT', 'CAMPAIGN_FUNDING', 'WITHDRAWAL'
status VARCHAR(50) -- 'pending', 'completed', 'failed'
```

**Service Usage Example**:

```typescript
// Calculate advertiser wallet balance
const deposits = await paymentRecords.sum({
  user_id: advertiserId,
  payment_type: 'WALLET_DEPOSIT',
  status: 'completed',
});

const withdrawals = await paymentRecords.sum({
  user_id: advertiserId,
  payment_type: 'WITHDRAWAL',
  status: 'completed',
});

const balance = deposits - withdrawals;
```

### `wallets`

**Purpose**: Virtual balance management for both advertisers and promoters
**When to use in services**:

- **Real-time balance queries**: Fast balance lookup without aggregating transactions
- **Balance updates**: Update after successful payment processing
- **Promoter earnings**: Track accumulated earnings and payout thresholds
- **Advertiser reserves**: Track money held for active campaigns

**Architecture**:

- Unified table for both user types using `user_type` field
- Advertiser-specific fields for campaign reserves and deposits
- Promoter-specific fields for earnings and payout management
- Updated by transaction processing, not direct user actions

**Key Fields**:

```sql
user_id UUID -- Works for both advertisers and promoters
user_type user_type -- 'ADVERTISER' or 'PROMOTER'
current_balance DECIMAL(12,2) -- Available balance
held_for_campaigns DECIMAL(12,2) -- Advertiser: reserved for campaigns
total_earned DECIMAL(12,2) -- Promoter: lifetime earnings
minimum_threshold DECIMAL(6,2) -- Promoter: payout threshold
```

**Service Usage Example**:

```typescript
// Advertiser balance check before campaign funding
const advertiserWallet = await wallets.findOne({
  user_id: advertiserId,
  user_type: 'ADVERTISER',
});

if (advertiserWallet.current_balance < campaignBudget) {
  throw new Error('Insufficient funds');
}

// Update balance after campaign funding
advertiserWallet.current_balance -= campaignBudget;
advertiserWallet.held_for_campaigns += campaignBudget;
await wallets.save(advertiserWallet);
```

### `transactions`

**Purpose**: Complete audit trail of all internal money movements with platform fees
**When to use in services**:

- **Payment processing**: Record every payment with gross amount and platform fee
- **Audit trails**: Track all money movements for compliance
- **Platform revenue**: Calculate platform fees collected
- **Promoter earnings**: Record earnings with fee breakdown

**Architecture**:

- Records ALL internal money movements (not Stripe transactions)
- Tracks platform's 20% fee separately from net amount
- Links to payment_records when related to Stripe transactions
- Used for detailed financial reporting and audit

**Key Fields**:

```sql
user_id UUID -- Both advertisers and promoters
user_type user_type -- 'ADVERTISER' or 'PROMOTER'
type transaction_type -- 'VIEW_EARNING', 'WITHDRAWAL', etc.
gross_amount_cents INTEGER -- Full amount before platform fee
platform_fee_cents INTEGER -- Platform's 20% fee
amount DECIMAL(10,2) -- Net amount (gross - platform_fee)
payment_record_id UUID -- Links to Stripe transaction if applicable
```

**Service Usage Example**:

```typescript
// Record promoter payment with platform fee
const grossAmount = 1000; // $10.00
const platformFee = grossAmount * 0.2; // 20% = $2.00
const netAmount = grossAmount - platformFee; // $8.00

await transactions.create({
  user_id: promoterId,
  user_type: 'PROMOTER',
  type: 'CONSULTANT_PAYMENT',
  campaign_id: campaignId,
  gross_amount_cents: grossAmount,
  platform_fee_cents: platformFee,
  amount: netAmount / 100, // Store in dollars
  status: 'COMPLETED',
});
```

### `campaign_budget_tracking`

**Purpose**: Campaign-specific budget allocation and spending tracking
**When to use in services**:

- **Campaign creation**: Allocate budget from advertiser wallet
- **Payment processing**: Track spending against campaign budget
- **Budget validation**: Ensure campaign has sufficient funds
- **Campaign analytics**: Calculate ROI and spending patterns

**Architecture**:

- One record per campaign
- Tracks budget allocation, spending, and platform fees
- Links campaign spending to advertiser wallet
- Used for campaign budget enforcement

**Key Fields**:

```sql
campaign_id UUID -- One per campaign
advertiser_id UUID -- Campaign owner
allocated_budget_cents INTEGER -- Total budget allocated
spent_budget_cents INTEGER -- Total spent (net to promoters)
platform_fees_collected_cents INTEGER -- Platform fees from this campaign
cpv_cents INTEGER -- Cost per view (visibility campaigns)
commission_rate DECIMAL(5,2) -- Commission rate (salesman campaigns)
```

**Service Usage Example**:

```typescript
// Check campaign budget before paying promoter
const campaignBudget = await campaignBudgetTracking.findOne({
  campaign_id: campaignId,
});

const remainingBudget =
  campaignBudget.allocated_budget_cents - campaignBudget.spent_budget_cents;

if (paymentAmount > remainingBudget) {
  throw new Error('Campaign budget exceeded');
}

// Update budget after payment
campaignBudget.spent_budget_cents += netAmount;
campaignBudget.platform_fees_collected_cents += platformFee;
await campaignBudgetTracking.save(campaignBudget);
```

---

## Money Flow Examples

### Advertiser Deposit Flow

1. **User deposits $1000** via Stripe (gross amount)
2. **Stripe takes fees** ($29 + $0.30 = $29.30)
3. **Net amount**: $970.70 goes to platform bank account
4. **Record in `payment_records`**: $970.70 credited to advertiser
5. **Update `wallets`**: Advertiser balance +$970.70

### Campaign Funding Flow

1. **Advertiser creates campaign** with $500 budget
2. **Check `wallets`**: Ensure sufficient balance
3. **Update `wallets`**: -$500 current_balance, +$500 held_for_campaigns
4. **Create `campaign_budget_tracking`**: Allocate $500 to campaign
5. **Record in `transactions`**: CAMPAIGN_FUNDING transaction

### Promoter Payment Flow (Visibility Campaign)

1. **Promoter generates 1000 views** (100 units × $3 CPV = $300 gross)
2. **Calculate platform fee**: $300 × 20% = $60
3. **Net to promoter**: $240
4. **Record in `transactions`**: $300 gross, $60 platform fee, $240 net
5. **Update promoter `wallets`**: +$240 current_balance, +$240 total_earned
6. **Update `campaign_budget_tracking`**: +$240 spent_budget_cents, +$60 platform_fees_collected_cents

### Advertiser Withdrawal Flow

1. **Advertiser requests $500 withdrawal**
2. **Check `wallets`**: Ensure sufficient available balance
3. **Record in `payment_records`**: WITHDRAWAL type, pending status
4. **Create `transactions`**: WITHDRAWAL type with amount
5. **Update `wallets`**: -$500 current_balance
6. **Process Stripe transfer**: Send $500 to advertiser's bank
7. **Update `payment_records`**: Mark as completed

---

## Database Relationships

### Key Foreign Key Relationships

- `users.id` → `advertiser_details.user_id` (1:1)
- `users.id` → `promoter_details.user_id` (1:1)
- `users.id` → `wallets.user_id` (1:1)
- `users.id` → `campaigns.advertiser_id` (1:many)
- `campaigns.id` → `campaign_budget_tracking.campaign_id` (1:1)
- `campaigns.id` → `promoter_campaigns.campaign_id` (1:many)
- `payment_records.id` → `transactions.payment_record_id` (1:many)

### Financial Integrity Constraints

- Wallet balances must be non-negative
- Campaign spending cannot exceed allocated budget
- Platform fees must be calculated on all promoter payments
- All Stripe transactions must be recorded in payment_records

---

## Service Integration Guidelines

### For Advertiser Payment Service

- **Use `payment_records`** for Stripe transaction tracking
- **Use `wallets`** for balance management and availability checks
- **Use `transactions`** for internal payment audit trails
- **Use `campaign_budget_tracking`** for campaign budget enforcement

### For Campaign Service

- **Use `campaigns`** for campaign management
- **Use `campaign_budget_tracking`** for budget allocation
- **Use `promoter_campaigns`** for participation tracking
- **Use `view_stats`** or `sales_records`\*\* for performance tracking

### For Promoter Service

- **Use `wallets`** for earnings and payout management
- **Use `transactions`** for payment history
- **Use `promoter_campaigns`** for active campaign participation
- **Use Stripe Connect APIs** for actual payouts

### Data Consistency Rules

1. **Advertiser wallet balance** = SUM(payment_records.WALLET_DEPOSIT) - SUM(payment_records.WITHDRAWAL)
2. **Campaign spent budget** = SUM(transactions.amount WHERE campaign_id = X AND user_type = 'PROMOTER')
3. **Platform fees collected** = SUM(transactions.platform_fee_cents WHERE campaign_id = X)
4. **Promoter earnings** = SUM(transactions.amount WHERE user_id = X AND user_type = 'PROMOTER')

This schema provides complete financial tracking, audit trails, and data integrity while supporting complex campaign types and payment flows.

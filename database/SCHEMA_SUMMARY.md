# Database Schema Use Cases Summary

## Application Overview

This database schema supports a **Campaign Platform** that connects two primary user types: **Advertisers** and **Promoters**. The platform facilitates performance-based marketing campaigns where advertisers pay promoters for various types of promotional work.

### Platform Purpose

The application serves as a marketplace where:

- **Advertisers** create campaigns with specific budgets and requirements
- **Promoters** (influencers, content creators, salespeople) complete promotional work
- **Payments flow** from advertisers to promoters based on performance metrics
- **Platform earns** fees from successful transactions

### Campaign Types & Payment Models

**1. Visibility Campaigns (Pay-per-View)**

- Advertisers set a rate per 100 views (e.g., $3 per 100 views) and maximum view count
- Multiple promoters can participate simultaneously
- Promoters are paid monthly for views generated (minimum $20 threshold)
- Example: $3/100 views × 2,000 views = $60 earned for the promoter

**2. Consultant Campaigns (Project-based)**

- Advertisers set minimum and maximum budget range for consulting work
- Single promoter selected through application process
- Multiple payments allowed during campaign duration (within budget range)
- Immediate payment upon work completion/approval

**3. Seller Campaigns (Deliverable-based)**

- Similar to consultant but focused on tangible deliverables
- Budget range with milestone-based payments
- Work submissions and approval workflows
- Project timeline management

**4. Salesman Campaigns (Commission-based)**

- Promoters earn commission percentage on sales they generate
- Sales tracked via referral links or coupon codes
- Monthly commission payouts (minimum $20 threshold)
- Performance-based long-term relationships

### Key Business Rules

- **$20 Minimum Payout**: Earnings below $20 accumulate until threshold is met
- **Pre-funded Campaigns**: Advertisers must fund campaigns upfront
- **Budget Controls**: Spending cannot exceed allocated campaign budgets
- **Monthly Cycles**: Visibility and salesman earnings paid monthly
- **Immediate Payments**: Consultant/seller payments processed upon completion

---

## Core User Management Tables

### `users` (File: 02_core_tables.sql)

- **Primary user registry** for both advertisers and promoters
- Tracks basic profile information and authentication
- Links to Firebase authentication via `firebase_uid`
- Foundation for all user operations in the system
- **Key Fields**: `id`, `firebase_uid`, `email`, `role`, `created_at`

### `advertiser_details` (File: 02_core_tables.sql)

- **Extended advertiser profiles** created after users choose advertiser role
- Company information, verification status, business categories
- Links to `users` table via `user_id`
- **Key Fields**: `user_id`, `company_name`, `verification_status`, `stripe_customer_id`

### `promoter_details` (File: 02_core_tables.sql)

- **Extended promoter profiles** for content creators and influencers
- Demographics, skills, follower counts across social platforms
- Links to `users` table via `user_id`

### Supporting User Tables

- `advertiser_type_mappings`: Business category classification
- `promoter_languages`, `promoter_skills`: Skill-based campaign matching

---

## Campaign Management Tables

### `campaigns` (File: 03_campaign_tables.sql)

- **Core campaign creation** by advertisers with budget allocation
- **Visibility Campaigns**: Set `cpv` (cost per 100 views), `max_views` for budget calculation
- **Consultant/Seller Campaigns**: Set `min_budget`/`max_budget` ranges for negotiated work
- **Salesman Campaigns**: Set `commission_per_sale` percentage for monthly payouts
- **Key Fields**: `advertiser_id`, `campaign_type`, `max_budget`, `cpv`, `status`

### `campaign_applications` (File: 03_campaign_tables.sql)

- **Application system** for Consultant/Seller campaigns requiring approval
- Promoters submit applications with proposed rates
- Advertisers can accept/reject and negotiate terms
- **Key Fields**: `campaign_id`, `promoter_id`, `status`, `proposed_rate`

### `promoter_campaigns` (File: 03_campaign_tables.sql)

- **Active participation tracking** for ongoing campaigns
- Tracks `views_generated` for visibility campaigns
- Records final payouts and transaction references
- **Key Fields**: `campaign_id`, `promoter_id`, `views_generated`, `total_earned`

### Supporting Campaign Tables

- `campaign_deliverables`: Work requirements and submission tracking
- `campaign_works`: Actual deliverable submissions
- `view_stats`: Daily view tracking for visibility campaigns
- `unique_views`: Fraud prevention for view counting

---

## Financial & Payment Tables (SIMPLIFIED IMPLEMENTATION)

### `payment_records` (File: 09_stripe_connect_enhancements.sql)

- **SIMPLIFIED STRIPE PAYMENT TRACKING** - All Stripe payment intents with business context
- Links Stripe payments to campaigns and users for business logic
- **Key Fields**: `stripe_payment_intent_id`, `campaign_id`, `user_id`, `amount_cents`, `payment_type`, `status`
- **Payment Types**: 'campaign_funding', 'wallet_deposit', 'withdrawal'

### `stripe_webhook_events` (File: 09_stripe_connect_enhancements.sql)

- **Webhook event processing** for debugging and ensuring we don't miss events
- **Key Fields**: `stripe_event_id`, `event_type`, `processed`, `object_id`

### `transactions` (File: 04_financial_tables.sql)

- **ALL INTERNAL MONEY MOVEMENTS** - Replaces payout_records, advertiser_charges, etc.
- Tracks wallet deposits, campaign funding, promoter payments, refunds
- **Key Fields**: `user_id`, `campaign_id`, `type`, `amount`, `status`, `stripe_transaction_id`

### `wallets` (File: 04_financial_tables.sql)

- **USER BALANCE MANAGEMENT** - Both advertiser and promoter wallets
- Advertiser: available_balance, held_balance for campaigns
- Promoter: earnings accumulation with $20 minimum threshold
- **Key Fields**: `user_id`, `current_balance`, `pending_balance`, `total_earned`, `minimum_threshold`

### `sales_records` (File: 04_financial_tables.sql)

- **COMMISSION TRACKING** for salesman campaigns only
- Records individual sales with verification status for commission calculation
- **Key Fields**: `campaign_id`, `promoter_id`, `sale_amount`, `commission_rate`, `commission_earned`

---

## Supporting Infrastructure Tables

### `stripe_connect_accounts` (File: 04_financial_tables.sql)

- **Promoter payment account setup** for receiving payments through Stripe Connect
- Required before promoters can receive any payments
- **Key Fields**: `user_id`, `stripe_account_id`, `status`, `charges_enabled`, `payouts_enabled`

### `payment_methods` (File: 04_financial_tables.sql)

- **Stored payment methods** for recurring advertiser charges
- Enables seamless campaign funding without re-entering card details
- **Key Fields**: `user_id`, `stripe_payment_method_id`, `type`, `is_default`

---

## Simplified Money Flow Architecture

### **1. Advertiser Wallet System**

```
Deposit: payment_records (Stripe) → transactions (internal) → wallets (advertiser balance)
Campaign: wallets (available → held) → transactions (budget allocation)
```

### **2. Automatic Payments (Visibility/Salesman)**

```
Views/Sales Generated → transactions (held → promoter wallets) → Automatic monthly payouts
```

### **3. Manual Payments (Consultant/Seller)**

```
Work Completed → transactions (held → promoter wallets) → Immediate payments
```

### **4. All Financial Tracking**

```
- payment_records: All Stripe interactions
- transactions: All internal money movements
- wallets: Real-time balance management
- sales_records: Commission calculations only
```

---

## Key Business Flow Use Cases

### 1. Advertiser Wallet Deposit Flow

```
Advertiser deposits $1000 → payment_records (Stripe tracking) →
transactions (deposit record) → wallets (advertiser balance = $1000)
```

### 2. Campaign Creation & Funding Flow

```
Advertiser creates $300 campaign → wallets (available: $700, held: $300) →
transactions (budget allocation record) → Campaign ready for promoters
```

### 3. Visibility Campaign Automatic Payments

```
Promoters generate views → transactions (held → promoter wallets) →
Monthly: If promoter wallet >$20 → payment_records (Stripe payout)
```

### 4. Consultant/Seller Manual Payments

```
Work completed → Advertiser approves → transactions (held → promoter wallet) →
Immediate payout via payment_records (Stripe transfer)
```

### 5. Salesman Commission Flow

```
Sales tracked in sales_records → Commission calculated →
transactions (held → promoter wallet) → Monthly payouts if >$20
```

## Data Integrity and Security

- **Simplified Payment Tracking**: New `payment_records` table provides minimal local storage while Stripe API handles complex payment data
- **Fund Holding**: Campaign budgets are pre-funded and tracked via `wallets` with held_balance
- **Threshold Management**: $20 minimum in `wallets` table prevents micro-transactions
- **Audit Trails**: Complete transaction history via `transactions` table for compliance
- **Webhook Reliability**: `stripe_webhook_events` ensures no missed payment updates
- **Payment Security**: Stripe Connect via `stripe_connect_accounts` ensures PCI compliance

## Current Implementation Status

**✅ IMPLEMENTED (Core Tables Only):**

- `payment_records` - Simplified Stripe payment tracking
- `stripe_webhook_events` - Event processing and debugging
- `wallets` - User balance management (both advertiser and promoter)
- `transactions` - All internal financial movements
- `sales_records` - Commission tracking for salesman campaigns
- `stripe_connect_accounts` - Promoter payment accounts
- `payment_methods` - Stored payment methods

**✅ REMOVED (Redundant Tables):**

- `advertiser_charges` ❌ (duplicated payment_records functionality)
- `advertiser_spends` ❌ (can be calculated from transactions)
- `payout_records` ❌ (replaced by transactions)
- `payout_settings` ❌ (unnecessary complexity)
- `billing_period_summaries` ❌ (can be calculated on-demand)
- `financial_analytics` ❌ (can be calculated on-demand)
- `invoices` ❌ (unnecessary for current use case)

This simplified schema design ensures proper fund management, automated payouts, comprehensive audit trails, and scalable payment processing using a **minimal database approach** with **4 core financial tables** instead of 11+ redundant tables.

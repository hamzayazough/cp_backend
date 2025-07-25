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

This document outlines the use cases for each table in the campaign platform database, focusing on the payment flow between advertisers and promoters.

## System Overview

**Core Business Model:**

- **Advertisers** pay money to **Promoters** in exchange for promotional work
- **4 Campaign Types:**
  1. **Visibility**: Pay per 100 views (monthly payout if >$20)
  2. **Consultant**: Fixed budget range, multiple payments during campaign
  3. **Seller**: Fixed budget range, multiple payments during campaign
  4. **Salesman**: Commission-based, monthly payouts

## Core User Management Tables

### `users`

- **Primary user registry** for both advertisers and promoters
- Tracks `wallet_balance` for promoters (accumulated earnings from all campaigns)
- Stores campaign completion statistics and performance metrics
- Links to Firebase authentication via `firebase_uid`
- **Use Case**: Central identity management and financial balance tracking

### `advertiser_details` & `promoter_details`

- **Role-specific profiles** created after users choose their account type
- **Advertiser**: Company information, verification status, business categories
- **Promoter**: Demographics, skills, follower counts across social platforms
- **Use Case**: Enhanced profile data for campaign matching and verification

### Supporting Tables

- `advertiser_type_mappings`: Business category classification
- `promoter_languages`, `promoter_skills`: Skill-based campaign matching
- `follower_estimates`: Platform-specific audience size for rate calculations

## Campaign Management Tables

### `campaigns`

- **Core campaign creation** by advertisers with budget allocation
- **Visibility Campaigns**:
  - Set `cpv` (cost per 100 views), `max_views` for budget calculation
  - Requires `tracking_link` for view measurement
- **Consultant/Seller Campaigns**:
  - Set `min_budget`/`max_budget` ranges for negotiated work
  - Define deliverables and timeline requirements
- **Salesman Campaigns**:
  - Set `commission_per_sale` percentage for monthly payouts
  - Configure tracking method (ref links or coupon codes)
- **Use Case**: Campaign specification and budget parameters

### `campaign_applications`

- **Application system** for Consultant/Seller campaigns requiring approval
- Promoters submit applications with proposed rates
- Advertisers can accept/reject and negotiate terms
- **Use Case**: Selective campaign participation with rate negotiation

### `promoter_campaigns`

- **Active participation tracking** for ongoing campaigns
- Tracks `views_generated` for visibility campaigns
- Manages **budget holding** via `budget_held` and `spent_budget`
- Records final payouts and Stripe transaction references
- **Use Case**: Real-time campaign progress and payment status

### Supporting Tables

- `campaign_deliverables`: Work requirements and submission tracking
- `campaign_works`: Actual deliverable submissions
- `view_stats`: Daily view tracking for visibility campaigns
- `unique_views`: Fraud prevention for view counting

## Financial Flow Tables

### `campaign_budget_allocations`

- **Pre-funding mechanism** for all campaign types
- Links to `stripe_payment_intent_id` for advertiser payment collection
- Tracks `allocated_amount` vs `spent_amount` for budget control
- Stores campaign-specific rates: `rate_per_100_views` or `commission_rate`
- **Use Case**: Budget reservation and spending limits enforcement

### `stripe_payment_intents`

- **Advertiser payment collection** when funding campaigns
- Supports multiple payment flows (destination charges, separate transfers)
- Tracks payment status from creation through completion
- **Use Case**: Secure payment processing for campaign funding

### `stripe_transfers`

- **Promoter payouts** from held campaign funds
- Used for:
  - Visibility campaigns: Monthly payouts if balance >$20
  - Consultant/Seller: Final or milestone payments
  - Salesman: Monthly commission payouts
- Links to original payment intent for complete audit trail
- **Use Case**: Automated and manual payout execution

### `platform_fees`

- **Platform revenue tracking** from each transaction
- Calculates fees as percentage or fixed amount
- Separates Stripe processing fees from platform profit
- **Use Case**: Business analytics and revenue reporting

## Monthly Payout System Tables

### `wallets`

- **Promoter earnings accumulation** across all campaigns
- Implements `minimum_threshold` ($20) for monthly payouts
- Separates earnings by type:
  - `current_balance`: Ready for immediate payout
  - `pending_balance`: Awaiting campaign completion
  - `direct_*` fields: Consultant/Seller immediate payments
- **Use Case**: Consolidated earnings management with payout thresholds

### `sales_records`

- **Salesman campaign sales tracking** for commission calculation
- Records individual sales with verification status
- Links tracking codes (coupons/ref links) to sales
- Feeds into monthly commission payout calculations
- **Use Case**: Performance-based payment tracking

### `payout_records`

- **Monthly payout execution** for accumulated earnings
- Triggers when promoter balance exceeds $20 threshold
- Tracks Stripe transfer completion and failure reasons
- **Use Case**: Automated monthly payment processing

## Payment Infrastructure Tables

### `stripe_connect_accounts`

- **Promoter onboarding** to receive payments through Stripe Connect
- Tracks verification status and payout capabilities
- Required before any promoter can receive funds
- Handles compliance and tax requirements
- **Use Case**: Payment recipient verification and compliance

### `advertiser_charges`

- **Advertiser billing** for campaign funding and ongoing charges
- Handles refunds for unused campaign budgets
- Tracks payment method usage and failure reasons
- **Use Case**: Advertiser payment management and refund processing

### `payment_methods`

- **Stored payment methods** for recurring advertiser charges
- Enables seamless campaign funding without re-entering card details
- Supports multiple payment types (cards, bank accounts)
- **Use Case**: Frictionless repeat payments

## Audit and Compliance Tables

### `stripe_webhook_events`

- **Event processing** from Stripe for payment confirmations
- Ensures reliable payment status updates across all tables
- Provides debugging capabilities for failed payments
- **Use Case**: Payment system reliability and troubleshooting

### `billing_period_summaries`

- **Monthly financial reports** for both user types
- Tracks below-threshold earnings that carry forward
- Provides analytics on campaign performance and spending patterns
- **Use Case**: Financial reporting and tax documentation

### Supporting Tables

- `transactions`: General financial movement tracking
- `promoter_balances`: Real-time balance snapshots
- `advertiser_spends`: Spending pattern analysis

## Advertiser-Related Tables

This section identifies all tables that store data related to advertisers or their business operations.

### Primary Advertiser Tables

#### `users`

- **Primary table** - All advertisers start here with `role = 'advertiser'`
- Contains basic profile info, contact details, Firebase auth
- Foundation for all advertiser operations

#### `advertiser_details`

- **Extended advertiser profile** - Company info, verification status
- One-to-one relationship with `users` table
- Business-specific information and settings

#### `advertiser_type_mappings`

- **Business categories** - Links advertisers to their industry types
- Many-to-many relationship (advertiser can have multiple business types)
- Used for campaign categorization and matching

### Campaign Management (Advertiser-Created)

#### `campaigns`

- **Core table** - Advertisers create and own all campaigns
- Contains budget settings, campaign type, requirements
- Foreign key: `advertiser_id` → `users(id)`

#### `campaign_applications`

- **Application review** - Advertisers review promoter applications
- Advertisers accept/reject applications for consultant/seller campaigns
- Negotiation and selection process management

#### `campaign_budget_allocations`

- **Campaign funding** - Tracks advertiser's budget allocations per campaign
- Links to payment intents for funding source
- Budget control and spending limits

### Payment & Billing (Advertiser Pays)

#### `stripe_payment_intents`

- **Advertiser payments** - When advertisers fund campaigns
- All incoming money from advertisers flows through here
- Payment processing and status tracking

#### `payment_methods`

- **Stored payment info** - Advertiser's saved cards/bank accounts
- Enables recurring payments without re-entering details
- Frictionless payment experience

#### `advertiser_charges`

- **Billing records** - All charges made to advertisers
- Includes campaign funding, platform fees, refunds
- Complete billing history and refund management

#### `advertiser_spends`

- **Spending analytics** - Tracks advertiser spending patterns
- Used for reporting and budget recommendations
- Business intelligence and optimization

### Financial Analytics & Reporting

#### `platform_fees`

- **Revenue tracking** - Platform fees collected from advertiser transactions
- Important for business analytics and revenue attribution
- Links advertiser payments to platform revenue

#### `billing_period_summaries`

- **Monthly reports** - Advertiser spending summaries
- Tax documentation and financial reporting
- Period-based analytics and insights

#### `transactions`

- **Audit trail** - All financial movements involving advertisers
- Complete transaction history for compliance
- Dispute resolution and accounting

### Supporting Infrastructure

#### `stripe_webhook_events`

- **Payment confirmations** - Webhook processing for advertiser payments
- Ensures payment status accuracy and system reliability
- Error handling and retry mechanisms

### Tables NOT Related to Advertisers

**Promoter-Only Tables:**

- `stripe_connect_accounts` - Promoters only (receive payments)
- `wallets` - Promoters only (earnings accumulation)
- `payout_records` - Promoters only (monthly payouts)
- `stripe_transfers` - Promoters only (money going out)
- `promoter_*` tables - Promoter-specific profile data

**Key Distinction:** Advertisers are **payers** in the system, so they're associated with incoming payments, campaign creation, and billing tables, but NOT with payout/transfer tables which are promoter-focused.

## Key Business Flow Use Cases

### 1. Visibility Campaign Flow

```
Advertiser creates campaign → Funds via stripe_payment_intents →
Budget held in campaign_budget_allocations → Promoters generate views →
Views tracked in view_stats → Monthly payout if wallet >$20 via stripe_transfers
```

### 2. Consultant/Seller Campaign Flow

```
Advertiser creates campaign with budget range → Promoter applies via campaign_applications →
Advertiser accepts → Budget funded → Work delivered →
Multiple payments within budget range via stripe_transfers
```

### 3. Salesman Campaign Flow

```
Campaign setup with commission rate → Sales tracked in sales_records →
Monthly commission calculation → Payout via standard wallet system if >$20
```

### 4. Platform Revenue Flow

```
All transactions generate platform_fees entries →
Revenue tracking and business analytics →
Financial reporting and tax compliance
```

## Data Integrity and Security

- **Fund Holding**: Campaign budgets are pre-funded and held securely
- **Threshold Management**: $20 minimum prevents micro-transactions
- **Audit Trails**: Complete transaction history for compliance
- **Fraud Prevention**: Unique view tracking and verification systems
- **Payment Security**: Stripe Connect ensures PCI compliance

This schema design ensures proper fund management, automated payouts, comprehensive audit trails, and scalable payment processing for all

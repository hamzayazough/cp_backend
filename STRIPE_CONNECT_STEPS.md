# Stripe Connect Integration - Step-by-Step Breakdown

## PHASE 1: Database Schema Setup (START HERE)

### Step 1.1: Review and Apply Database Enhancements ⭐ **NEXT ACTION**

**What to do:**

1. Review the new file: `database/10_stripe_connect_enhancements.sql`
2. Run this SQL against your PostgreSQL database
3. Update your master initialization script

**Commands to run:**

```bash
# Connect to your PostgreSQL database
psql -h localhost -d your_database_name -U your_username

# Run the new migration
\i database/10_stripe_connect_enhancements.sql

# Verify tables were created
\dt stripe_*
\dt business_profiles
\dt campaign_payment_configs
\dt platform_fees
```

### Step 1.2: Update Your Database Initialization Scripts

**Files to modify:**

- `database/init_master.sql` - Add reference to new file
- `database/99_complete.sql` - Add new tables to completion script

**Action needed:**
Add this line to your `init_master.sql`:

```sql
\i 10_stripe_connect_enhancements.sql
```

### Step 1.3: Verify Schema Integration

**Validation steps:**

1. Check all foreign key relationships work
2. Verify indexes are created properly
3. Test sample data insertion

---

## PHASE 2: NestJS Environment Setup

### Step 2.1: Install Required Dependencies

**Run these commands:**

```bash
npm install stripe nestjs-stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

### Step 2.2: Environment Configuration

**Add to your `.env` file:**

```env
# Stripe Test Configuration (start with test mode)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_CONNECT_CLIENT_ID=ca_YOUR_CONNECT_CLIENT_ID

# Stripe Configuration
STRIPE_API_VERSION=2023-10-16
PLATFORM_FEE_PERCENTAGE=5.0
DEFAULT_CURRENCY=USD
SUPPORTED_COUNTRIES=US,CA

# URLs (update with your actual URLs)
STRIPE_CONNECT_RETURN_URL=http://localhost:3000/connect/return
STRIPE_CONNECT_REFRESH_URL=http://localhost:3000/connect/refresh
```

### Step 2.3: Create Stripe Module Configuration

**Create:** `src/config/stripe.config.ts`

---

## PHASE 3: Core Service Implementation

### Step 3.1: Create StripeModule

**Files to create:**

- `src/stripe/stripe.module.ts`
- `src/stripe/services/stripe-connect.service.ts`
- `src/stripe/services/stripe-payment.service.ts`
- `src/stripe/services/stripe-webhook.service.ts`

### Step 3.2: Implement Database Entities

**Create TypeORM entities for:**

- StripeConnectAccount
- StripePaymentIntent
- StripeTransfer
- CampaignPaymentConfig
- PlatformFee
- BusinessProfile

### Step 3.3: Build Core Services

**Priority order:**

1. StripeConnectService (account creation/onboarding)
2. StripePaymentService (payment processing)
3. StripeWebhookService (event handling)

---

## PHASE 4: Controller Implementation

### Step 4.1: Create Controllers

**Files to create:**

- `src/stripe/controllers/connect.controller.ts`
- `src/stripe/controllers/payment.controller.ts`
- `src/stripe/controllers/webhook.controller.ts`

### Step 4.2: API Endpoints Design

**Connect Controller endpoints:**

```
POST   /api/connect/create-account
GET    /api/connect/onboard/:userId
GET    /api/connect/status/:userId
POST   /api/connect/refresh-onboarding
```

**Payment Controller endpoints:**

```
POST   /api/payments/create-intent
POST   /api/payments/confirm
GET    /api/payments/status/:intentId
POST   /api/payments/refund
```

**Webhook Controller endpoints:**

```
POST   /api/stripe/webhook
```

---

## PHASE 5: Campaign Integration

### Step 5.1: Modify Campaign Creation

**Update campaign creation flow to:**

1. Set payment configuration per campaign type
2. Initialize Stripe Connect requirements
3. Validate promoter account status

### Step 5.2: Implement Payment Flows

**By campaign type:**

- **Visibility:** Immediate destination charges
- **Consultant:** Hold-and-release pattern
- **Seller:** Milestone-based payments
- **Salesman:** Commission tracking and batch payouts

---

## IMMEDIATE NEXT STEPS (What to do right now):

### 🚀 **ACTION 1: Database Setup**

1. Open your PostgreSQL client
2. Run the migration file we created: `database/10_stripe_connect_enhancements.sql`
3. Verify all tables were created successfully

### 🚀 **ACTION 2: Install Dependencies**

```bash
cd c:\Users\hamza\Documents\history_project\cp\cp_backend
npm install stripe nestjs-stripe @stripe/stripe-js @types/stripe
```

### 🚀 **ACTION 3: Get Stripe Test Keys**

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your test keys to your `.env` file
3. Set up a test Stripe Connect application

### 🚀 **ACTION 4: Update Master Database Script**

Add the new migration to your database initialization process

---

## Questions to Consider:

1. **Do you want to start with test data migrations first, or jump into the NestJS implementation?**

2. **What's your current Stripe account status?**
   - Do you have test keys?
   - Is Connect enabled on your account?

3. **Should we focus on a specific campaign type first** (e.g., Visibility campaigns) **as a proof of concept?**

4. **Do you want to implement the business promoter features immediately, or start with individual promoters only?**

Let me know which step you'd like to tackle first, and I'll provide detailed implementation code for that specific step!

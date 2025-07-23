# Stripe Connect Integration - Implementation Plan

## Overview

This document outlines the step-by-step implementation of Stripe Connect for your NestJS campaign platform, enabling multi-party payments between advertisers and promoters (individuals and businesses) across Canada and the US.

## Phase 1: Database Schema Setup ✅ READY TO IMPLEMENT

### Files Created/Modified:

- `database/10_stripe_connect_enhancements.sql` - New Stripe Connect specific tables
- `database/05_analytics_tables.sql` - Enhanced with Stripe metrics

### Key Database Changes:

1. **Enhanced Stripe Connect Accounts** - Extended your existing table
2. **Payment Intents Tracking** - Track all Stripe payment intents with Connect data
3. **Transfer Management** - For separate transfer flows
4. **Campaign Payment Configs** - Per-campaign payment flow settings
5. **Platform Fee Tracking** - Detailed fee calculation and tracking
6. **Webhook Event Logging** - For debugging and audit trails
7. **Business Profiles** - For business promoters requiring additional KYC

### Next Steps for Phase 1:

1. Run the new SQL migration file
2. Update your database initialization scripts
3. Verify all foreign key relationships

---

## Phase 2: NestJS Dependencies and Configuration

### Dependencies to Install:

```bash
npm install stripe nestjs-stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

### Environment Variables to Add:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...

# API Configuration
STRIPE_API_VERSION=2023-10-16
STRIPE_CONNECT_ONBOARDING_URL=https://your-app.com/connect/onboarding
STRIPE_CONNECT_RETURN_URL=https://your-app.com/connect/return
STRIPE_CONNECT_REFRESH_URL=https://your-app.com/connect/refresh

# Regional Settings
DEFAULT_CURRENCY=USD
SUPPORTED_COUNTRIES=US,CA
PLATFORM_FEE_PERCENTAGE=5.0
```

---

## Phase 3: Core Service Implementation

### Services to Create/Modify:

#### 3.1 StripeConnectService

**Location:** `src/services/stripe-connect.service.ts`
**Responsibilities:**

- Connected account creation and management
- Account onboarding (OAuth vs Account Links)
- Account status verification
- KYC requirement handling

#### 3.2 StripePaymentService

**Location:** `src/services/stripe-payment.service.ts`
**Responsibilities:**

- Payment Intent creation (destination/direct charges)
- Transfer management for hold-and-release scenarios
- Fee calculation and application
- Payment confirmation handling

#### 3.3 StripeWebhookService

**Location:** `src/services/stripe-webhook.service.ts`
**Responsibilities:**

- Webhook signature verification
- Event processing and routing
- Database updates from webhook events
- Error handling and retry logic

---

## Phase 4: Controller Implementation

### Controllers to Create/Modify:

#### 4.1 Connect Controller

**Endpoints:**

- `POST /connect/create-account` - Create connected account
- `GET /connect/onboard/:userId` - Get onboarding link
- `GET /connect/status/:userId` - Check onboarding status
- `POST /connect/refresh-onboarding` - Generate new onboarding link

#### 4.2 Payment Controller

**Endpoints:**

- `POST /payments/create-intent` - Create payment intent for campaign
- `POST /payments/confirm` - Confirm payment
- `GET /payments/status/:intentId` - Check payment status
- `POST /payments/refund` - Process refunds

#### 4.3 Webhook Controller

**Endpoints:**

- `POST /stripe/webhook` - Receive Stripe webhooks

---

## Phase 5: Campaign Payment Flow Integration

### Payment Flow Types by Campaign:

#### 5.1 Visibility Campaigns (CPV Model)

- **Flow:** Destination charges with auto-release
- **Implementation:** Immediate payment on view completion
- **Fee Structure:** Platform percentage + fixed Stripe fee

#### 5.2 Consultant Campaigns (Fixed Budget)

- **Flow:** Hold-and-release or destination charges
- **Implementation:** Payment on milestone completion
- **Escrow:** Optional fund holding until deliverable approval

#### 5.3 Seller Campaigns (Project-based)

- **Flow:** Hold-and-release with milestone payments
- **Implementation:** Multi-stage payment release
- **Dispute Handling:** Built-in refund/partial payment logic

#### 5.4 Salesman Campaigns (Commission-based)

- **Flow:** Separate charges and transfers
- **Implementation:** Aggregate sales tracking with periodic payouts
- **Commission Calculation:** Automated based on verified sales

---

## Phase 6: Frontend Integration

### Frontend Components Needed:

#### 6.1 Promoter Onboarding

- Account type selection (Individual vs Business)
- Stripe Connect onboarding flow
- Status tracking and re-onboarding
- KYC document upload interface

#### 6.2 Payment Processing

- Stripe Elements integration for secure payments
- Payment confirmation handling
- Error state management
- Receipt and transaction history

#### 6.3 Dashboard Enhancements

- Connected account status display
- Earnings and payout tracking
- Payment history with Stripe references
- Platform fee breakdown

---

## Phase 7: Testing Strategy

### Testing Environment Setup:

1. **Stripe Test Mode Configuration**
2. **Test Connected Accounts** (US and Canadian)
3. **Mock Payment Scenarios**
4. **Webhook Testing with Stripe CLI**

### Test Cases:

- Individual promoter onboarding (US/CA)
- Business promoter onboarding (US/CA)
- All campaign payment flows
- Cross-border payment scenarios
- Fee calculation accuracy
- Webhook event handling
- Error scenarios and recovery

---

## Phase 8: Production Deployment

### Pre-Production Checklist:

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Stripe webhook endpoints configured
- [ ] SSL certificates for webhook security
- [ ] Error monitoring and alerting
- [ ] Legal compliance verification (US/CA)

### Go-Live Steps:

1. Switch to Stripe live mode
2. Update webhook endpoints
3. Test with real bank accounts
4. Monitor initial transactions
5. Verify fee calculations in production

---

## Cross-Border Considerations

### Current Limitations:

- Canadian platforms may have restrictions on US connected accounts
- Direct charges not supported cross-border
- Currency conversion handling needed

### Recommended Approach:

1. **Single Platform Strategy:** Use destination charges for all scenarios
2. **Dual Platform Strategy:** Separate US/CA Stripe accounts (if needed)
3. **Currency Handling:** USD as primary, CAD conversion as needed

---

## Compliance and Legal

### Requirements by Region:

#### United States:

- 1099-K tax reporting for earnings >$600
- State-specific money transmission licenses
- KYC/AML compliance through Stripe

#### Canada:

- T4A slip reporting for significant earnings
- Provincial regulations compliance
- GST/HST handling on platform fees

---

## Monitoring and Analytics

### Key Metrics to Track:

- Payment success rates by region
- Average onboarding completion time
- Platform fee revenue
- Failed payment analysis
- Cross-border transaction performance

### Dashboards:

- Real-time payment processing status
- Connected account health monitoring
- Revenue and fee analytics
- Compliance reporting

---

## Support and Documentation

### User Documentation:

- Promoter onboarding guide
- Payment process explanation
- Troubleshooting common issues
- Tax reporting guidance

### Developer Documentation:

- API endpoint documentation
- Webhook event catalog
- Error code reference
- Testing procedures

---

## Implementation Timeline

### Week 1-2: Database and Core Setup

- Database migrations
- NestJS dependencies
- Basic service structure

### Week 3-4: Service Implementation

- StripeConnectService
- StripePaymentService
- StripeWebhookService

### Week 5-6: Controller and API Development

- REST endpoints
- Webhook handling
- Error management

### Week 7-8: Frontend Integration

- Onboarding flows
- Payment processing
- Dashboard updates

### Week 9-10: Testing and Refinement

- Comprehensive testing
- Cross-border validation
- Performance optimization

### Week 11-12: Production Deployment

- Staging environment testing
- Production deployment
- Live monitoring setup

---

## Risk Mitigation

### Technical Risks:

- **API Rate Limits:** Implement proper rate limiting and retry logic
- **Webhook Reliability:** Duplicate event handling and idempotency
- **Data Consistency:** Transaction-based updates with rollback capability

### Business Risks:

- **Regulatory Changes:** Monitor Stripe policy updates
- **Cross-Border Restrictions:** Have contingency plans for US/CA limitations
- **Fee Structure Changes:** Flexible fee calculation system

### Security Risks:

- **Webhook Security:** Proper signature verification
- **PCI Compliance:** Use Stripe's secure payment processing
- **Data Protection:** Encrypt sensitive financial data

---

## Success Criteria

### Technical Success:

- 99.5%+ payment processing success rate
- <2 second average payment confirmation time
- Zero security incidents
- 100% webhook event processing

### Business Success:

- 95%+ promoter onboarding completion rate
- <24 hour average onboarding time
- Platform fee collection accuracy 99.9%+
- Compliance with all regional regulations

---

This implementation plan provides a comprehensive roadmap for integrating Stripe Connect into your NestJS campaign platform. Each phase builds upon the previous one, ensuring a systematic and reliable implementation process.

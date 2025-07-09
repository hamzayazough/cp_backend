# Payment System Modular Architecture

## Overview

The payment system has been refactored from a single monolithic service into a modular architecture for better maintainability, separation of concerns, and testability.

## Architecture

### Core Services

#### 1. PaymentProcessingService (`payment-processing.service.ts`)

**Responsibility**: Campaign payment processing, charges, payouts, and refunds

- `chargeCampaignBudget()` - Process upfront campaign charges
- `executePromoterPayout()` - Execute payouts to promoters
- `refundCampaignBudget()` - Process refunds to advertisers
- `getPayoutHistory()` - Retrieve payout history for promoters
- `getChargeHistory()` - Retrieve charge history for advertisers

#### 2. AccountingService (`accounting.service.ts`)

**Responsibility**: Balance tracking, monthly calculations, and financial reporting

- `updatePromoterBalance()` - Track promoter earnings
- `updateAdvertiserSpend()` - Track advertiser spending
- `calculateMonthlyPromoterEarnings()` - Calculate monthly earnings
- `calculateMonthlyAdvertiserSpend()` - Calculate monthly spend
- `processMonthlyPayouts()` - Process bulk monthly payouts
- `getPaymentDashboard()` - Generate financial dashboards

#### 3. StripeIntegrationService (`stripe-integration.service.ts`)

**Responsibility**: All Stripe API interactions and Connect account management

- `createPaymentIntent()` - Create Stripe payment intents
- `createTransfer()` - Create transfers to connected accounts
- `createRefund()` - Process refunds through Stripe
- `validateStripeAccount()` - Validate Connect account status
- `createStripeConnectAccount()` - Create new Connect accounts
- `getStripeAccountStatus()` - Get account verification status

#### 4. PaymentServiceImpl (`payment-orchestrator.service.ts`)

**Responsibility**: Main facade that orchestrates all payment operations

- Acts as the primary interface for controllers
- Delegates operations to appropriate specialized services
- Maintains backwards compatibility with existing code

### Module Organization

#### PaymentModule (`payment.module.ts`)

- Configures dependency injection for all payment services
- Imports required TypeORM entities
- Exports services for use in other modules

## Migration Guide

### For Existing Code

The main `PaymentService` interface remains unchanged. Existing code can continue to inject `PaymentService` and all methods will work as before.

```typescript
// This continues to work unchanged
constructor(
  @Inject('PaymentService')
  private readonly paymentService: PaymentService,
) {}
```

### For New Code

You can inject specific services for more focused functionality:

```typescript
// Inject specific services for new features
constructor(
  private readonly accountingService: AccountingService,
  private readonly stripeService: StripeIntegrationService,
) {}
```

## Benefits

### 1. **Separation of Concerns**

- Payment processing logic is separate from accounting logic
- Stripe integration is isolated from business logic
- Each service has a single, well-defined responsibility

### 2. **Improved Testability**

- Services can be tested independently
- Mock dependencies are easier to create and manage
- Unit tests are more focused and faster

### 3. **Better Maintainability**

- Changes to Stripe integration don't affect accounting logic
- New payment features can be added to specific services
- Code is easier to understand and navigate

### 4. **Enhanced Scalability**

- Services can be optimized independently
- Caching strategies can be applied per service
- Performance monitoring is more granular

## Future Enhancements

### Real Stripe Integration

The `StripeIntegrationService` currently uses mock implementations. To enable real Stripe integration:

1. Update the Stripe SDK imports
2. Replace mock methods with real Stripe API calls
3. Add proper error handling for Stripe-specific errors
4. Configure webhook handling for payment events

### Additional Services

The modular architecture allows for easy addition of new services:

- **NotificationService**: Handle payment notifications
- **AuditService**: Track all payment operations for compliance
- **ReportingService**: Generate detailed financial reports
- **FraudDetectionService**: Monitor for suspicious payment activity

## Configuration

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMENT_MINIMUM_PAYOUT=5000  # $50.00 in cents
```

### Database

All payment-related entities are automatically configured through the PaymentModule.

## Error Handling

Each service implements consistent error handling:

- Input validation with `BadRequestException`
- External service errors with `InternalServerErrorException`
- Comprehensive logging for debugging
- Transaction rollback on failures

## Testing

### Unit Tests

Each service should have comprehensive unit tests:

```typescript
// Example test structure
describe('PaymentProcessingService', () => {
  describe('chargeCampaignBudget', () => {
    it('should charge campaign budget successfully', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

Test service interactions:

```typescript
describe('Payment Integration', () => {
  it('should complete full payment flow', async () => {
    // Test payment -> accounting -> stripe flow
  });
});
```

## Monitoring and Logging

All services use structured logging:

- Payment operations are logged with campaign/user IDs
- Stripe interactions include transaction IDs
- Error logs include stack traces for debugging
- Success logs include amounts and relevant IDs

## Security Considerations

- Stripe API keys are environment-based
- Payment amounts are validated before processing
- User permissions are checked before operations
- Sensitive data is not logged in production

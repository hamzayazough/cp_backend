/**
 * @deprecated Use PaymentServiceImpl from payment-orchestrator.service.ts instead
 * This file is kept for backwards compatibility and will be removed in a future version
 *
 * The payment functionality has been split into modular services:
 * - PaymentProcessingService: Handles charging, payouts, and refunds
 * - AccountingService: Handles balance tracking and financial reporting
 * - StripeIntegrationService: Handles all Stripe operations
 * - PaymentServiceImpl: Orchestrates all payment services (main facade)
 */

// Re-export the main service for backwards compatibility
export { PaymentServiceImpl } from './payment-orchestrator.service';
export { PaymentProcessingService } from './payment-processing.service';
export { AccountingService } from './accounting.service';
export { StripeIntegrationService } from './stripe-integration.service';

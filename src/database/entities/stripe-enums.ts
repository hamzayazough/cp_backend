// Enums for Stripe Connect entities

export enum PaymentFlowType {
  DESTINATION = 'destination', // Funds are sent to a connected account, but the platform can take a fee
  DIRECT = 'direct', // Funds go directly to the connected account, with the platform optionally taking a fee.
  SEPARATE_TRANSFER = 'separate_transfer', // The platform receives the payment, then separately transfers funds to the connected account.
  HOLD_AND_TRANSFER = 'hold_and_transfer', // Funds are held by the platform and transferred later (often for compliance or custom payout logic)
}

export enum StripePaymentIntentStatus {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method', // A payment method (e.g., card) needs to be attached
  REQUIRES_CONFIRMATION = 'requires_confirmation', // The payment needs to be confirmed by the customer or platform
  REQUIRES_ACTION = 'requires_action', // Additional action required (e.g., 3D Secure authentication)
  PROCESSING = 'processing', // The payment is being processed by Stripe
  REQUIRES_CAPTURE = 'requires_capture', // Payment is authorized and needs to be captured
  CANCELED = 'canceled', // The payment was canceled and will not be completed
  SUCCEEDED = 'succeeded', // The payment was successfully completed
}

export enum StripeTransferStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum PlatformFeeType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  NONE = 'none', // Add missing NONE type
}

export enum BusinessType {
  LLC = 'llc', // Limited Liability Company
  CORPORATION = 'corporation', // Incorporated business entity
  PARTNERSHIP = 'partnership', // Business owned by two or more individuals
  SOLE_PROPRIETORSHIP = 'sole_proprietorship', // Single individual business owner
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REQUIRES_DOCUMENTS = 'requires_documents',
  REJECTED = 'rejected',
}

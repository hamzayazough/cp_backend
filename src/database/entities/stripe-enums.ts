// Enums for Stripe Connect entities

export enum PaymentFlowType {
  DESTINATION = 'destination',
  DIRECT = 'direct',
  SEPARATE_TRANSFER = 'separate_transfer',
  HOLD_AND_TRANSFER = 'hold_and_transfer', // Add missing type
}

export enum StripePaymentIntentStatus {
  REQUIRES_PAYMENT_METHOD = 'requires_payment_method',
  REQUIRES_CONFIRMATION = 'requires_confirmation',
  REQUIRES_ACTION = 'requires_action',
  PROCESSING = 'processing',
  REQUIRES_CAPTURE = 'requires_capture',
  CANCELED = 'canceled',
  SUCCEEDED = 'succeeded',
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
  LLC = 'llc',
  CORPORATION = 'corporation',
  PARTNERSHIP = 'partnership',
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REQUIRES_DOCUMENTS = 'requires_documents',
  REJECTED = 'rejected',
}

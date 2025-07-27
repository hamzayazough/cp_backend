# Stripe Integration Guide: Advertiser & Promoter Users

This guide explains how to integrate Stripe for both advertiser (spending money) and promoter (receiving money) users. It covers backend entities, endpoints, and the frontend flow for each user type.

---

## User Types

- **Advertiser:** Creates campaigns and pays promoters. Only spends money.
- **Promoter:** Completes jobs and receives payouts. Needs Stripe Connect onboarding.

---

## Key Entities & Enums

### UserEntity

- Stores your platform's user data.
- Important fields:
  - `id`: User ID
  - `email`: User email
  - `stripeAccountId`: Stripe Connect account ID (for promoters only)
  - `role`: 'ADVERTISER', 'PROMOTER', etc.

### StripeConnectAccount (Promoter Only)

- Stores Stripe account info and onboarding status for each promoter.
- Important fields:
  - `userId`: Reference to your user
  - `stripeAccountId`: Stripe account ID
  - `status`: Account status (pending, active, restricted)
  - `chargesEnabled`, `payoutsEnabled`: Stripe flags for account readiness

### Enums

- `BusinessType`: LLC, CORPORATION, PARTNERSHIP, SOLE_PROPRIETORSHIP
- `VerificationStatus`: PENDING, VERIFIED, REQUIRES_DOCUMENTS, REJECTED
- `PaymentFlowType`, `StripePaymentIntentStatus`, etc. (for payment logic)

---

## Backend Endpoints

### For Advertisers (Spending Money)

1. **Create User**
   - Endpoint: `POST /auth/create-account`
   - Input: Firebase token
   - Output: User object

2. **Create PaymentIntent**
   - Endpoint: `POST /stripe/payments/intent`
   - Input: campaignId, payerId, recipientId, amount, etc.
   - Output: Stripe PaymentIntent client secret

3. **Confirm PaymentIntent**
   - Endpoint: `POST /stripe/payments/intent/:paymentIntentId/confirm`
   - Input: paymentMethodId (from Stripe.js)
   - Output: Payment confirmation result

4. **Capture PaymentIntent** (if using manual capture)
   - Endpoint: `POST /stripe/payments/intent/:paymentIntentId/capture`

### For Promoters (Receiving Money)

1. **Create User**
   - Endpoint: `POST /auth/create-account`

2. **Create Stripe Connect Account**
   - Endpoint: `POST /connect/create-account`
   - Output: Stripe account info

3. **Get Stripe Onboarding Link**
   - Endpoint: `GET /connect/onboard`
   - Output: URL to redirect user to Stripe onboarding

4. **Handle Stripe Callback**
   - Endpoint: `GET /connect/oauth/callback`

5. **Check Onboarding Status**
   - Endpoint: `GET /connect/onboarding-status/:userId`

---

## Frontend Flow

### Advertiser (Spender)

1. User signs up → call `/auth/create-account`.
2. User creates campaign and wants to pay → collect card info using Stripe.js (Elements or Checkout).
3. Call `/stripe/payments/intent` to create PaymentIntent and get client secret.
4. Use Stripe.js to confirm payment with client secret and card info.
5. Optionally, call `/stripe/payments/intent/:paymentIntentId/confirm` if using manual confirmation.
6. Do NOT store card details; Stripe handles all sensitive data.

### Promoter (Receiver)

1. User signs up → call `/auth/create-account`.
2. User wants to receive payouts → call `/connect/create-account`.
3. Get onboarding link → call `/connect/onboard` and redirect user to Stripe onboarding.
4. After onboarding, Stripe redirects back to your app via `/connect/oauth/callback`.
5. Poll `/connect/onboarding-status/:userId` to check if onboarding is complete.
6. When onboarding is complete, user can receive payouts.

---

## Important Notes

- **Advertisers do NOT need Stripe Connect accounts or onboarding.**
- **Promoters MUST complete Stripe Connect onboarding to receive payouts.**
- **Never collect or store card details in your backend.** Use Stripe.js on the frontend.
- **Store only Stripe account IDs, PaymentIntent IDs, and onboarding status as needed.**
- **Use Stripe’s API to check account readiness for payouts:**
  - `charges_enabled` and `payouts_enabled` must be true.
  - No outstanding requirements.

---

## Example Flows

### Advertiser

1. Sign up → `/auth/create-account`
2. Create campaign and pay → `/stripe/payments/intent` → Stripe.js for payment

### Promoter

1. Sign up → `/auth/create-account`
2. Onboard for payouts → `/connect/create-account` → `/connect/onboard` → Stripe onboarding
3. Check onboarding status → `/connect/onboarding-status/:userId`

---

## Stripe Account Status

- **Pending:** User has not completed onboarding or requirements.
- **Active:** User is fully onboarded and can receive payments.
- **Restricted:** User has missing info or failed verification.

---

## Summary

- Use Stripe.js and PaymentIntents for advertisers to pay securely.
- Use Stripe Connect onboarding for promoters to receive payouts.
- Only store Stripe account IDs and onboarding status.
- Let Stripe handle all compliance and sensitive data collection.

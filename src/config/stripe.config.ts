export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  connectClientId?: string;
  apiVersion: string;
  currency: string;
  platformFeePercentage: number;
  supportedCountries: string[];
  returnUrl: string;
  refreshUrl: string;
}

export const stripeConfig = (): StripeConfig => ({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID || '',
  apiVersion: process.env.STRIPE_API_VERSION || '2023-10-16',
  currency: process.env.DEFAULT_CURRENCY || 'USD',
  platformFeePercentage: parseFloat(
    process.env.PLATFORM_FEE_PERCENTAGE || '5.0',
  ),
  supportedCountries: (process.env.SUPPORTED_COUNTRIES || 'US,CA').split(','),
  returnUrl:
    process.env.STRIPE_CONNECT_RETURN_URL ||
    'http://localhost:3000/api/connect/oauth/callback',
  refreshUrl:
    process.env.STRIPE_CONNECT_REFRESH_URL ||
    'http://localhost:3000/api/connect/oauth/callback',
});

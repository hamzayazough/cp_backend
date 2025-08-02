import { Transaction } from '../database/entities/transaction.entity';

interface ExchangeRateResponse {
  result: number;
}

interface CachedRate {
  rate: number;
  expiresAt: Date;
}

const fxRateCache = new Map<string, CachedRate>();
const FALLBACK_RATES: Record<string, number> = {
  USD_CAD: 1.38,
  CAD_USD: 1 / 1.38,
};

/**
 * Initialize FX rates cache by pre-fetching current rates
 * Call this on application startup
 */
export async function initializeFxRates(): Promise<void> {
  try {
    await fetchFxRate('USD', 'CAD');
    await fetchFxRate('CAD', 'USD');
    console.log('FX rates initialized successfully');
  } catch (error) {
    console.error(
      'Failed to initialize FX rates, using fallback rates:',
      error,
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    fxRateCache.set('USD_CAD', { rate: FALLBACK_RATES['USD_CAD'], expiresAt });
    fxRateCache.set('CAD_USD', { rate: FALLBACK_RATES['CAD_USD'], expiresAt });
  }
}

/**
 * Gets cached FX rate synchronously
 * @param from Source currency
 * @param to Target currency
 * @returns number - conversion rate or fallback rate
 */
export function getCachedFxRate(
  from: 'USD' | 'CAD',
  to: 'USD' | 'CAD',
): number {
  if (from === to) return 1;

  const cacheKey = `${from}_${to}`;
  const cached = fxRateCache.get(cacheKey);

  if (cached && cached.expiresAt > new Date()) {
    return cached.rate;
  }

  return FALLBACK_RATES[cacheKey] || 1;
}

/**
 * Fetches the latest FX rate from exchangerate.host (with daily caching)
 * @param from Source currency (e.g. 'USD')
 * @param to Target currency (e.g. 'CAD')
 * @returns number - conversion rate
 */
export async function fetchFxRate(
  from: 'USD' | 'CAD',
  to: 'USD' | 'CAD',
): Promise<number> {
  if (from === to) return 1;

  const cacheKey = `${from}_${to}`;
  const cached = fxRateCache.get(cacheKey);

  if (cached && cached.expiresAt > new Date()) {
    return cached.rate;
  }

  const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch FX rate: ${res.status}`);
  const data = (await res.json()) as ExchangeRateResponse;
  if (!data.result) throw new Error('No FX rate found in response');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  fxRateCache.set(cacheKey, {
    rate: data.result,
    expiresAt,
  });

  return data.result;
}

/**
 * Converts the transaction amount to the user's usedCurrency if needed (synchronous, uses cached FX rates).
 * @param usedCurrency 'USD' | 'CAD'
 * @param transaction Transaction (with optional paymentRecord relation loaded)
 * @returns number - amount in user's currency
 */
export function getTransactionAmountInUserCurrency(
  usedCurrency: 'USD' | 'CAD',
  transaction: Transaction,
): number {
  const paymentRecord = transaction.paymentRecord;
  const safeAmount = Number(transaction.amount) || 0;

  if (paymentRecord && paymentRecord.currency) {
    if (paymentRecord.currency === usedCurrency) {
      return safeAmount;
    } else {
      const fromCurrency = paymentRecord.currency as 'USD' | 'CAD';
      if (!['USD', 'CAD'].includes(fromCurrency)) {
        throw new Error(`Unsupported currency: ${paymentRecord.currency}`);
      }
      const rate = getCachedFxRate(fromCurrency, usedCurrency);
      const convertedAmount = safeAmount * rate;
      return isFinite(convertedAmount) ? Number(convertedAmount.toFixed(2)) : 0;
    }
  }
  return safeAmount;
}

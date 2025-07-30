import { PromoterDashboardRequest } from '../../interfaces/promoter-dashboard';

// Configuration map for dashboard data fetching
export interface DashboardDataConfig {
  property: keyof PromoterDashboardRequest;
  dataKey: string;
  method: string;
  limitProperty?: keyof PromoterDashboardRequest;
  defaultLimit?: number;
}

// Helper function to get limit value with proper typing
export const getLimitValue = (
  request: PromoterDashboardRequest,
  limitProperty?: keyof PromoterDashboardRequest,
  defaultLimit?: number,
): number => {
  if (!limitProperty || defaultLimit === undefined) {
    return 0;
  }
  return (request[limitProperty] as number) || defaultLimit;
};

// Configuration map that defines what data to fetch based on request properties
export const DASHBOARD_DATA_CONFIG: DashboardDataConfig[] = [
  {
    property: 'includeStats',
    dataKey: 'stats',
    method: 'getPromoterStats',
  },
  {
    property: 'includeCampaigns',
    dataKey: 'activeCampaigns',
    method: 'getActiveCampaigns',
    limitProperty: 'activeCampaignLimit',
    defaultLimit: 10,
  },
  {
    property: 'includeSuggestions',
    dataKey: 'suggestedCampaigns',
    method: 'getSuggestedCampaigns',
    limitProperty: 'suggestedCampaignLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeTransactions',
    dataKey: 'recentTransactions',
    method: 'getRecentTransactions',
    limitProperty: 'transactionLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeMessages',
    dataKey: 'recentMessages',
    method: 'getRecentMessages',
    limitProperty: 'messageLimit',
    defaultLimit: 5,
  },
  {
    property: 'includeWallet',
    dataKey: 'wallet',
    method: 'getWalletInfo',
  },
];

export interface QueryResult {
  total?: string;
  avg?: string;
}

export interface BudgetQueryResult {
  allocated?: string;
  spent?: string;
}

export interface TopCampaignQueryResult {
  id: string;
  title: string;
  views: string;
  sales: string;
  activePromoters: string;
}

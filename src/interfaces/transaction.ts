export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: "PAYOUT" | "DEPOSIT";
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
}

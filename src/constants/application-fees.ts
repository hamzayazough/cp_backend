export const APPLICATION_FEE = 0.2; // 20% application fee

export const AmountAfterApplicationFee = (amount: number): number => {
  return amount * (1 - APPLICATION_FEE);
};

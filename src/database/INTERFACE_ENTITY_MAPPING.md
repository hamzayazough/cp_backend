# Interface to Entity Mapping

## Complete Entity Coverage Summary

| Interface/DTO                    | Entity File                              | Status      |
| -------------------------------- | ---------------------------------------- | ----------- |
| **ANALYTICS INTERFACES**         |
| `CampaignAnalytics`              | `campaign-analytics.entity.ts`           | ✅ Created  |
| `PromoterPerformanceMetrics`     | `promoter-performance-metrics.entity.ts` | ✅ Created  |
| `AdvertiserAnalytics`            | `advertiser-analytics.entity.ts`         | ✅ Created  |
| `PlatformMetrics`                | `platform-metrics.entity.ts`             | ✅ Created  |
| **FINANCIAL INTERFACES**         |
| `PaymentTransaction`             | `payment-transaction.entity.ts`          | ✅ Created  |
| `StripeConnectAccount`           | `stripe-connect-account.entity.ts`       | ✅ Created  |
| `PaymentMethod`                  | `payment-method.entity.ts`               | ✅ Created  |
| `CampaignBudgetAllocation`       | `campaign-budget-allocation.entity.ts`   | ✅ Created  |
| `BillingPeriodSummary`           | `billing-period-summary.entity.ts`       | ✅ Created  |
| `FinancialAnalytics`             | `financial-analytics.entity.ts`          | ✅ Created  |
| `PayoutSettings`                 | `payout-settings.entity.ts`              | ✅ Created  |
| `Invoice`                        | `invoice.entity.ts`                      | ✅ Created  |
| **PAYMENT INTERFACES**           |
| `PayoutRecord`                   | `payout-record.entity.ts`                | ✅ Existing |
| `AdvertiserCharge`               | `advertiser-charge.entity.ts`            | ✅ Existing |
| **PROMOTER-CAMPAIGN INTERFACES** |
| `PromoterCampaign`               | `promoter-campaign.entity.ts`            | ✅ Existing |
| **WALLET INTERFACES**            |
| `Wallet`                         | `wallet.entity.ts`                       | ✅ Existing |

## Additional Supporting Entities

| Purpose             | Entity File                    | Status      |
| ------------------- | ------------------------------ | ----------- |
| Core business logic | `user.entity.ts`               | ✅ Existing |
| Core business logic | `campaign.entity.ts`           | ✅ Existing |
| Core business logic | `transaction.entity.ts`        | ✅ Existing |
| Balance tracking    | `promoter-balance.entity.ts`   | ✅ Existing |
| Spending tracking   | `advertiser-spend.entity.ts`   | ✅ Existing |
| User profiles       | `advertiser-details.entity.ts` | ✅ Existing |
| User profiles       | `promoter-details.entity.ts`   | ✅ Existing |
| Social metrics      | `follower-estimate.entity.ts`  | ✅ Existing |
| Communication       | `message.entity.ts`            | ✅ Existing |

## Total Entity Count: 31 entities

### New Entities Created: 12

### Existing Entities: 19

All interfaces and DTOs are now fully covered by corresponding database entities.

# CrowdProp Database Schema Documentation

This directory contains the complete database schema for the CrowdProp application, organized into modular SQL files for better maintainability and development workflow.

## File Structure

### Core Schema Files

1. **`01_enums.sql`** - All PostgreSQL enum types
   - User roles, advertiser types, campaign types
   - Payment and transaction status enums
   - Platform and business logic enums

2. **`02_core_tables.sql`** - Core business entity tables
   - Users, advertiser_details, promoter_details
   - User profiles, skills, languages, portfolios
   - Essential business data structures

3. **`03_campaign_tables.sql`** - Campaign-related tables
   - Campaigns, applications, participation tracking
   - Campaign budget allocations (simplified)
   - View statistics and performance tracking

4. **`04_financial_tables.sql`** - Financial and payment tables
   - Wallets, transactions, payout records
   - Stripe Connect integration
   - Sales records for commission tracking
   - Payment methods and billing

5. **`05_analytics_tables.sql`** - Analytics and metrics tables
   - Campaign analytics and performance metrics
   - Promoter and advertiser performance tracking
   - Platform-wide metrics and reporting
   - Financial analytics and billing summaries

6. **`06_messaging_tables.sql`** - Communication tables
   - Message threads and individual messages
   - Chat summaries and sentiment analysis

7. **`07_functions_triggers.sql`** - Database functions and triggers
   - Updated timestamp triggers
   - Business logic functions
   - Data validation triggers

8. **`08_indexes.sql`** - Performance optimization indexes
   - Query optimization indexes
   - Foreign key performance indexes
   - Search and filtering indexes

### Initialization Files

- **`init_master.sql`** - Master initialization script
  - Runs all schema files in correct order
  - Single command database setup
  - Production deployment script

- **`init.sql`** - Legacy monolithic schema (deprecated)
  - Kept for reference and migration purposes
  - Will be removed in future versions

## Database Setup

### Quick Setup (Recommended)

```bash
# From the database directory
psql -d crowdprop -f init_master.sql
```

### Manual Setup (Development)

```bash
# Run files individually in order
psql -d crowdprop -f 01_enums.sql
psql -d crowdprop -f 02_core_tables.sql
psql -d crowdprop -f 03_campaign_tables.sql
psql -d crowdprop -f 04_financial_tables.sql
psql -d crowdprop -f 05_analytics_tables.sql
psql -d crowdprop -f 06_messaging_tables.sql
psql -d crowdprop -f 07_functions_triggers.sql
psql -d crowdprop -f 08_indexes.sql
```

## Key Design Principles

### 1. Campaign Budget Allocation (Simplified)

The `campaign_budget_allocations` table has been simplified to focus on core budget tracking:

- **Visibility campaigns**: Uses `rate_per_100_views`, earnings tracked in `wallets`
- **Consultant/Seller campaigns**: Uses `total_budget` + `min_budget`, direct payments via `payout_records`
- **Salesman campaigns**: Uses `commission_rate`, sales tracked in `sales_records`

### 2. Financial Architecture

- **Separation of Concerns**: Each financial table handles its specific domain
- **Stripe Integration**: Dedicated `stripe_connect_accounts` table
- **Threshold Management**: $20 minimum payout threshold for visibility/salesman campaigns
- **Audit Trail**: Complete transaction history and payout tracking

### 3. Analytics and Reporting

- **Performance Metrics**: Campaign, promoter, and advertiser analytics
- **Financial Analytics**: Revenue, growth, and efficiency tracking
- **Platform Metrics**: System-wide health and usage statistics

### 4. Scalability and Performance

- **Proper Indexing**: Comprehensive index strategy for query optimization
- **Normalized Design**: Reduced redundancy and improved data integrity
- **Trigger-based Updates**: Automatic timestamp and data consistency management

## Campaign Types and Business Logic

### VISIBILITY Campaigns

- **Budget Flow**: Advertiser funds → `campaign_budget_allocations` → `wallets` (monthly)
- **Payout Logic**: Accumulate earnings until $20 threshold, then monthly payout
- **Tracking**: Views counted, earnings calculated based on `rate_per_100_views`

### CONSULTANT/SELLER Campaigns

- **Budget Flow**: Advertiser funds → `campaign_budget_allocations` → direct `payout_records`
- **Payout Logic**: Immediate payments upon campaign completion/milestones
- **Tracking**: Fixed price or hourly rate payments

### SALESMAN Campaigns

- **Budget Flow**: Sales tracked in `sales_records` → `wallets` (monthly)
- **Payout Logic**: Commission accumulation with $20 threshold
- **Tracking**: Individual sales with commission calculations

## Migration Notes

- The original `init.sql` contained overlapping responsibilities
- The new structure separates concerns for better maintainability
- All TypeORM entities have been updated to match the simplified schema
- No breaking changes to existing business logic

## Development Workflow

1. **Schema Changes**: Update individual SQL files, not the master
2. **Testing**: Use `init_master.sql` for clean database setup
3. **Migrations**: Create separate migration scripts for production updates
4. **Documentation**: Update this README for any structural changes

## Security Considerations

- All financial data uses appropriate precision (DECIMAL types)
- Proper foreign key constraints for data integrity
- Stripe-specific fields for PCI compliance
- User data isolation through proper table relationships

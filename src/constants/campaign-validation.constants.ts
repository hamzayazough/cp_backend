export const CAMPAIGN_VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Campaign title is required',
  DESCRIPTION_REQUIRED: 'Campaign description is required',
  START_DATE_REQUIRED: 'Start date is required',
  DEADLINE_REQUIRED: 'Deadline is required',
  START_DATE_PAST: 'Start date cannot be in the past',
  DEADLINE_BEFORE_START: 'Deadline must be after start date',
  INVALID_CAMPAIGN_TYPE: 'Invalid campaign type',

  // Visibility campaign validations
  CPV_REQUIRED: 'CPV must be greater than 0',
  TRACKING_LINK_REQUIRED: 'Tracking link is required for visibility campaigns',

  // Consultant campaign validations
  EXPECTED_DELIVERABLES_REQUIRED:
    'Expected deliverables are required for consultant campaigns',

  // Budget validations (for consultant, seller campaigns)
  MAX_BUDGET_REQUIRED: 'Max budget must be greater than 0',
  MIN_BUDGET_REQUIRED: 'Min budget must be greater than 0',
  MIN_BUDGET_LESS_THAN_MAX: 'Min budget must be less than max budget',

  // Salesman campaign validations
  COMMISSION_REQUIRED: 'Commission per sale must be greater than 0',
  SALES_TRACKING_REQUIRED: 'Sales tracking method is required',
} as const;

export const CAMPAIGN_SUCCESS_MESSAGES = {
  FILE_UPLOADED: 'File uploaded successfully',
  CAMPAIGN_CREATED: 'Campaign created successfully',
} as const;

export const CAMPAIGN_ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  CAMPAIGN_CREATION_FAILED: 'Failed to create campaign',
  INVALID_CAMPAIGN_TYPE_ENTITY: 'Invalid campaign type in entity',
  CAMPAIGN_NOT_FOUND: 'Campaign not found or access denied',
} as const;

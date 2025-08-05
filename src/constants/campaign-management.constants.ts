/**
 * Constants for campaign management and expiration handling
 */
export const CAMPAIGN_MANAGEMENT_CONSTANTS = {
  /**
   * Time intervals for campaign expiration checks
   */
  EXPIRATION_INTERVALS: {
    ONE_WEEK_DAYS: 7,
    ONE_DAY_DAYS: 1,
    TODAY_DAYS: 0,
  },

  /**
   * Cron schedule expressions
   */
  CRON_SCHEDULES: {
    DAILY_CHECK: '0 0 * * *', // Run at midnight every day
    MONTHLY_CHECK: '0 0 1 * *', // Run at midnight on the first day of every month
  },

  /**
   * Email notification types
   */
  EMAIL_TYPES: {
    CAMPAIGN_ENDING_WEEK: 'CAMPAIGN_ENDING_WEEK',
    CAMPAIGN_ENDING_DAY: 'CAMPAIGN_ENDING_DAY',
  },

  /**
   * Campaign completion status values
   */
  COMPLETION_STATUS: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
  },

  /**
   * Promoter campaign status values
   */
  PROMOTER_CAMPAIGN_STATUS: {
    ONGOING: 'ONGOING',
    AWAITING_REVIEW: 'AWAITING_REVIEW',
    COMPLETED: 'COMPLETED',
  },

  /**
   * User roles
   */
  USER_ROLES: {
    ADVERTISER: 'ADVERTISER',
    PROMOTER: 'PROMOTER',
  },

  /**
   * Error messages
   */
  ERROR_MESSAGES: {
    CAMPAIGN_NOT_FOUND: 'Campaign not found',
    USER_NOT_FOUND: 'User not found',
    PROMOTER_DETAILS_NOT_FOUND: 'Promoter details not found',
    EMAIL_SEND_FAILED: 'Failed to send email notification',
    CAMPAIGN_COMPLETION_FAILED: 'Failed to complete campaign',
    PROMOTER_CAMPAIGN_UPDATE_FAILED:
      'Failed to update promoter campaign status',
    USER_STATS_UPDATE_FAILED: 'Failed to update user campaign statistics',
  },

  /**
   * Success messages
   */
  SUCCESS_MESSAGES: {
    EXPIRATION_CHECK_COMPLETED:
      'Campaign expiration check completed successfully',
    EMAIL_SENT: 'Email notification sent successfully',
    CAMPAIGN_COMPLETED: 'Campaign completed successfully',
    PROMOTER_CAMPAIGN_COMPLETED: 'Promoter campaign marked as completed',
    USER_STATS_UPDATED: 'User campaign statistics updated successfully',
  },

  /**
   * Email templates
   */
  EMAIL_TEMPLATES: {
    CAMPAIGN_ENDING_WEEK: {
      SUBJECT: 'Your campaign "{campaignTitle}" is ending in one week',
      MESSAGE: `
        Hello {advertiserName},
        
        This is a reminder that your campaign "{campaignTitle}" is scheduled to end on {deadline}.
        
        You have one week remaining to make any final adjustments or extend the campaign if needed.
        
        Campaign Details:
        - Title: {campaignTitle}
        - Type: {campaignType}
        - Deadline: {deadline}
        
        If you need to make any changes, please log in to your dashboard.
        
        Best regards,
        The CrowdPro Team
      `,
    },
    CAMPAIGN_ENDING_DAY: {
      SUBJECT: 'Your campaign "{campaignTitle}" is ending tomorrow',
      MESSAGE: `
        Hello {advertiserName},
        
        This is your final reminder that your campaign "{campaignTitle}" is scheduled to end tomorrow ({deadline}).
        
        After the deadline, your campaign will be automatically marked as inactive and promoters will no longer be able to participate.
        
        Campaign Details:
        - Title: {campaignTitle}
        - Type: {campaignType}
        - Deadline: {deadline}
        
        If you need to extend the campaign, please log in to your dashboard before the deadline.
        
        Best regards,
        The CrowdPro Team
      `,
    },
  },
} as const;

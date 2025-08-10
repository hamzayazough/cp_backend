export enum CampaignStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum CampaignType {
  VISIBILITY = 'VISIBILITY',
  CONSULTANT = 'CONSULTANT',
  SELLER = 'SELLER',
  SALESMAN = 'SALESMAN',
}

export enum SalesTrackingMethod {
  REF_LINK = 'REF_LINK',
  COUPON_CODE = 'COUPON_CODE',
}

export enum Deliverable {
  // Consultant Deliverables
  MARKETING_STRATEGY = 'MARKETING_STRATEGY', // Comprehensive promotion plan
  CONTENT_PLAN = 'CONTENT_PLAN', // Calendar and topic strategy
  SCRIPT = 'SCRIPT', // Scripts for ads, videos, or pitches
  MARKET_ANALYSIS = 'MARKET_ANALYSIS', // Competitor and market study
  BRAND_GUIDELINES = 'BRAND_GUIDELINES', // Tone, style, and visual identity recommendations
  WEEKLY_REPORT = 'WEEKLY_REPORT', // Progress or performance reports
  PERFORMANCE_AUDIT = 'PERFORMANCE_AUDIT', // Review of current campaigns
  LIVE_SESSION = 'LIVE_SESSION', // Coaching or Q&A sessions
  PRODUCT_FEEDBACK = 'PRODUCT_FEEDBACK', // Review and improvement suggestions
  AD_CONCEPTS = 'AD_CONCEPTS', // Creative ideas for ad campaigns

  // Seller Deliverables
  CREATE_SOCIAL_MEDIA_ACCOUNTS = 'CREATE_SOCIAL_MEDIA_ACCOUNTS', // New accounts dedicated to promotion
  SOCIAL_MEDIA_MANAGEMENT = 'SOCIAL_MEDIA_MANAGEMENT', // Ongoing posting, engagement, growth
  SPAM_PROMOTION = 'SPAM_PROMOTION', // Mass posting/distribution on multiple channels
  PROMOTIONAL_VIDEO = 'PROMOTIONAL_VIDEO', // Fully produced promotional video
  VIDEO_EDITING = 'VIDEO_EDITING', // Editing raw footage for marketing use
  INSTAGRAM_POST = 'INSTAGRAM_POST', // Image, carousel, or reel
  TIKTOK_VIDEO = 'TIKTOK_VIDEO', // Short-form video content
  BLOG_ARTICLE = 'BLOG_ARTICLE', // SEO-friendly written content
  EMAIL_CAMPAIGN = 'EMAIL_CAMPAIGN', // Designed email blast
  PAID_ADS_CREATION = 'PAID_ADS_CREATION', // Ads for Facebook, Google, TikTok, etc.
  PRODUCT_REVIEW = 'PRODUCT_REVIEW', // Written or recorded review
  EVENT_PROMOTION = 'EVENT_PROMOTION', // Livestreams, giveaways, coverage
  DIRECT_OUTREACH = 'DIRECT_OUTREACH', // Search for clients via DMs, emails, cold calls, etc.

  // Shared
  CUSTOM = 'CUSTOM', // Any custom-defined deliverable
}

export enum ConsultantDeliverable {
  MARKETING_STRATEGY = 'MARKETING_STRATEGY', // Comprehensive promotion plan
  CONTENT_PLAN = 'CONTENT_PLAN', // Calendar and topic strategy
  SCRIPT = 'SCRIPT', // Scripts for ads, videos, or pitches
  MARKET_ANALYSIS = 'MARKET_ANALYSIS', // Competitor and market study
  BRAND_GUIDELINES = 'BRAND_GUIDELINES', // Tone, style, and visual identity recommendations
  WEEKLY_REPORT = 'WEEKLY_REPORT', // Progress or performance reports
  PERFORMANCE_AUDIT = 'PERFORMANCE_AUDIT', // Review of current campaigns
  LIVE_SESSION = 'LIVE_SESSION', // Coaching or Q&A sessions
  PRODUCT_FEEDBACK = 'PRODUCT_FEEDBACK', // Review and improvement suggestions
  AD_CONCEPTS = 'AD_CONCEPTS', // Creative ideas for ad campaigns
  CUSTOM = 'CUSTOM', // Any custom consultant-defined deliverable
}

export enum SellerDeliverable {
  CREATE_SOCIAL_MEDIA_ACCOUNTS = 'CREATE_SOCIAL_MEDIA_ACCOUNTS', // New accounts dedicated to promotion
  SOCIAL_MEDIA_MANAGEMENT = 'SOCIAL_MEDIA_MANAGEMENT', // Ongoing posting, engagement, growth
  SPAM_PROMOTION = 'SPAM_PROMOTION', // Mass posting/distribution on multiple channels
  PROMOTIONAL_VIDEO = 'PROMOTIONAL_VIDEO', // Fully produced promotional video
  VIDEO_EDITING = 'VIDEO_EDITING', // Editing raw footage for marketing use
  INSTAGRAM_POST = 'INSTAGRAM_POST', // Image, carousel, or reel
  TIKTOK_VIDEO = 'TIKTOK_VIDEO', // Short-form video content
  BLOG_ARTICLE = 'BLOG_ARTICLE', // SEO-friendly written content
  EMAIL_CAMPAIGN = 'EMAIL_CAMPAIGN', // Designed email blast
  PAID_ADS_CREATION = 'PAID_ADS_CREATION', // Ads for Facebook, Google, TikTok, etc.
  PRODUCT_REVIEW = 'PRODUCT_REVIEW', // Written or recorded review
  EVENT_PROMOTION = 'EVENT_PROMOTION', // Livestreams, giveaways, coverage
  DIRECT_OUTREACH = 'DIRECT_OUTREACH', // Search for clients via DMs, emails, cold calls, etc.
  CUSTOM = 'CUSTOM', // Any custom seller-defined deliverable
}

export enum MeetingPlan {
  ONE_TIME = 'ONE_TIME',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  CUSTOM = 'CUSTOM',
}

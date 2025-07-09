import { CampaignType } from '../enums/campaign-type';
import { CampaignStatus } from '../enums/campaign-status';
import { MeetingPlan } from '../enums/meeting-plan';
import { SalesTrackingMethod } from '../enums/sales-tracking-method';
import { Deliverable } from '../enums/deliverable';
import { SocialPlatform } from '../enums/social-platform';

// Base campaign interface - matches CampaignEntity
export interface Campaign {
  id: string;
  advertiserId: string; // Changed from createdBy to match entity
  title: string;
  description: string;
  campaignType: CampaignType; // Changed from type to match entity
  status: CampaignStatus;
  budget: number; // Required budget field from SQL schema
  spentBudget: number; // Tracks how much has been spent

  // Campaign-specific fields for VISIBILITY campaigns
  maxViews?: number;
  pricePerView?: number; // Changed from cpv to match entity

  // Campaign-specific fields for CONSULTANT campaigns
  hourlyRate?: number;
  totalHours?: number;
  meetingPlan?: MeetingPlan;
  expertiseRequired?: string;

  // Campaign-specific fields for SELLER campaigns
  deliverables?: Deliverable[];
  deadline?: Date;
  fixedPrice?: number;

  // Campaign-specific fields for SALESMAN campaigns
  commissionRate?: number; // Changed from commissionPerSale to match entity
  salesTrackingMethod?: SalesTrackingMethod; // Changed from trackSalesVia to match entity
  couponCode?: string;
  refLink?: string;

  // Common fields
  requirements?: string;
  targetAudience?: string;
  preferredPlatforms?: SocialPlatform[];
  minFollowers: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startsAt?: Date;
  endsAt?: Date;
}

export interface VisibilityCampaign extends Campaign {
  campaignType: CampaignType.VISIBILITY;
  maxViews: number;
  pricePerView: number; // Required for visibility campaigns
}

export interface ConsultantCampaign extends Campaign {
  campaignType: CampaignType.CONSULTANT;
  hourlyRate: number;
  totalHours: number;
  meetingPlan?: MeetingPlan;
  expertiseRequired?: string;
}

export interface SellerCampaign extends Campaign {
  campaignType: CampaignType.SELLER;
  deliverables?: Deliverable[];
  deadline?: Date;
  fixedPrice: number;
  meetingPlan?: MeetingPlan;
}

export interface SalesmanCampaign extends Campaign {
  campaignType: CampaignType.SALESMAN;
  commissionRate: number;
  salesTrackingMethod: SalesTrackingMethod;
  couponCode?: string;
  refLink?: string;
}

// Form data interface for campaign creation wizard
export interface CampaignFormData {
  // Basic Info (matches base Campaign interface)
  title: string;
  description: string;
  campaignType: CampaignType | null; // Changed from type to match entity
  budget: number;

  // Campaign-specific fields for VISIBILITY campaigns
  maxViews?: number;
  pricePerView?: number; // Changed from cpv

  // Campaign-specific fields for CONSULTANT campaigns
  hourlyRate?: number;
  totalHours?: number;
  meetingPlan?: MeetingPlan | null;
  expertiseRequired?: string;

  // Campaign-specific fields for SELLER campaigns
  deliverables?: Deliverable[];
  deadline?: Date | null;
  fixedPrice?: number;

  // Campaign-specific fields for SALESMAN campaigns
  commissionRate?: number; // Changed from commissionPerSale
  salesTrackingMethod?: SalesTrackingMethod | null; // Changed from trackSalesVia
  couponCode?: string;
  refLink?: string;

  // Common fields
  requirements?: string;
  targetAudience?: string;
  preferredPlatforms?: SocialPlatform[];
  minFollowers?: number;

  // Timestamps
  startsAt?: Date | null;
  endsAt?: Date | null;

  // UI-only fields (not sent to backend)
  file?: File | null;
}

/*
            EXPLANATION OF CAMPAIGN TYPES

    🧠 CAMPAIGN TYPES – FULL EXPLANATION
🎯 1. VISIBILITY Campaign
Used when an Advertiser wants maximum exposure (views or reach) for a product, link, or brand.

✅ Created by:
An Advertiser aiming to get traffic to a URL (e.g., website, YouTube, Instagram).

💡 Goal:
Get real people to view a specific link via promoters' audience.

👤 Promoter's role:
They get a shortlink (trackUrl) that redirects to the advertiser's URL.

They share the link via TikTok, Instagram, Snap, etc.

🔁 Access:
isPublic: true

No need to apply → Anyone can promote instantly.

💰 Earnings:
Based on CPV (cost per 100 views)

Tracked automatically using the redirect backend (trackUrl).

🔚 Ends when:
expiryDate is reached

OR maxViews limit hit

OR campaign is manually paused

🧠 2. CONSULTANT Campaign
Used when an Advertiser wants a skilled freelancer to provide expert help (e.g., content strategy, ad writing, etc.).

✅ Created by:
An Advertiser with specific consulting needs.

💡 Goal:
Receive professional consulting deliverables (written material, feedback, plans, etc.)

👤 Promoter's role:
They must apply with a pitch, portfolioUrl, and optionally a quote.

If selected, they:

Join a private Discord via discordInviteLink

Deliver via files and referenceUrl

Respect the number of meetings and deadlines

🔁 Access:
isPublic: false

Only one Promoter can be selected (selectedPromoterId)

📊 Success metric:
Deliverables sent (tracked manually)

Meetings held (meetingCount)

Progress shown via referenceUrl

Satisfaction of advertiser

🔚 Ends when:
Promoter is selected

All agreed deliverables completed

🛍️ 3. SELLER Campaign
Used when an Advertiser wants a Promoter to create and sell something (e.g., marketing material, landing pages).

✅ Created by:
An Advertiser who wants to outsource a small sales operation.

💡 Goal:
Let a promoter:

Build a product or asset

Sell or launch it using their social reach

👤 Promoter's role:
Apply with pitch, portfolio, and optionally quote

Once selected, they:

Join private Discord

Deliver on deliverables

Upload proof (links, images, assets) to PromoterLinks

🔁 Access:
isPublic: false

One promoter only → selectedPromoterId

📊 Success metric:
Deliverables submitted and accepted

Campaign links shown in PromoterLinks[]

On-time completion (deadlineStrict)

🔚 Ends when:
Promoter selected

Deliverables completed

💼 4. SALESMAN Campaign
Used when an Advertiser wants to generate sales using promo codes or trackable links.

✅ Created by:
An Advertiser looking to pay-per-sale via Promoters.

💡 Goal:
Boost sales conversions using influencers' audiences.

👤 Promoter's role:
Use a referral link or promo code (trackSalesVia)

Promote on socials

Get commission per sale (commissionPerSale)

Links include custom codePrefix to distinguish promoters

🔁 Access:
isPublic: false (by default in new structure)

📊 Success metric:
Tracked purchases via code or link

Paid commission per successful sale

🔚 Ends when:
Budget exhausted

Campaign expired

Manually paused by advertiser

🧩 Additional Notes:
All campaign types include a Discord invite (discordInviteLink) on creation for off-platform collaboration.

selectedPromoterId locks the campaign for types requiring manual approval.

All monetary values (like cpv, commissionPerSale, minBudget, maxBudget) are numeric and should be treated with currency-safe formatting.

All date fields (deadline, expiryDate) are actual Date objects — not strings.
*/

/*
            EXPLANATION OF CAMPAIGN TYPES

    🎯 1. VISIBILITY Campaign
    ✅ Created by:
    An Advertiser who wants exposure (views) on their product/site/social page.

    💡 Goal:
    Get traffic/views from Promoters on a target URL (e.g., website, YouTube video, TikTok).

    📝 Promoter’s role:
    They receive a trackable shortlink and promote it via their audience/socials.

    🔁 Access:
    isPublic: true

    applicationRequired: false
    → Any verified Promoter can join instantly and start promoting.

    📊 Success metric:
    Tracked views via redirect backend

    Based on cpv (cost per 100 views), Promoters earn money when views are unique

    🔚 Ends when:
    The campaign expires (expiryDate), or

    Max views reached or budget depleted

    🧠 2. CONSULTANT Campaign
    ✅ Created by:
    An Advertiser who wants expert help (e.g., content strategy, marketing advice).

    💡 Goal:
    Get tailored consulting or services (scripts, plans, videos, etc.)

    📝 Promoter’s role:
    Promoters apply with:

    Their pitch

    Optional portfolio

    Optional quote

    If selected, they deliver the expected results (e.g., weekly reports, videos).

    🔁 Access:
    isPublic: false

    applicationRequired: true
    → Promoters must apply first; Advertiser selects one.

    📊 Success metric:
    Deliverables sent (tracked manually or via file upload)

    Meetings held (recorded if needed)

    Satisfaction by the Advertiser

    🔚 Ends when:
    One Promoter is accepted → campaign becomes LOCKED

    After agreed deliverables are completed

    🛒 3. SELLER Campaign
    ✅ Created by:
    An Advertiser who wants Promoters to sell a digital product or service.

    💡 Goal:
    Get one person to create and sell something on their behalf.

    Ex: “Make me a promo pack, landing page, and sell it to your community.”

    📝 Promoter’s role:
    Submit a proposal (pitch, portfolio, quote)

    Deliver predefined deliverables once selected

    🔁 Access:
    isPublic: false

    applicationRequired: true
    → Promoters apply; only one will be accepted.

    📊 Success metric:
    Project completion (file submitted, link delivered)

    Optionally: client satisfaction, deadline respected

    🔚 Ends when:
    A Promoter is selected → no more applications allowed

    Deliverables are confirmed ✅

    💼 4. SALESMAN Campaign
    ✅ Created by:
    An Advertiser who wants sales through coupon codes, referral links, or both.

    💡 Goal:
    Let Promoters act as sales agents, bringing paying customers.

    📝 Promoter’s role:
    Receive a unique link or promo code

    Promote it to generate real sales

    🔁 Access:
    isPublic: true

    applicationRequired: false OR onlyApprovedCanSell: true
    → Depends on Advertiser's settings

    📊 Success metric:
    Tracked sales via:

    Referral link (UTM tracked / redirect)

    Coupon code (shown to buyer)

    Promoter gets a commission per sale (defined in campaign)

    🔚 Ends when:
    Budget exhausted

    Campaign expired

    Advertiser pauses it

*/

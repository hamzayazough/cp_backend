import {
  CampaignStatus,
  CampaignType,
  ViewTrackingStrategy,
  SalesTrackingMethod,
  Deliverable,
  MeetingPlan,
} from "../enums/campaign-type";
import { AdvertiserType } from "../enums/advertiser-type";

export interface Campaign {
  id: string;
  title: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  createdAt: string;
  updatedAt?: string;

  createdBy: string; // advertiserId
  advertiserType?: AdvertiserType[];

  isPublic: boolean; // Visibility or Salesman
  applicationRequired: boolean; // Consultant or Seller

  /** Shared Optional Fields */
  deadline?: Date;
  expiryDate?: Date;
  budget?: number;
  mediaUrl?: string;

  /** VISIBILITY */
  cpv?: number;
  maxViews?: number;
  trackUrl?: string;
  viewTrackingStrategy?: ViewTrackingStrategy;

  /** CONSULTANT */
  expectedDeliverables?: Deliverable[];
  meetingCount?: number;
  referenceUrl?: string;
  maxQuote?: number;

  /** SELLER */
  sellerRequirements?: Deliverable[];
  deliverables?: Deliverable[];
  meetingPlan?: MeetingPlan;
  deadlineStrict?: boolean;

  /** SALESMAN */
  commissionPerSale?: number;
  trackSalesVia?: SalesTrackingMethod;
  codePrefix?: string;
  onlyApprovedCanSell?: boolean;

  /** Optional selection result */
  selectedPromoterId?: string;
}

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

export type ApplicationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CANCELLED";

export interface CampaignApplication {
  id: string;
  campaignId: string;
  promoterId: string;
  pitch: string;
  portfolioUrl?: string; // Optional: additional link for review
  quote?: number; // Proposed price (e.g., for CONSULTANT type)
  status: ApplicationStatus;
  createdAt: string;

  // ✅ New additions:
  updatedAt?: string; // Track application edits
  viewedByAdvertiser?: boolean; // To notify promoter if their application was read
  messageThreadId?: string; // Link to chat thread if messaging is implemented
  attachments?: string[]; // Optional: list of S3 links (media, PDFs, etc.)
  availabilityNotes?: string; // Optional notes about timing, deliverability
}

/*          EXPLANATION:

This interface represents a Promoter’s application to a Campaign — usually for campaigns that require manual selection (CONSULTANT or SELLER types).

⚠️ It's only used when applicationRequired = true, meaning the advertiser manually selects a promoter based on their pitch or portfolio.

🧠 Real-World Use Cases
1. 🎯 Promoter applies to a Consultant or Seller campaign
They submit an application via a form:

✍️ A custom pitch

💼 A portfolio link

💰 A proposed quote

📎 Optional file attachments (e.g., sample videos, PDFs)

→ This creates a CampaignApplication object.

2. 👀 Advertiser reviews the applications
Advertisers can:

View pitch and portfolio

See attached files

Review the proposed quote

Check availability notes

They can then accept or reject the application.

3. 💬 Communication via messaging
If your platform includes a messaging system, the application can be linked to a chat thread using messageThreadId, allowing:

Pre-selection discussions

Negotiations

Clarifications on deliverables or timing

🧩 Field-by-Field Breakdown
Field	Type	Description
id	string	Unique ID for the application
campaignId	string	Campaign being applied to
promoterId	string	The user applying (Promoter)
pitch	string	Motivation or proposal message
portfolioUrl?	string	Optional external link to work
quote?	number	Proposed price or rate
status	ApplicationStatus	Current status (see below)
createdAt	string	ISO date when it was submitted
updatedAt?	string	Last time it was edited
viewedByAdvertiser?	boolean	True if advertiser opened it
messageThreadId?	string	If linked to a chat thread
attachments?	string[]	S3 links to optional files
availabilityNotes?	string	Optional notes on availability

🔁 ApplicationStatus Enum
ts
Copier
Modifier
export type ApplicationStatus =
  | "PENDING"   // Newly submitted
  | "ACCEPTED"  // Promoter selected
  | "REJECTED"  // Not selected
  | "WITHDRAWN" // Promoter canceled their application
  | "CANCELLED" // Campaign or application was canceled by advertiser
🔄 Application Flow
Promoter submits → PENDING

Advertiser reads → viewedByAdvertiser = true

Optional messaging via messageThreadId

Advertiser changes status → ACCEPTED or REJECTED

Promoter can self-cancel → WITHDRAWN

Campaign canceled or locked → CANCELLED



*/

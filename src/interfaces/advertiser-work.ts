export interface AdvertiserWork {
  title: string;
  description: string;
  mediaUrl?: string; // Link to S3 (video or image)
  websiteUrl?: string; // Optional link to product or service page
  price?: number; // Optional price for the product or service
}

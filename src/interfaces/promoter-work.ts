import { SocialPlatform } from 'src/enums/social-platform';

export interface PromoterWork {
  title: string;
  description?: string;
  mediaUrl: string; // Link to S3 (video or image)
  platform?: SocialPlatform; // Optional platform (e.g., TikTok, Instagram)
  viewCount?: number; // Optional view count, default is 0
}

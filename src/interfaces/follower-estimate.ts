import { SocialPlatform } from "../enums/social-platform";

export interface FollowerEstimate {
  platform: SocialPlatform;
  count: number;
}

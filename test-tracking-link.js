// Test file to verify tracking link generation
import { CampaignEntityBuilder } from '../src/helpers/campaign-entity.builder';

// Set environment variable for testing
process.env.SERVER_URL = 'https://api.example.com';

// Test the tracking link generation
const campaignId = '123e4567-e89b-12d3-a456-426614174000';
const promoterId = '987f6543-e21c-43d2-b567-123456789abc';

const visitLink = CampaignEntityBuilder.generateVisitTrackingLink(campaignId, promoterId);
console.log('Generated visit tracking link:', visitLink);

// Expected output: https://api.example.com/api/visit/123e4567-e89b-12d3-a456-426614174000/987f6543-e21c-43d2-b567-123456789abc

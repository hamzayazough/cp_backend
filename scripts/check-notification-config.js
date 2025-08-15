/**
 * Environment Configuration Helper for CrowdProp Notifications
 * Run with: node scripts/check-notification-config.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

console.log('🔍 CrowdProp Notification Configuration Checker\n');

// Check email configuration
console.log('📧 EMAIL CONFIGURATION:');
const emailConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
console.log(
  `   Status: ${emailConfigured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`,
);
if (emailConfigured) {
  console.log(`   Provider: Gmail SMTP`);
  console.log(`   Account: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.FROM_EMAIL || process.env.SMTP_USER}`);
  console.log(`   Daily Limit: 500 emails (Gmail free tier)`);
} else {
  console.log('   ⚠️  Add SMTP_USER and SMTP_PASS to .env file');
}

console.log('\n📱 SMS CONFIGURATION:');
const twilioConfigured =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
const awsSmsConfigured =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION;

if (twilioConfigured) {
  console.log('   Status: ✅ TWILIO CONFIGURED');
  console.log(
    `   Account SID: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 8)}...`,
  );
  console.log(`   Phone: ${process.env.TWILIO_PHONE_NUMBER || 'Not set'}`);
} else if (awsSmsConfigured) {
  console.log('   Status: ✅ AWS SNS AVAILABLE');
  console.log(`   Region: ${process.env.AWS_REGION}`);
  console.log(
    '   💡 AWS SNS will be used for SMS (no additional config needed)',
  );
} else {
  console.log('   Status: ⚠️  CONSOLE LOGGING ONLY');
  console.log('   Options:');
  console.log(
    '   1. Add Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER',
  );
  console.log('   2. Use AWS SNS: Already configured via AWS credentials');
}

console.log('\n🔔 PUSH NOTIFICATION CONFIGURATION:');
const pushConfigured = process.env.FCM_SERVER_KEY && process.env.FCM_SENDER_ID;
console.log(
  `   Status: ${pushConfigured ? '✅ CONFIGURED' : '⚠️  CONSOLE LOGGING ONLY'}`,
);
if (pushConfigured) {
  console.log(`   Provider: Firebase Cloud Messaging`);
  console.log(`   Sender ID: ${process.env.FCM_SENDER_ID}`);
} else {
  console.log(
    '   💡 Add FCM_SERVER_KEY and FCM_SENDER_ID to enable push notifications',
  );
}

console.log('\n💬 IN-APP NOTIFICATIONS:');
console.log('   Status: ✅ ALWAYS AVAILABLE (Database-based)');

console.log('\n⚙️  SYSTEM SETTINGS:');
console.log(
  `   Daily limit per user: ${process.env.NOTIFICATION_RATE_LIMIT_PER_USER_PER_DAY || '50'}`,
);
console.log(
  `   Retry attempts: ${process.env.NOTIFICATION_RETRY_ATTEMPTS || '3'}`,
);
console.log(`   Email delay: ${process.env.EMAIL_RATE_LIMIT_DELAY || '100'}ms`);
console.log(`   SMS delay: ${process.env.SMS_RATE_LIMIT_DELAY || '1000'}ms`);
console.log(`   Push delay: ${process.env.PUSH_RATE_LIMIT_DELAY || '50'}ms`);

console.log('\n📊 SUMMARY:');
let configuredMethods = 0;
let totalMethods = 4;

if (emailConfigured) {
  console.log('   ✅ Email notifications: Ready');
  configuredMethods++;
} else {
  console.log('   ❌ Email notifications: Not configured');
}

if (twilioConfigured || awsSmsConfigured) {
  console.log('   ✅ SMS notifications: Ready');
  configuredMethods++;
} else {
  console.log('   ⚠️  SMS notifications: Console only');
}

if (pushConfigured) {
  console.log('   ✅ Push notifications: Ready');
  configuredMethods++;
} else {
  console.log('   ⚠️  Push notifications: Console only');
}

console.log('   ✅ In-app notifications: Always ready');
configuredMethods++;

console.log(
  `\n🎯 Overall Status: ${configuredMethods}/${totalMethods} notification methods configured`,
);

if (configuredMethods >= 2) {
  console.log('🎉 Your notification system is ready for production!');
} else if (configuredMethods === 1) {
  console.log(
    '👍 Basic notifications working. Consider adding SMS or push for better reach.',
  );
} else {
  console.log(
    '⚠️  No external notification methods configured. Add email at minimum.',
  );
}

console.log('\n📚 For setup instructions, see: NOTIFICATION_SETUP_GUIDE.md');
console.log('🧪 Test your configuration: npm run test:notifications\n');

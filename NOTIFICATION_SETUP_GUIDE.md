# 📧 CrowdProp Notification System Setup Guide

This guide will help you configure email, SMS, and push notifications for your CrowdProp application.

## 🏗️ System Overview

The notification system supports multiple delivery methods:

- **📧 Email** - Via Gmail SMTP (free tier: 500 emails/day)
- **📱 SMS** - Via Twilio or AWS SNS
- **🔔 Push** - Via Firebase Cloud Messaging (FCM)
- **💬 In-App** - Stored in database, shown in UI

## ✅ Current Configuration Status

### 📧 Email Notifications ✅ CONFIGURED

- **Provider**: Gmail SMTP
- **Account**: knowvance.business@gmail.com
- **Status**: Ready to send emails
- **Daily Limit**: 500 emails/day (Gmail free tier)

### 📱 SMS Notifications ⚠️ NOT CONFIGURED

- **Status**: Console logging only (no real SMS sent)
- **Options**:
  1. Twilio (recommended for US/CA)
  2. AWS SNS (global coverage)

### 🔔 Push Notifications ⚠️ NOT CONFIGURED

- **Status**: Console logging only (no real push notifications)
- **Provider**: Firebase Cloud Messaging (FCM)

### 💬 In-App Notifications ✅ CONFIGURED

- **Status**: Fully operational
- **Storage**: PostgreSQL database

## 🚀 Quick Start (Current Setup)

Your notification system is already functional with email notifications! You can:

1. **Send email notifications**: ✅ Working
2. **View in-app notifications**: ✅ Working
3. **SMS/Push notifications**: Will log to console (safe for development)

## 📧 Email Configuration (Already Done)

Your email is already configured and working:

```env
SMTP_USER=knowvance.business@gmail.com
SMTP_PASS=cbji mnkr mjwl xall
FROM_EMAIL=knowvance.business@gmail.com
```

## 📱 SMS Configuration (Optional)

### Option 1: Twilio (Recommended)

1. **Create Twilio Account**: https://console.twilio.com/
2. **Get phone number**: Purchase a Twilio phone number
3. **Add to .env**:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Pricing**: ~$1/month for phone number + $0.0075 per SMS

### Option 2: AWS SNS (Alternative)

Your AWS credentials are already configured! Just enable SMS:

1. **No additional setup needed** - uses existing AWS config
2. **SMS will automatically work** via AWS SNS
3. **Global coverage** with competitive pricing

**Pricing**: ~$0.0075 per SMS (similar to Twilio)

## 🔔 Push Notification Configuration (Optional)

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: crowd-prop
3. **Go to**: Project Settings → Service Accounts → Cloud Messaging
4. **Get Server Key** and **Sender ID**
5. **Add to .env**:

```env
FCM_SERVER_KEY=your_fcm_server_key_here
FCM_SENDER_ID=123456789012
```

## 🧪 Testing Notifications

After configuring any provider, test with these endpoints:

### Test Email (Already Working)

```bash
# Test email configuration
curl -X POST http://localhost:3000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test@email.com"}'
```

### Test SMS (After configuring Twilio/AWS)

```bash
# Test SMS configuration
curl -X POST http://localhost:3000/api/notifications/test-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "+15551234567"}'
```

### Test All Methods

```bash
# Test all configured notification methods
curl -X POST http://localhost:3000/api/notifications/test-all \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

## 📊 Monitoring & Limits

### Current Rate Limits

- **Email**: 100ms delay between emails
- **SMS**: 1000ms delay between SMS (recommended)
- **Push**: 50ms delay between push notifications
- **Daily limit**: 50 notifications per user per day

### Logs

All notification attempts are logged in the console:

- ✅ Success: Shows delivery confirmation
- ❌ Failure: Shows error details with fallback
- 📝 Console mode: Shows message preview when providers not configured

## 🔧 Environment Variables Reference

```env
# Email (✅ Already configured)
SMTP_USER=knowvance.business@gmail.com
SMTP_PASS=cbji mnkr mjwl xall
FROM_EMAIL=knowvance.business@gmail.com

# SMS (⚠️ Optional - Choose one)
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# AWS SNS (uses existing AWS config - no additional vars needed)

# Push Notifications (⚠️ Optional)
FCM_SERVER_KEY=your_fcm_server_key
FCM_SENDER_ID=123456789012

# System Settings
NOTIFICATION_RATE_LIMIT_PER_USER_PER_DAY=50
NOTIFICATION_RETRY_ATTEMPTS=3
NOTIFICATION_BATCH_SIZE=100
EMAIL_RATE_LIMIT_DELAY=100
SMS_RATE_LIMIT_DELAY=1000
PUSH_RATE_LIMIT_DELAY=50
```

## 🔍 Troubleshooting

### Email Issues

- ✅ Already working - no issues expected
- If problems occur, check Gmail App Password is correct

### SMS Issues

```bash
# Check SMS service status
curl http://localhost:3000/api/notifications/status
```

Common issues:

- **Twilio**: Verify Account SID and Auth Token
- **AWS SNS**: Ensure SMS is enabled in your region
- **Phone format**: Use international format (+1234567890)

### Push Notification Issues

- Verify FCM server key is correct
- Check that FCM is enabled for your Firebase project
- Ensure client apps have valid FCM tokens

## 📚 Next Steps

1. **✅ Email notifications**: Already working!
2. **📱 Optional SMS**: Set up Twilio or use AWS SNS
3. **🔔 Optional Push**: Configure Firebase Cloud Messaging
4. **🧪 Test everything**: Use the test endpoints above
5. **📊 Monitor**: Check logs for delivery confirmation

## 💡 Production Considerations

### Email

- Gmail free tier: 500 emails/day
- For higher volume, consider:
  - Gmail Business (higher limits)
  - SendGrid, Mailgun, or AWS SES
  - Multiple Gmail accounts with load balancing

### SMS

- Both Twilio and AWS SNS are production-ready
- Consider volume discounts for high-usage scenarios
- Implement phone number verification before SMS

### Push Notifications

- FCM is free with generous limits
- Consider user opt-in preferences
- Handle token refresh in mobile apps

---

🎉 **Your notification system is ready to use!** Email notifications work immediately, and SMS/Push can be added when needed.

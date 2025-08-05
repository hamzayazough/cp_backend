# Gmail Setup Guide for Campaign Email Notifications

The campaign management system now uses **Gmail's free SMTP service** to send real email notifications. Gmail allows up to **500 emails per day** which is plenty for campaign notifications.

## Setup Steps

### 1. Enable 2-Factor Authentication on Gmail

- Go to [Google Account Security](https://myaccount.google.com/security)
- Enable "2-Step Verification" if not already enabled

### 2. Generate an App Password

- Go to [Google Account Security](https://myaccount.google.com/security)
- Click "2-Step Verification"
- Scroll down to "App passwords"
- Select "Mail" and your device
- Copy the 16-character app password (e.g., `abcd efgh ijkl mnop`)

### 3. Add Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
FROM_EMAIL=your_gmail@gmail.com
```

### 4. Test Email Functionality

Start your application and test with:

```bash
# Test week notifications
curl -X POST http://localhost:3000/campaign-management/notify/week

# Test day notifications
curl -X POST http://localhost:3000/campaign-management/notify/day
```

## Email Templates

The system will send emails like this:

### Week Notification Email

```
Subject: Your campaign "Test Campaign" is ending in one week

Hello John Doe,

This is a reminder that your campaign "Test Campaign" is scheduled to end on 2025-08-11.

You have one week remaining to make any final adjustments or extend the campaign if needed.

Campaign Details:
- Title: Test Campaign
- Type: VISIBILITY
- Expiry Date: 2025-08-11

If you need to make any changes, please log in to your dashboard.

Best regards,
The CrowdProp Team
```

### Day Notification Email

```
Subject: Your campaign "Test Campaign" is ending tomorrow

Hello John Doe,

This is your final reminder that your campaign "Test Campaign" is scheduled to end tomorrow (2025-08-11).

After the expiry date, your campaign will be automatically marked as inactive and promoters will no longer be able to participate.

Campaign Details:
- Title: Test Campaign
- Type: VISIBILITY
- Expiry Date: 2025-08-11

If you need to extend the campaign, please log in to your dashboard before the expiry date.

Best regards,
The CrowdProp Team
```

## Fallback Behavior

If email configuration is missing or fails:

- ✅ System continues to work normally
- ✅ Campaign completion still happens
- ✅ Database updates still occur
- 📝 Email content gets logged to console instead
- ⚠️ No real emails are sent

## Daily Limits

- **Gmail Free**: 500 emails/day
- **Gmail Workspace**: 2000 emails/day
- For higher volumes, consider SendGrid or AWS SES

## Troubleshooting

### "Authentication failed" error

- Double-check your Gmail app password
- Make sure 2FA is enabled on your Google account
- Use the app password, not your regular Gmail password

### "Daily sending quota exceeded"

- You've hit Gmail's 500 email/day limit
- Wait until tomorrow or upgrade to Gmail Workspace
- Consider using a dedicated email service like SendGrid

### Emails not being sent but no errors

- Check your spam folder
- Verify the recipient email addresses are valid
- Check Gmail's "Sent" folder to confirm delivery

## Security Notes

- Never commit your app password to version control
- Use different Gmail accounts for development vs production
- Consider using a dedicated email service for production (SendGrid, AWS SES)
- App passwords can be revoked anytime from Google Account settings

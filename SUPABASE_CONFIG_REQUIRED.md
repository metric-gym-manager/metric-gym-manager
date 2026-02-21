# Required Supabase Configuration

## Email Verification Settings

To require users to verify their email before logging in, you need to enable email confirmation in Supabase:

### Steps:

1. **Open your Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to Authentication Settings**
   - Click on "Authentication" in the left sidebar
   - Click on "Providers"
   - Click on "Email" provider

3. **Configure Email Settings**
   - Find the setting labeled "Confirm email"
   - **Check/Enable** the "Confirm email" checkbox
   - Click "Save"

### What This Does:

- ✅ **Verification emails ARE sent** during registration
- ✅ **Users MUST verify email** before they can log in
- ✅ Users are shown a clear message that they cannot login without verification
- ✅ "Resend Email" button available on verification page
- ✅ Once verified, users can log in normally

### How It Works:

When a user registers:
1. Supabase Auth creates the user account
2. Verification email is sent automatically by Supabase
3. User is redirected to verification page with clear instructions
4. User CANNOT login until they click the verification link in email
5. Once verified, gym profile is created and user can login
6. User is redirected to members dashboard

### Security Considerations:

- Users cannot login until they verify their email address
- Email verification is enforced by Supabase Auth
- Gym profile is only created after email verification
- This prevents fake or typo email addresses from creating accounts

### Troubleshooting:

If emails are NOT being sent:
1. Check Supabase Dashboard → Authentication → Email Templates
2. Verify SMTP settings or use Supabase's built-in email service
3. Check spam folder
4. Verify email provider allows emails from Supabase


---

## Implementation Summary

The following changes have been made to support unverified email login:

1. **Registration**: Gym profile is created immediately (no longer lazy)
2. **Login**: Works with both verified and unverified emails (once Supabase setting is changed)
3. **Banner**: Shows persistent notification for unverified users
4. **Verification**: Callback updates `email_verified` flag when user clicks verification link

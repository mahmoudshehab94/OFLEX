# Admin Authentication Setup

## Overview

The admin authentication system has been migrated from environment variable-based authentication to a secure database-based system with bcrypt password hashing.

## Default Credentials

**IMPORTANT: Change these credentials immediately after first login!**

- **Username:** `admin`
- **Password:** `admin123`

## Features

### 1. Database-Based Authentication
- Admin credentials are stored securely in the `admin_users` table
- Passwords are hashed using bcrypt (cost factor: 10)
- No plaintext passwords are ever stored

### 2. Secure Login
- Login is handled via the `admin-auth` edge function
- Token-based authentication with localStorage persistence
- Session persists across browser refreshes

### 3. Password Change
- Admins can change their password directly from the dashboard
- Click the key icon in the top menu bar
- Requires current password verification
- New password must be at least 8 characters
- No .env file changes needed

### 4. Password Requirements
- Minimum length: 8 characters
- Confirmation must match new password
- Current password verification required

## Technical Implementation

### Database
- **Table:** `admin_users`
  - `id` (uuid, primary key)
  - `username` (text, unique)
  - `password_hash` (text, bcrypt hashed)
  - `is_active` (boolean)
  - `created_at`, `updated_at` (timestamps)
- Row Level Security (RLS) enabled
- No public access policies (service role only)

### Edge Functions
1. **admin-auth** - Handles login
   - Validates credentials against database
   - Returns JWT-like token on success
   - Token stored in localStorage

2. **admin-change-password** - Handles password changes
   - Validates current password
   - Updates password hash in database
   - Requires valid authentication token

### Frontend Components
1. **AdminLogin** - Login page with username/password fields
2. **AdminDashboard** - Password change modal accessible via key icon

## Security Notes

1. **No Environment Variables Required**
   - Admin password is no longer stored in .env
   - VITE_ADMIN_PASSWORD can be removed from .env

2. **Bcrypt Security**
   - Industry-standard password hashing
   - Salted hashes prevent rainbow table attacks
   - Cost factor: 10 (suitable for production)

3. **Token Storage**
   - Tokens stored in localStorage
   - Tokens are session-specific
   - Clear localStorage to logout

4. **Service Role Protection**
   - Edge functions use service role key
   - Never exposed to frontend
   - Database operations restricted to edge functions

## Usage

### First Time Setup
1. Navigate to `/admin`
2. Login with default credentials (admin/admin123)
3. Immediately click the key icon to change password
4. Enter current password, new password, and confirmation
5. Click "Passwort ändern"

### Regular Login
1. Navigate to `/admin`
2. Enter username and password
3. Click "Anmelden"

### Password Change
1. From admin dashboard, click key icon in top menu
2. Enter current password
3. Enter new password (min 8 characters)
4. Confirm new password
5. Click "Passwort ändern"

### Logout
1. Click logout icon in top menu
2. Session cleared, redirected to home page

## Troubleshooting

### Cannot Login
- Verify credentials are correct
- Check browser console for errors
- Ensure edge functions are deployed
- Verify database connection

### Password Change Fails
- Ensure current password is correct
- Check new password meets requirements
- Verify confirmation matches
- Check browser console for errors

### Lost Admin Password
Run this SQL command in Supabase SQL Editor to reset to "admin123":
```sql
UPDATE admin_users
SET password_hash = crypt('admin123', gen_salt('bf'))
WHERE username = 'admin';
```

## Migration Notes

### Changes Made
1. ✅ Created `admin_users` table with migration
2. ✅ Deployed `admin-auth` edge function
3. ✅ Deployed `admin-change-password` edge function
4. ✅ Updated `AdminLogin` component for DB auth
5. ✅ Updated `AdminDashboard` for password change
6. ✅ Removed dependency on VITE_ADMIN_PASSWORD
7. ✅ Token-based session management with localStorage

### Breaking Changes
- Login now requires username and password (previously only password)
- Password changes work without .env updates
- Sessions persist in localStorage (not sessionStorage)

## Future Enhancements

Possible improvements:
- Add "Forgot Password" functionality
- Implement email-based password reset
- Add two-factor authentication (2FA)
- Session expiry and refresh tokens
- Multiple admin users with role-based access
- Admin activity logging

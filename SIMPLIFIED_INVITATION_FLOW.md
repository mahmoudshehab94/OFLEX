# Simplified Driver Invitation + Registration Flow

## Overview

The driver invitation and registration flow has been completely refactored for simplicity, reliability, and clarity. The new flow follows a straightforward path from admin invitation to driver registration to automatic appearance in the admin dashboard.

## The Complete Flow

### Step 1: Admin Creates Invitation

**Location**: Admin Dashboard → Einladungen Tab

**What the admin does**:
1. Selects role (default: Fahrer)
2. Enters **Fahrername / Anzeigename** (required) - e.g., "Osman Ali"
3. Optionally presets username and email local part
4. Clicks "Einladung erstellen"
5. Gets invitation link to share with the driver

**What happens in the background**:
- Invitation record is created in `account_invites` table
- Record stores the admin-defined driver display name
- Unique token is generated for the invitation
- Invitation is valid for 30 days

### Step 2: Driver Opens Invitation Link

**Location**: `/register?token={invite_token}`

**What the driver sees**:
- Welcome message with their name (if driver)
- Registration form with:
  - Email field (local part only, @malek.com is fixed)
  - Username (prefilled and read-only if admin set it)
  - Password + confirm password fields
  - Optional avatar upload

**What happens in the background**:
- Frontend validates invitation token
- Fetches invitation data from database
- Pre-fills username and email local part if provided by admin
- Shows driver display name in welcome message

### Step 3: Driver Completes Registration

**What the driver does**:
1. Enters email local part (e.g., "osama.ali" → osama.ali@malek.com)
2. Accepts or modifies username (if not locked by admin)
3. Creates password (min 6 characters)
4. Optionally uploads avatar
5. Clicks "Konto erstellen"

**What happens in the background**:
1. Frontend validates all inputs
2. Uploads avatar to Supabase storage (if provided)
3. Calls Edge Function `register-with-invite` with:
   - Invitation token
   - Email local part
   - Password
   - Username
   - Avatar URL (if uploaded)

### Step 4: Server-Side Registration (Edge Function)

**Edge Function**: `register-with-invite`

**What the Edge Function does**:
1. Validates invitation token (must be pending, not expired)
2. Validates email local part (no @ symbol, valid characters)
3. Constructs full email: `{local_part}@malek.com`
4. Checks email doesn't already exist
5. Checks username doesn't already exist
6. Hashes password using SHA-256
7. Creates driver record in `drivers` table using admin-defined name
8. Creates user account in `user_accounts` table with:
   - Email
   - Username
   - Password hash
   - Role (from invitation)
   - Driver ID (linked)
   - Full name (from invitation's driver display name)
   - Avatar URL
9. Marks invitation as "used"
10. Returns success with account details

### Step 5: Automatic Appearance in Admin Dashboard

**What happens automatically**:
- Driver appears in admin dashboard driver list
- Driver name shown is the **admin-defined display name** (e.g., "Osman Ali")
- Driver can now log in using their email and password
- Driver account is fully functional

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ADMIN SIDE                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin enters:                                               │
│     - Driver display name: "Osman Ali"                          │
│     - Optional: username "osama.ali"                            │
│     - Optional: email local part "osama.ali"                    │
│                                                                  │
│  2. System creates invitation:                                  │
│     ┌─────────────────────────────────────┐                     │
│     │ account_invites table               │                     │
│     ├─────────────────────────────────────┤                     │
│     │ token: "abc123..."                  │                     │
│     │ role: "driver"                      │                     │
│     │ new_driver_name: "Osman Ali"       │                     │
│     │ username: "osama.ali"               │                     │
│     │ email_local_part: "osama.ali"       │                     │
│     │ status: "pending"                   │                     │
│     └─────────────────────────────────────┘                     │
│                                                                  │
│  3. Invitation URL generated:                                   │
│     https://app.com/register?token=abc123...                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Admin shares link
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ DRIVER SIDE                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  4. Driver opens link and sees:                                 │
│     - "Willkommen, Osman Ali"                                   │
│     - Email field: [osama.ali] @malek.com (prefilled)          │
│     - Username: [osama.ali] (prefilled, read-only)             │
│     - Password fields                                           │
│     - Avatar upload (optional)                                  │
│                                                                  │
│  5. Driver submits registration                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /functions/v1/register-with-invite
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SERVER SIDE (Edge Function)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  6. Validate invitation and input                               │
│  7. Create driver record:                                       │
│     ┌─────────────────────────────────────┐                     │
│     │ drivers table                       │                     │
│     ├─────────────────────────────────────┤                     │
│     │ id: "uuid-123"                      │                     │
│     │ driver_name: "Osman Ali"           │  ← From invitation! │
│     │ is_active: true                     │                     │
│     └─────────────────────────────────────┘                     │
│                                                                  │
│  8. Create user account:                                        │
│     ┌─────────────────────────────────────┐                     │
│     │ user_accounts table                 │                     │
│     ├─────────────────────────────────────┤                     │
│     │ email: "osama.ali@malek.com"        │                     │
│     │ username: "osama.ali"               │                     │
│     │ password_hash: "sha256..."          │                     │
│     │ role: "driver"                      │                     │
│     │ driver_id: "uuid-123"              │  ← Links to driver! │
│     │ full_name: "Osman Ali"             │  ← From invitation! │
│     │ avatar_url: "https://..."           │                     │
│     │ is_active: true                     │                     │
│     └─────────────────────────────────────┘                     │
│                                                                  │
│  9. Mark invitation as used:                                    │
│     ┌─────────────────────────────────────┐                     │
│     │ account_invites table (updated)     │                     │
│     ├─────────────────────────────────────┤                     │
│     │ status: "used"                      │                     │
│     │ used_at: "2024-03-19T10:30:00Z"     │                     │
│     │ used_by_account_id: "{account_id}"  │                     │
│     └─────────────────────────────────────┘                     │
│                                                                  │
│ 10. Return success                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Redirect to login
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ RESULT                                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Driver "Osman Ali" appears in admin dashboard               │
│  ✅ Driver can log in with osama.ali@malek.com                  │
│  ✅ All submissions by driver show "Osman Ali" as name          │
│  ✅ No manual steps required                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Data Fields Explained

### 1. Driver Display Name
- **Field**: `account_invites.new_driver_name`
- **Set by**: Admin during invitation creation
- **Used for**: Creating the driver record, shown in admin dashboard
- **Example**: "Osman Ali"

### 2. Username
- **Field**: `account_invites.username` (optional preset)
- **Set by**: Admin (optional) or driver during registration
- **Used for**: User account login
- **Example**: "osama.ali"

### 3. Email Local Part
- **Field**: `account_invites.email_local_part` (optional preset)
- **Set by**: Admin (optional) or driver during registration
- **Used for**: Constructing full email {local}@malek.com
- **Example**: "osama.ali" → "osama.ali@malek.com"

### 4. Full Email
- **Constructed**: `{email_local_part}@malek.com`
- **Used for**: User account login, identification
- **Domain**: Always @malek.com (fixed)

## Database Schema

### account_invites Table

```sql
CREATE TABLE account_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  role text NOT NULL,  -- 'driver', 'supervisor', 'admin'
  status text DEFAULT 'pending',  -- 'pending', 'used'
  created_by uuid REFERENCES user_accounts(id),
  driver_id uuid REFERENCES drivers(id),  -- NULL for new drivers
  new_driver_name text,  -- Driver display name set by admin
  new_driver_license_letters text,
  new_driver_license_numbers text,
  username text,  -- Optional preset username
  email_local_part text,  -- Optional preset email local part
  used_at timestamptz,
  used_by_account_id uuid REFERENCES user_accounts(id),
  created_at timestamptz DEFAULT now()
);
```

### drivers Table

```sql
CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name text NOT NULL,  -- Display name from invitation
  license_letters text,
  license_numbers text,
  id_barcode_image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### user_accounts Table

```sql
CREATE TABLE user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,  -- 'driver', 'supervisor', 'admin'
  driver_id uuid REFERENCES drivers(id),
  full_name text,  -- From invitation's driver display name
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

## Security Features

### 1. Invitation Validation
- Token must exist and be in 'pending' status
- Invitation must not be expired (30 days)
- Invitation can only be used once

### 2. Email Validation
- Local part cannot contain '@' symbol
- Only alphanumeric, dots, underscores, and hyphens allowed
- Must be unique across all accounts

### 3. Username Validation
- Must be unique across all accounts
- Can be locked by admin (read-only for driver)

### 4. Password Security
- Minimum 6 characters required
- Hashed using SHA-256 before storage
- Never stored or transmitted in plain text

### 5. RLS Policies
- Invitation data readable by anonymous users (for validation)
- User accounts protected by authentication
- Driver records linked properly to user accounts

## Error Handling

### Client-Side Errors

**Invalid Email Local Part**:
```
"Bitte geben Sie nur den Teil vor @malek.com ein."
```

**Email Contains @**:
```
"E-Mail-Teil darf kein @ enthalten"
```

**Password Mismatch**:
```
"Passwörter stimmen nicht überein."
```

**Password Too Short**:
```
"Passwort muss mindestens 6 Zeichen lang sein."
```

### Server-Side Errors

**Invalid Token**:
```
"Ungültiger oder abgelaufener Einladungstoken"
```

**Expired Invitation**:
```
"Diese Einladung ist abgelaufen"
```

**Email Already Exists**:
```
"Diese E-Mail-Adresse wird bereits verwendet"
```

**Username Already Exists**:
```
"Dieser Benutzername wird bereits verwendet"
```

**Failed Driver Creation**:
```
"Fehler beim Erstellen des Fahrerprofils"
```

**Failed Account Creation**:
```
"Fehler beim Erstellen des Kontos"
```

## Files Modified

### 1. Edge Function
- **File**: `supabase/functions/register-with-invite/index.ts`
- **Purpose**: Handles secure server-side registration
- **New**: Created from scratch for simplified flow

### 2. Admin Invitation Page
- **File**: `src/components/InviteManagement.tsx`
- **Changes**:
  - Removed "existing driver" flow
  - Simplified to only "new driver" invitation
  - Clear labeling of driver display name
  - Optional preset fields for username and email

### 3. Driver Registration Page
- **File**: `src/components/RegisterWithInvite.tsx`
- **Changes**:
  - Calls new Edge Function instead of AuthContext
  - Direct database read for invitation validation
  - Clearer error messages
  - Better UX for email input (split local part and domain)
  - Password visibility toggles
  - Read-only username if admin preset

### 4. Admin Dashboard
- **File**: `src/components/AdminDashboardV2.tsx`
- **Changes**: Removed separate InviteHistory component (now integrated)

## Testing Checklist

### Test Case 1: Basic Flow
1. Admin enters driver name "Test Driver"
2. Admin generates invitation
3. Driver opens link
4. Driver enters email local part "test.driver"
5. Driver creates password
6. Registration succeeds
7. Driver appears in admin dashboard as "Test Driver"
8. Driver can log in with test.driver@malek.com

### Test Case 2: Preset Username
1. Admin enters driver name "Test Driver"
2. Admin presets username "testdriver"
3. Admin generates invitation
4. Driver opens link
5. Username field shows "testdriver" and is read-only
6. Driver completes registration
7. Driver can log in with username "testdriver"

### Test Case 3: Preset Email Local Part
1. Admin enters driver name "Test Driver"
2. Admin presets email local part "test.driver"
3. Admin generates invitation
4. Driver opens link
5. Email field shows "test.driver" (prefilled)
6. Driver can modify or keep it
7. Registration succeeds with chosen email

### Test Case 4: Invalid Email
1. Driver tries to enter "test@example.com"
2. Error: "E-Mail-Teil darf kein @ enthalten"
3. Driver enters "test.driver" instead
4. Registration succeeds

### Test Case 5: Expired Invitation
1. Admin creates invitation
2. 31 days pass (simulated)
3. Driver opens link
4. Error: "Diese Einladung ist abgelaufen"
5. Driver cannot register

### Test Case 6: Used Invitation
1. Driver completes registration successfully
2. Driver tries to use same link again
3. Error: "Diese Einladung ist ungültig oder wurde bereits verwendet"

### Test Case 7: Duplicate Email
1. Driver1 registers with "test.driver@malek.com"
2. Driver2 tries to register with same email
3. Error: "Diese E-Mail-Adresse wird bereits verwendet"

### Test Case 8: Duplicate Username
1. Driver1 registers with username "testdriver"
2. Driver2 tries to register with same username
3. Error: "Dieser Benutzername wird bereits verwendet"

## Advantages of New Flow

### 1. Simplicity
- Single, clear path from invitation to registration
- No complex "existing vs new driver" logic
- Fewer fields to manage

### 2. Data Consistency
- Admin-defined name is preserved throughout
- Display name in dashboard matches admin's intent
- No confusion between username and display name

### 3. Security
- Server-side validation and creation
- No RLS policy workarounds needed
- Proper error handling

### 4. User Experience
- Clear labels and instructions
- Preset values save time
- Read-only fields prevent mistakes
- Immediate feedback on errors

### 5. Maintainability
- Single source of truth (Edge Function)
- Consistent validation logic
- Easy to understand code flow

## Migration from Old Flow

If you had existing invitations from the old flow:
1. Old invitations will still work
2. The invitation table structure supports both flows
3. New invitations use the simplified flow
4. No data migration required

## Future Enhancements (Not Implemented)

Possible improvements for future versions:

1. **Email Notifications**: Send invitation email automatically
2. **SMS Integration**: Send invitation via SMS
3. **Custom Domains**: Support multiple email domains
4. **Bulk Invitations**: Create multiple invitations at once
5. **Invitation Templates**: Save preset configurations
6. **Analytics**: Track invitation usage statistics
7. **Expiration Customization**: Allow admin to set custom expiry
8. **Resend Invitations**: Regenerate expired invitations

## Support

If you encounter any issues with the invitation flow:

1. Check invitation status in admin dashboard
2. Verify invitation hasn't expired (30 days)
3. Ensure email local part doesn't contain '@'
4. Check browser console for detailed error messages
5. Verify Edge Function is deployed correctly

## Summary

The simplified invitation flow provides a reliable, secure, and user-friendly experience for creating driver accounts. The admin defines the driver's display name upfront, and this name appears consistently throughout the system. The driver completes their registration with minimal friction, and their account is immediately usable.

Key Takeaway: **Admin enters "Osman Ali" → Driver registers → "Osman Ali" appears in dashboard** ✅

# Supabase Setup Guide

This project uses **Supabase** for all database and backend functionality. This guide will help you configure your new Supabase project.

## Required Environment Variables

The application expects these exact environment variable names in your `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
VITE_ADMIN_PASSWORD=admin123
```

## Getting Your Supabase Credentials

### Step 1: Create or Access Your Supabase Project

1. Go to https://supabase.com/dashboard
2. Create a new project OR select your existing project
3. Wait for the project to finish provisioning

### Step 2: Get Your API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. You'll see the following information:

   - **Project URL** - Copy this to `VITE_SUPABASE_URL`
   - **anon public** key - Copy this to `VITE_SUPABASE_ANON_KEY`
   - **service_role** key - Copy this to `VITE_SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Configure Your `.env` File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and paste your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_ADMIN_PASSWORD=admin123
   ```

### Step 4: Run Database Migrations

The project includes database migrations in `supabase/migrations/`. These will create the necessary tables and configure Row Level Security (RLS).

To apply migrations:
1. Make sure your Supabase project is set up
2. The migrations should be automatically detected and applied
3. Verify tables exist in Supabase dashboard: **Table Editor**

Expected tables:
- `drivers` - Driver information (code, name, email, active status)
- `logs` - Work time logs (driver_id, car_number, times, etc.)

### Step 5: Deploy Edge Functions

The project uses one Edge Function:
- `submit-log` - Handles driver work time submissions

Edge functions are automatically deployed when you make changes to files in `supabase/functions/`.

## Verification

### Health Check Widget

The app includes a **Health Check widget** in the bottom-right corner of every page. Click it to expand and see:

- **Supabase URL** - The hostname of your Supabase project
- **API Key (last 6 chars)** - Last 6 characters of your anon key (for verification)
- **Connection Status** - Whether SELECT queries work on your database
- **Database Details** - Number of drivers and logs in the database

### What to Look For:

✅ **Success:**
```
Supabase URL: your-project-ref.supabase.co
API Key (last 6 chars): ...abc123
✓ Database connection successful
{
  "driversCount": 0,
  "logsCount": 0,
  "projectRef": "your-project-ref"
}
```

❌ **Failure:**
```
Supabase URL: NOT_SET
API Key (last 6 chars): NOT_SET
✗ SELECT failed: Invalid API key
```

If you see a failure, check:
1. Your `.env` file has the correct values
2. You've restarted the dev server after changing `.env`
3. Your Supabase project is active and not paused
4. The keys are from the SAME Supabase project as the URL

## Browser Console Logs

The app includes detailed logging. Open your browser console (F12) to see:

### On App Start:
```
🔧 Supabase Configuration:
  URL: https://your-project-ref.supabase.co
  Anon Key (last 6): abc123
  Service Key (last 6): xyz789
🔍 Project References:
  URL Project: your-project-ref
  Anon Key Project: your-project-ref
  Service Key Project: your-project-ref
✅ All credentials match the same project
```

**Important:** All three project references MUST match. If they don't, you're using keys from different Supabase projects!

### During Operations:
```
📝 Submit log request: { identifier: "1", car_number: "LKW-01", ... }
🔍 Looking up driver with identifier: 1
✅ Driver found: 1 Hans Müller
💾 Inserting log: { ... }
✅ Log inserted successfully
```

## Common Issues

### Issue: "Invalid API key"

**Cause:** Your service role key is from a different Supabase project than your URL and anon key.

**Solution:**
1. Check browser console for project reference mismatch
2. Go to Settings → API in your Supabase dashboard
3. Copy ALL THREE values from the SAME project
4. Update your `.env` file
5. Restart dev server

### Issue: "Missing Supabase environment variables"

**Cause:** The `.env` file is missing or variables are not prefixed with `VITE_`.

**Solution:**
1. Ensure `.env` exists in project root
2. Ensure variables start with `VITE_` (Vite requires this prefix)
3. Restart dev server

### Issue: "RLS policy violation" or "permission denied"

**Cause:** Row Level Security (RLS) policies are not set up correctly.

**Solution:**
1. Check that migrations have been applied
2. Verify RLS policies exist in Supabase dashboard: **Authentication** → **Policies**
3. Review migration files in `supabase/migrations/`

## Environment Variable Names Reference

The codebase uses these **exact** environment variable names:

| Variable Name | Used For | Where to Get It |
|--------------|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public API key (also accepts `VITE_SUPABASE_PUBLISHABLE_KEY`) | Dashboard → Settings → API → anon public |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Server-side operations (admin dashboard, edge functions) | Dashboard → Settings → API → service_role |
| `VITE_ADMIN_PASSWORD` | Admin dashboard login password | Set to your preferred password |

## Security Notes

1. **NEVER commit your `.env` file to git** - It's already in `.gitignore`
2. **Service Role Key** is sensitive - it bypasses RLS policies
3. **Anon Key** is safe to expose in frontend code - it respects RLS policies
4. Edge functions automatically receive Supabase credentials via `Deno.env.get()`

## Next Steps

After configuration:
1. Check the Health Check widget shows success
2. Go to `/admin` and login (password: `admin123` or what you set)
3. Add test drivers in the admin dashboard
4. Test driver submission on the home page
5. Check browser console for detailed logs

## Support

If you see project reference mismatches in the console logs, you MUST get all credentials from the same Supabase project. The app cannot work with mixed credentials from different projects.

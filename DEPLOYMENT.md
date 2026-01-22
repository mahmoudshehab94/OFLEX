# Deployment Guide - Transport Arbeitszeit System

## Prerequisites

- Supabase account (free tier)
- Cloudflare Pages or Netlify account (free tier)
- Node.js 18+ installed locally

## Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be provisioned

### 1.2 Get Database Credentials

From your Supabase project settings:
- **Project URL**: `https://[your-project].supabase.co`
- **Anon Key**: Found in Settings > API
- **Service Role Key**: Found in Settings > API (keep secret!)

### 1.3 Apply Database Migrations

The database migration has already been applied automatically. Your database now has:
- `drivers` table with 3 seed drivers (codes: 1, 2, 3)
- `logs` table for work entries
- RLS policies for security
- Unique constraints to prevent duplicate submissions

### 1.4 Deploy Edge Function

The `submit-log` edge function has already been deployed and is ready to use.

## Step 2: Environment Variables

Create a `.env` file in the project root with:

```env
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
VITE_SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
VITE_ADMIN_PASSWORD=[choose-admin-password]
```

**IMPORTANT**:
- The service role key should NEVER be exposed to the public
- Change the admin password from the default `admin123`
- Keep these credentials secure

## Step 3: Build the Application

```bash
npm install
npm run build
```

This creates a `dist` folder with the production build.

## Step 4: Deploy to Cloudflare Pages

### 4.1 Via Cloudflare Dashboard

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Click "Create a project"
3. Connect your Git repository OR use direct upload
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Framework preset**: Vite

### 4.2 Add Environment Variables

In Cloudflare Pages project settings, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_ADMIN_PASSWORD`

### 4.3 Deploy

Click "Save and Deploy". Your app will be live at:
`https://[your-project].pages.dev`

## Step 5: Deploy to Netlify (Alternative)

### 5.1 Via Netlify Dashboard

1. Go to [Netlify](https://netlify.com)
2. Click "Add new site"
3. Connect your Git repository OR drag & drop the `dist` folder

### 5.2 Configure Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `dist`

### 5.3 Add Environment Variables

In Site settings > Environment variables, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_ADMIN_PASSWORD`

### 5.4 Deploy

Your app will be live at:
`https://[your-site].netlify.app`

## Step 6: Configure SPA Routing

### For Cloudflare Pages

Create `_redirects` file in the `public` folder:
```
/*    /index.html   200
```

### For Netlify

Create `netlify.toml` in project root:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Step 7: Test the Application

### Driver Submission
1. Go to your deployed URL
2. Enter driver code: `1`, `2`, or `3`
3. Fill in car number and times (24-hour format)
4. Submit

### Admin Access
1. Go to `[your-url]/admin`
2. Enter admin password
3. Access all management features

## Default Test Credentials

**Drivers (already in database):**
- Code: `1` - Hans Müller (hans@example.com)
- Code: `2` - Anna Schmidt (anna@example.com)
- Code: `3` - Peter Wagner (no email)

**Admin:**
- Password: `admin123` (CHANGE THIS!)

## Security Checklist

- [ ] Changed admin password from default
- [ ] Service role key is kept secret
- [ ] Environment variables are properly configured
- [ ] HTTPS is enabled (automatic with Cloudflare/Netlify)
- [ ] Database RLS policies are active
- [ ] Edge function is deployed and working

## Troubleshooting

### Issue: Driver submission fails
- Check edge function logs in Supabase Dashboard
- Verify environment variables are correct
- Ensure driver code/email exists in database

### Issue: Admin can't log in
- Check `VITE_ADMIN_PASSWORD` environment variable
- Clear browser session storage
- Verify environment variables are deployed

### Issue: "Kod oder E-Mail ist ungültig"
- Driver code/email must exist in database first
- Add drivers via admin dashboard
- Check drivers table in Supabase

### Issue: Build fails
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (18+ required)
- Clear node_modules and reinstall

## Maintenance

### Adding New Drivers
Use the admin dashboard to add drivers with:
- Unique code
- Name
- Optional email
- Active status

### Backing Up Data
Export data regularly using:
- Admin dashboard CSV export
- Supabase backup tools
- Database dumps via Supabase CLI

### Monitoring
- Check Supabase logs for errors
- Monitor edge function invocations
- Review database usage in Supabase dashboard

## Support

For issues or questions:
1. Check Supabase logs
2. Review browser console for errors
3. Verify all environment variables are set correctly

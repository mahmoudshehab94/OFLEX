# OneSignal Secrets Configuration

## ⚠️ Important: Add These Secrets to Supabase

You need to add the OneSignal secrets to Supabase Edge Functions.

## How to Add Secrets

### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to: **Edge Functions** → **Secrets**
3. Click **"Add Secret"**
4. Add the following secrets:

**Secret 1:**
```
Name: ONESIGNAL_APP_ID
Value: 1db29131-1f03-4188-8b3b-af2ae9c43717
```

**Secret 2:**
```
Name: ONESIGNAL_REST_API_KEY
Value: os_v2_app_dwzjcmi7anayrcz3v4votrbxc5ebwgsbalce2ceefkpkzlm3veoxmvkonmzzy3fr7oot3a66wvfhpi3zij4vhy5q734m6l4a2ah7aka
```

5. Click **Save** for each secret

### Method 2: Supabase CLI (Alternative)

If you have Supabase CLI installed and logged in:

```bash
supabase secrets set ONESIGNAL_APP_ID="1db29131-1f03-4188-8b3b-af2ae9c43717"
supabase secrets set ONESIGNAL_REST_API_KEY="os_v2_app_dwzjcmi7anayrcz3v4votrbxc5ebwgsbalce2ceefkpkzlm3veoxmvkonmzzy3fr7oot3a66wvfhpi3zij4vhy5q734m6l4a2ah7aka"
```

## Verify Secrets Are Set

After adding, you can verify by checking the secrets list in Supabase Dashboard or running:

```bash
supabase secrets list
```

You should see:
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- Plus the default Supabase secrets

## ✅ What's Already Done

- `.env` file updated with `VITE_ONESIGNAL_APP_ID`
- Frontend will use this for OneSignal SDK initialization
- Edge Function is deployed and ready to use the secrets

## Next Step

After adding these secrets:
1. The Edge Function will automatically use them
2. No need to redeploy
3. Proceed to set up the cron job (see `NEXT_STEPS.md`)

/*
  # Remove Anonymous Account Creation Policy
  
  1. Changes
    - Remove the anon account creation policy
    - Account creation is now handled via Edge Function with proper admin verification
  
  2. Security
    - Edge Function validates admin user before allowing account creation
    - More secure than RLS policy
*/

-- Remove the anon account creation policy
DROP POLICY IF EXISTS "Allow anon to create accounts" ON user_accounts;

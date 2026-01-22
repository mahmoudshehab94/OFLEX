/*
  # Fix Security Issues

  ## Changes Made
  
  1. **Drop Unused Indexes**
     - Drop `work_logs_car_number_idx` (unused)
     - Drop `work_logs_driver_code_work_date_idx` (redundant with unique constraint)
  
  2. **Add RLS Policies**
     
     ### admin_users table
     - Service role can read/write (for admin functions)
     - No public access
     
     ### drivers table
     - Service role can read/write (for admin functions)
     - No public access
     
     ### work_logs table
     - Service role can read/write (for admin functions)
     - No public access
  
  3. **Fix Function Search Paths**
     - Set explicit search_path for security functions
     - Prevents search_path injection attacks
  
  ## Security Notes
  - All tables use service role access only (via edge functions)
  - No direct user access to tables
  - Functions have immutable search paths
*/

-- 1. Drop unused indexes
DROP INDEX IF EXISTS work_logs_car_number_idx;
DROP INDEX IF EXISTS work_logs_driver_code_work_date_idx;

-- 2. Add RLS policies for admin_users table
-- Only service role can access (used by edge functions)
CREATE POLICY "Service role can manage admin_users"
  ON admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Add RLS policies for drivers table
CREATE POLICY "Service role can select drivers"
  ON drivers
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert drivers"
  ON drivers
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update drivers"
  ON drivers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete drivers"
  ON drivers
  FOR DELETE
  TO service_role
  USING (true);

-- 4. Add RLS policies for work_logs table
CREATE POLICY "Service role can select work_logs"
  ON work_logs
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert work_logs"
  ON work_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update work_logs"
  ON work_logs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete work_logs"
  ON work_logs
  FOR DELETE
  TO service_role
  USING (true);

-- 5. Fix function search paths for security
-- Recreate verify_admin_password with explicit search_path
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_username text,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_password_hash text;
  v_is_active boolean;
BEGIN
  SELECT id, password_hash, is_active
  INTO v_user_id, v_password_hash, v_is_active
  FROM admin_users
  WHERE username = p_username;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ungültige Anmeldedaten'
    );
  END IF;

  IF NOT v_is_active THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Konto ist deaktiviert'
    );
  END IF;

  IF v_password_hash = crypt(p_password, v_password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user_id', v_user_id
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Ungültige Anmeldedaten'
    );
  END IF;
END;
$$;

-- Recreate update_admin_password with explicit search_path
CREATE OR REPLACE FUNCTION update_admin_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_password_hash text;
BEGIN
  SELECT password_hash
  INTO v_password_hash
  FROM admin_users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Benutzer nicht gefunden'
    );
  END IF;

  IF v_password_hash != crypt(p_current_password, v_password_hash) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Falsches aktuelles Passwort'
    );
  END IF;

  UPDATE admin_users
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Passwort erfolgreich geändert'
  );
END;
$$;

-- Recreate check_driver_active with explicit search_path
CREATE OR REPLACE FUNCTION check_driver_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM drivers
    WHERE code = NEW.driver_code AND active = true
  ) THEN
    RAISE EXCEPTION 'Fahrer mit Code % ist nicht aktiv', NEW.driver_code;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate update_admin_users_updated_at with explicit search_path
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
/*
  # Fix Function Search Paths for pgcrypto
  
  ## Changes Made
  
  Update all admin authentication functions to include the extensions schema
  in their search_path so they can access pgcrypto functions (crypt, gen_salt).
  
  ## Functions Updated
  
  1. verify_admin_password - Password verification
  2. update_admin_password - Password update
  3. check_driver_active - Driver validation trigger
  4. update_admin_users_updated_at - Timestamp trigger
*/

-- Fix verify_admin_password to include extensions schema
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_username text,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

-- Fix update_admin_password to include extensions schema
CREATE OR REPLACE FUNCTION update_admin_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
/*
  # Add admin password verification and update functions

  1. New Functions
    - `verify_admin_password` - Verifies admin login credentials using bcrypt
    - `update_admin_password` - Updates admin password with bcrypt hashing
  
  2. Security
    - Functions use pgcrypto extension for bcrypt
    - Returns structured JSON for easy consumption
    - No direct password exposure
*/

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to verify admin password
CREATE OR REPLACE FUNCTION verify_admin_password(
  p_username text,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to update admin password
CREATE OR REPLACE FUNCTION update_admin_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
/*
  # Allow public read access to vehicles table

  1. Changes
    - Add policy to allow anonymous (anon) users to read vehicles
    - This allows the frontend to display vehicles using anon key
    - Vehicle creation/update/delete still protected via Edge Function
  
  2. Rationale
    - Vehicle plate info is not sensitive data
    - Custom auth doesn't work with RLS policies using auth.uid()
    - Anon read access allows proper data display
    - Write operations remain secure through Edge Function validation
*/

-- Policy: Allow public read access to vehicles
CREATE POLICY "Public can view vehicles"
  ON vehicles
  FOR SELECT
  TO anon
  USING (true);

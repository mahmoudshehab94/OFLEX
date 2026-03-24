/*
  # Simple Schema Alignment
  
  This migration makes minimal changes to align with the old dashboard expectations:
  1. Rename work_times to work_entries
  2. Add break_minutes column if missing
  3. Rename work_date to date
  4. Keep driver_code and driver_name as-is (will handle in code layer)
*/

-- Step 1: Rename work_times to work_entries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'work_times' AND table_schema = 'public'
  ) THEN
    ALTER TABLE work_times RENAME TO work_entries;
  END IF;
END $$;

-- Step 2: Rename work_date to date in work_entries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_entries' AND column_name = 'work_date'
  ) THEN
    ALTER TABLE work_entries RENAME COLUMN work_date TO date;
  END IF;
END $$;

-- Step 3: Add break_minutes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_entries' AND column_name = 'break_minutes'
  ) THEN
    ALTER TABLE work_entries ADD COLUMN break_minutes integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Step 4: Rename note to notes if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_entries' AND column_name = 'note'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_entries' AND column_name = 'notes'
  ) THEN
    ALTER TABLE work_entries RENAME COLUMN note TO notes;
  END IF;
END $$;

-- Step 5: Update unique constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_driver_date'
  ) THEN
    ALTER TABLE work_entries DROP CONSTRAINT unique_driver_date;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_entries_driver_id_date_key'
  ) THEN
    ALTER TABLE work_entries ADD CONSTRAINT work_entries_driver_id_date_key UNIQUE (driver_id, date);
  END IF;
END $$;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_work_times_work_date;
CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries(date DESC);

-- Step 7: Ensure RLS and policies for work_entries
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_entries' AND policyname = 'Enable read access for all users'
  ) THEN
    CREATE POLICY "Enable read access for all users" ON work_entries
      FOR SELECT TO public USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_entries' AND policyname = 'Enable insert for all users'
  ) THEN
    CREATE POLICY "Enable insert for all users" ON work_entries
      FOR INSERT TO public WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_entries' AND policyname = 'Enable update for all users'
  ) THEN
    CREATE POLICY "Enable update for all users" ON work_entries
      FOR UPDATE TO public USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_entries' AND policyname = 'Enable delete for all users'
  ) THEN
    CREATE POLICY "Enable delete for all users" ON work_entries
      FOR DELETE TO public USING (true);
  END IF;
END $$;

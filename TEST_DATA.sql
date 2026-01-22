-- TEST DATA FOR DRIVER WORK LOG SYSTEM
-- Run this in Supabase SQL Editor to add test data

-- Add test drivers
INSERT INTO public.drivers (code, name, active) VALUES
  (1, 'Mohamed', true),
  (2, 'Ahmed', true),
  (3, 'Hassan', false)
ON CONFLICT (code) DO NOTHING;

-- Optional: Add test work logs
-- (Use the app UI instead for real testing)
-- INSERT INTO public.work_logs (
--   driver_code,
--   work_date,
--   car_number,
--   start_time,
--   end_time,
--   duration_minutes,
--   overtime_minutes
-- ) VALUES
--   (1, CURRENT_DATE, 'LKW-01', '08:00', '18:00', 600, 60),
--   (2, CURRENT_DATE, 'LKW-02', '07:00', '16:00', 540, 0);

-- Verify data
SELECT 'DRIVERS' as table_name, COUNT(*) as count FROM public.drivers
UNION ALL
SELECT 'WORK_LOGS', COUNT(*) FROM public.work_logs;

-- Show all drivers
SELECT
  code,
  name,
  active,
  created_at
FROM public.drivers
ORDER BY code;

-- Show recent logs with driver names
SELECT
  l.id,
  l.driver_code,
  d.name as driver_name,
  l.work_date,
  l.car_number,
  l.start_time,
  l.end_time,
  CONCAT(FLOOR(l.duration_minutes / 60), ':', LPAD((l.duration_minutes % 60)::text, 2, '0')) as duration,
  CONCAT(FLOOR(l.overtime_minutes / 60), ':', LPAD((l.overtime_minutes % 60)::text, 2, '0')) as overtime,
  l.created_at
FROM public.work_logs l
JOIN public.drivers d ON d.code = l.driver_code
ORDER BY l.work_date DESC, l.created_at DESC
LIMIT 10;

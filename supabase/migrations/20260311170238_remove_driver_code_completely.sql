/*
  # إزالة driver_code بالكامل من النظام
  
  1. التغييرات على جدول drivers:
    - إزالة عمود driver_code
    - إزالة القيود والفهارس المتعلقة به
    - إزالة التحققات
  
  2. التغييرات على جدول account_invites:
    - إزالة عمود new_driver_code
    - تحديث القيود لعدم طلب هذا الحقل
  
  3. الأمان:
    - تحديث RLS policies إن لزم الأمر
    - لا حاجة لإضافة قيود جديدة
  
  ملاحظة: هذا التغيير لا يحذف أي بيانات سائقين موجودة
*/

-- إزالة القيود والفهارس المتعلقة بـ driver_code من جدول drivers
DO $$
BEGIN
  -- إزالة unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_driver_code_key'
  ) THEN
    ALTER TABLE drivers DROP CONSTRAINT drivers_driver_code_key;
  END IF;

  -- إزالة check constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_driver_code_not_empty'
  ) THEN
    ALTER TABLE drivers DROP CONSTRAINT check_driver_code_not_empty;
  END IF;
END $$;

-- إزالة الفهارس المتعلقة بـ driver_code
DROP INDEX IF EXISTS idx_drivers_driver_code;
DROP INDEX IF EXISTS idx_drivers_code_unique;

-- إزالة عمود driver_code من جدول drivers
ALTER TABLE drivers DROP COLUMN IF EXISTS driver_code;

-- إزالة عمود new_driver_code من جدول account_invites
ALTER TABLE account_invites DROP COLUMN IF EXISTS new_driver_code;

-- تحديث check constraint في account_invites لإزالة الشرط على new_driver_code
DO $$
BEGIN
  -- إزالة القيد القديم
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'account_invites_new_driver_check'
  ) THEN
    ALTER TABLE account_invites DROP CONSTRAINT account_invites_new_driver_check;
  END IF;
  
  -- إضافة قيد جديد بدون new_driver_code
  ALTER TABLE account_invites ADD CONSTRAINT account_invites_new_driver_check CHECK (
    (
      driver_id IS NOT NULL 
      AND new_driver_name IS NULL 
      AND new_driver_license_letters IS NULL 
      AND new_driver_license_numbers IS NULL
    )
    OR
    (
      driver_id IS NULL 
      AND new_driver_name IS NOT NULL 
      AND new_driver_license_letters IS NOT NULL 
      AND new_driver_license_numbers IS NOT NULL
    )
  );
END $$;

COMMENT ON TABLE drivers IS 'يحتوي على معلومات السائقين - تم إزالة driver_code';
COMMENT ON TABLE account_invites IS 'دعوات إنشاء الحسابات - تم إزالة new_driver_code';

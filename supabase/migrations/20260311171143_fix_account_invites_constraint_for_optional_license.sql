/*
  # إصلاح قيد account_invites لجعل رخصة القيادة اختيارية

  1. التغييرات:
    - إزالة القيد القديم الذي يتطلب license_letters و license_numbers
    - إضافة قيد جديد يتطلب فقط new_driver_name عند إنشاء سائق جديد
    - license_letters و license_numbers الآن اختياريان تماماً

  2. الأمان:
    - لا تغيير في RLS policies
    - القيد الجديد أكثر مرونة
*/

-- إزالة القيد القديم
ALTER TABLE account_invites DROP CONSTRAINT IF EXISTS account_invites_new_driver_check;

-- إضافة قيد جديد: إما driver_id موجود، أو new_driver_name موجود
-- license_letters و license_numbers اختياريان في كلتا الحالتين
ALTER TABLE account_invites ADD CONSTRAINT account_invites_new_driver_check CHECK (
  (
    driver_id IS NOT NULL 
    AND new_driver_name IS NULL
  )
  OR
  (
    driver_id IS NULL 
    AND new_driver_name IS NOT NULL
  )
);

COMMENT ON CONSTRAINT account_invites_new_driver_check ON account_invites IS 
  'يضمن أن الدعوة إما لسائق موجود (driver_id) أو لسائق جديد (new_driver_name). رخصة القيادة اختيارية في كلتا الحالتين.';

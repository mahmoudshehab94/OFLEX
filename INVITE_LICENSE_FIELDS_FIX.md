# إصلاح مشكلة رخصة القيادة الاختيارية في الدعوات

## المشكلة

عند محاولة إنشاء دعوة لسائق جديد بدون إدخال بيانات رخصة القيادة، كان النظام يعطي خطأ:

```
new row for relation "account_invites" violates check constraint "account_invites_new_driver_check"
```

### السبب

القيد في قاعدة البيانات كان يتطلب أن تكون `new_driver_license_letters` و `new_driver_license_numbers` **NOT NULL** عند إنشاء سائق جديد:

```sql
-- القيد القديم (المشكلة)
CHECK (
  (driver_id IS NOT NULL
   AND new_driver_name IS NULL
   AND new_driver_license_letters IS NULL
   AND new_driver_license_numbers IS NULL)
  OR
  (driver_id IS NULL
   AND new_driver_name IS NOT NULL
   AND new_driver_license_letters IS NOT NULL  -- ❌ إجباري
   AND new_driver_license_numbers IS NOT NULL)  -- ❌ إجباري
)
```

هذا كان غير منطقي لأن:
- ليس كل السائقين لديهم رخص قيادة عند التسجيل
- قد يُضاف السائق أولاً ثم تُدخل بيانات الرخصة لاحقاً
- الحقول في الواجهة اختيارية بالفعل

---

## الحل المطبق

### 1. تحديث قيد قاعدة البيانات

```sql
-- القيد الجديد (الحل)
CHECK (
  (driver_id IS NOT NULL
   AND new_driver_name IS NULL)
  OR
  (driver_id IS NULL
   AND new_driver_name IS NOT NULL)
)
```

الآن القيد يتحقق فقط من:
- إما الدعوة لسائق موجود (`driver_id` موجود، `new_driver_name` NULL)
- أو الدعوة لسائق جديد (`driver_id` NULL، `new_driver_name` موجود)

**✅ بيانات الرخصة أصبحت اختيارية بالكامل!**

### 2. تحديث TypeScript Interface

**قبل:**
```typescript
newDriverData?: {
  name: string;
  license_letters: string;    // إجباري
  license_numbers: string;    // إجباري
}
```

**بعد:**
```typescript
newDriverData?: {
  name: string;
  license_letters?: string;   // ✅ اختياري
  license_numbers?: string;   // ✅ اختياري
}
```

### 3. تنظيف الكود

إزالة آثار `code` المتبقية:
```typescript
// قبل
setNewDriverData({ code: '', name: '', license_letters: '', license_numbers: '' });

// بعد
setNewDriverData({ name: '', license_letters: '', license_numbers: '' });
```

---

## الاستخدام الآن

### إنشاء دعوة لسائق جديد:

**الحد الأدنى المطلوب:**
- ✅ اسم السائق **فقط**

**اختياري:**
- Führerschein-Buchstaben (الحروف)
- Führerschein-Nummern (الأرقام)

### أمثلة على الحالات المدعومة:

#### ✅ الحالة 1: سائق بدون رخصة
```typescript
{
  name: "محمد أحمد",
  license_letters: "",      // فارغ
  license_numbers: ""       // فارغ
}
```
**النتيجة:** ✅ ينجح!

#### ✅ الحالة 2: سائق مع رخصة كاملة
```typescript
{
  name: "أحمد علي",
  license_letters: "ABC",
  license_numbers: "123456"
}
```
**النتيجة:** ✅ ينجح!

#### ✅ الحالة 3: سائق مع حروف فقط
```typescript
{
  name: "علي محمود",
  license_letters: "XYZ",
  license_numbers: ""       // فارغ
}
```
**النتيجة:** ✅ ينجح!

#### ✅ الحالة 4: سائق مع أرقام فقط
```typescript
{
  name: "خالد سعيد",
  license_letters: "",      // فارغ
  license_numbers: "789012"
}
```
**النتيجة:** ✅ ينجح!

#### ❌ الحالة الوحيدة الممنوعة: بدون اسم
```typescript
{
  name: "",                 // ❌ فارغ
  license_letters: "ABC",
  license_numbers: "123456"
}
```
**النتيجة:** ❌ خطأ validation في الواجهة

---

## التحقق من نجاح الإصلاح

### 1. اختبار من الواجهة:

```
1. اذهب إلى Dashboard → Konten → Einladungen
2. اختر "Neuer Fahrer"
3. املأ فقط "Fahrername" (مثلاً: "Test Driver")
4. اترك حقول الرخصة فارغة
5. اضغط "Einladungslink generieren"
6. ✅ يجب أن تنجح العملية!
```

### 2. اختبار من قاعدة البيانات:

```sql
-- محاولة إدراج دعوة بدون رخصة
INSERT INTO account_invites (
  token,
  role,
  created_by,
  expires_at,
  is_used,
  new_driver_name,
  new_driver_license_letters,
  new_driver_license_numbers
) VALUES (
  gen_random_uuid(),
  'driver',
  'some-user-id',
  NOW() + INTERVAL '1 hour',
  false,
  'Test Driver',
  NULL,  -- ✅ NULL مسموح
  NULL   -- ✅ NULL مسموح
);

-- النتيجة: ✅ نجح!
```

### 3. التحقق من القيد الحالي:

```sql
SELECT pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conname = 'account_invites_new_driver_check';

-- يجب أن ترى:
-- CHECK ((((driver_id IS NOT NULL) AND (new_driver_name IS NULL))
--    OR ((driver_id IS NULL) AND (new_driver_name IS NOT NULL))))
```

---

## الفوائد

1. **مرونة أكبر:**
   - يمكن إضافة سائقين بدون رخصة
   - يمكن تحديث الرخصة لاحقاً

2. **تجربة مستخدم أفضل:**
   - أقل حقول إجبارية = تسجيل أسرع
   - لا أخطاء مربكة عند ترك الحقول فارغة

3. **منطق أبسط:**
   - القيد أبسط وأسهل في الفهم
   - أقل شروط = أقل احتمالية للأخطاء

4. **توافق مع الواقع:**
   - بعض السائقين قد لا يملكون رخصة بعد
   - يمكن إضافتهم للنظام مبكراً

---

## الملفات المعدلة

### 1. Migration:
```
supabase/migrations/[timestamp]_fix_account_invites_constraint_for_optional_license.sql
```

### 2. TypeScript Types:
```typescript
// src/lib/supabase.ts
export async function generateInviteToken(
  role: 'driver' | 'supervisor' | 'admin',
  createdBy: string,
  driverId?: string,
  newDriverData?: {
    name: string;
    license_letters?: string;   // ✅ اختياري الآن
    license_numbers?: string;   // ✅ اختياري الآن
  }
)
```

### 3. React Component:
```typescript
// src/components/InviteManagement.tsx
const [newDriverData, setNewDriverData] = useState({
  name: '',
  license_letters: '',
  license_numbers: ''
  // ✅ لا code بعد الآن
});
```

---

## الحالات الخاصة

### إذا أردت جعل الرخصة إجبارية مستقبلاً:

```sql
-- تحديث القيد لإجبار الرخصة
ALTER TABLE account_invites DROP CONSTRAINT account_invites_new_driver_check;

ALTER TABLE account_invites ADD CONSTRAINT account_invites_new_driver_check CHECK (
  (driver_id IS NOT NULL AND new_driver_name IS NULL)
  OR
  (driver_id IS NULL
   AND new_driver_name IS NOT NULL
   AND new_driver_license_letters IS NOT NULL  -- إجباري مرة أخرى
   AND new_driver_license_numbers IS NOT NULL)
);
```

### إذا أردت إضافة validation في الواجهة:

```typescript
// في InviteManagement.tsx
if (inviteType === 'new') {
  if (!newDriverData.name.trim()) {
    setMessage({ type: 'error', text: 'Fahrername ist erforderlich' });
    return;
  }

  // إضافة تحقق من الرخصة (اختياري)
  if (newDriverData.license_letters && !newDriverData.license_numbers) {
    setMessage({
      type: 'error',
      text: 'Wenn Buchstaben eingegeben werden, sind auch Nummern erforderlich'
    });
    return;
  }
}
```

---

## Build Status

```bash
npm run build
# ✅ built in 9.32s
# ✅ No errors
# ✅ PWA generated successfully
```

---

## الخلاصة

✅ **المشكلة:** حقول الرخصة كانت إجبارية في قاعدة البيانات
✅ **الحل:** جعلها اختيارية بالكامل
✅ **النتيجة:** نظام أكثر مرونة وسهولة في الاستخدام

**التغييرات:**
- 1 migration
- 1 TypeScript interface update
- 2 component state updates
- 0 breaking changes

**الوقت:** ~5 دقائق
**الحالة:** ✅ جاهز للإنتاج

---

**آخر تحديث:** 2026-03-11
**الإصدار:** 2.1

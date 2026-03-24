# إصلاح: تحديث الأسماء والتحقق من التفرد

## المشاكل التي تم حلها

### 1. تغيير اسم السائق لا يظهر في لوحة الإدارة ❌

**المشكلة:**
- عندما يغير السائق اسمه في صفحة الملف الشخصي
- الاسم يتغير في `drivers.driver_name` ✓
- لكن لا يتغير في `user_accounts.full_name` ❌
- لوحة الإدارة (جدول Users) لا تعكس التغيير ❌

**السبب:**
```typescript
// القديم - خطأ ❌
const result = await updateUserProfileAPI(user?.id || '', {
  username: newDisplayName.trim()  // يحدّث username بدلاً من full_name!
});
```

**الإصلاح:**
```typescript
// الجديد - صحيح ✓
const result = await updateUserProfileAPI(user?.id || '', {
  full_name: newDisplayName.trim()  // يحدّث full_name الآن!
});
```

### 2. عدم التحقق من تفرد اسم المستخدم والبريد الإلكتروني

**المشكلة:**
- `username` و `email` فريدان في قاعدة البيانات (UNIQUE constraint)
- عند محاولة تحديث لاسم مستخدم أو بريد موجود
- تحصل على خطأ قاعدة بيانات غير واضح
- لا توجد رسالة واضحة للمستخدم

**الإصلاح:**
تم إضافة التحقق المسبق في `update-profile` Edge Function:

```typescript
// التحقق من تفرد اسم المستخدم
if (username !== undefined) {
  const { data: existingUsername } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('username', username)
    .neq('id', userId)  // استثناء المستخدم الحالي
    .maybeSingle();

  if (existingUsername) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Benutzername ist bereits vergeben'  // رسالة واضحة
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// التحقق من تفرد البريد الإلكتروني
if (updateData.email !== undefined) {
  const { data: existingEmail } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('email', updateData.email)
    .neq('id', userId)
    .maybeSingle();

  if (existingEmail) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'E-Mail-Adresse ist bereits vergeben'
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// حماية إضافية: رسائل واضحة لأخطاء قاعدة البيانات
if (updateError) {
  let errorMessage = updateError.message;
  if (updateError.code === '23505') { // PostgreSQL unique violation
    if (errorMessage.includes('username')) {
      errorMessage = 'Benutzername ist bereits vergeben';
    } else if (errorMessage.includes('email')) {
      errorMessage = 'E-Mail-Adresse ist bereits vergeben';
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. عدم عرض الاسم الكامل في لوحة الإدارة

**المشكلة:**
- جدول Users في لوحة الإدارة يعرض فقط:
  - `username` (اسم المستخدم)
  - `email` (البريد الإلكتروني)
  - `role` (الدور)
  - `driver_name` (اسم السائق من جدول drivers)
- لا يعرض `full_name` من `user_accounts` ❌

**الإصلاح:**
تم إضافة عمود جديد للاسم الكامل:

```tsx
// ترويسة الجدول
<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
  Benutzername
</th>
<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
  E-Mail
</th>
<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
  Rolle
</th>
<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
  Vollständiger Name  {/* ✓ جديد */}
</th>
<th className="text-left py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
  Fahrer  {/* يعرض driver_name من جدول drivers */}
</th>

// محتوى الصف
<td className="py-3 px-4 text-slate-600 dark:text-slate-400">
  {userAccount.full_name || '—'}  {/* ✓ من user_accounts */}
</td>
<td className="py-3 px-4 text-slate-600 dark:text-slate-400">
  {userAccount.driver_name || '—'}  {/* من drivers */}
</td>
```

## كيف يعمل النظام الآن

### تدفق تحديث الاسم للسائق

```
┌─────────────────────────────────────────────────────────┐
│ 1. السائق يغير اسمه في صفحة الملف الشخصي              │
│    (مثلاً: من "أحمد محمد" إلى "أحمد علي")              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. handleNameUpdate() في DriverProfile.tsx             │
├─────────────────────────────────────────────────────────┤
│  ✅ تحديث drivers.driver_name                          │
│     UPDATE drivers                                      │
│     SET driver_name = 'أحمد علي'                       │
│     WHERE id = driver_id                                │
│                                                         │
│  ✅ تحديث user_accounts.full_name عبر Edge Function    │
│     POST /functions/v1/update-profile                   │
│     { userId, full_name: 'أحمد علي' }                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Edge Function: update-profile                       │
├─────────────────────────────────────────────────────────┤
│  🔍 لا يوجد username للتحقق                            │
│  ✅ تحديث full_name مباشرة                             │
│     UPDATE user_accounts                                │
│     SET full_name = 'أحمد علي'                         │
│     WHERE id = userId                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. النتيجة في قاعدة البيانات                           │
├─────────────────────────────────────────────────────────┤
│  drivers:                                               │
│    ✓ driver_name = 'أحمد علي'                          │
│                                                         │
│  user_accounts:                                         │
│    ✓ full_name = 'أحمد علي'                            │
│    • username = 'ahmad_m' (لم يتغير)                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. العرض في لوحة الإدارة                               │
├─────────────────────────────────────────────────────────┤
│  جدول Users:                                           │
│    • Benutzername: ahmad_m                              │
│    • Vollständiger Name: أحمد علي ✓ (محدّث!)          │
│    • Fahrer: أحمد علي ✓ (محدّث!)                      │
│                                                         │
│  كل الأماكن الأخرى (التقارير، الإدخالات):              │
│    • تعرض driver_name = 'أحمد علي' ✓                   │
└─────────────────────────────────────────────────────────┘
```

### تدفق التحقق من التفرد

```
┌─────────────────────────────────────────────────────────┐
│ المشرف يحاول تغيير بريد مستخدم                         │
│ من admin@example.com إلى user@example.com              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Edge Function: update-profile                          │
├─────────────────────────────────────────────────────────┤
│  🔍 التحقق: هل user@example.com موجود؟                 │
│     SELECT id FROM user_accounts                        │
│     WHERE email = 'user@example.com'                    │
│     AND id != current_user_id                           │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        │                               │
   [موجود] ❌                       [غير موجود] ✓
        │                               │
        ↓                               ↓
┌──────────────────┐          ┌──────────────────┐
│ رفض التحديث      │          │ السماح بالتحديث  │
├──────────────────┤          ├──────────────────┤
│ Status: 409      │          │ UPDATE email     │
│ Error:           │          │ Status: 200      │
│ "E-Mail-Adresse  │          │ Success: true    │
│  ist bereits     │          └──────────────────┘
│  vergeben"       │
└──────────────────┘
        │
        ↓
┌──────────────────────────────────────┐
│ المستخدم يرى رسالة خطأ واضحة:       │
│ "البريد الإلكتروني مستخدم بالفعل"   │
└──────────────────────────────────────┘
```

## الفرق بين الحقول

### في قاعدة البيانات

| الجدول | الحقل | القيد | الاستخدام |
|--------|-------|-------|-----------|
| `user_accounts` | `username` | UNIQUE, NOT NULL | اسم المستخدم لتسجيل الدخول |
| `user_accounts` | `email` | UNIQUE, NOT NULL | البريد الإلكتروني لتسجيل الدخول |
| `user_accounts` | `full_name` | NULL | الاسم الكامل للعرض |
| `drivers` | `driver_name` | NOT NULL | اسم السائق في التقارير |

### التمييز الواضح

**username** (اسم المستخدم):
- ✅ يجب أن يكون فريداً
- ✅ يُستخدم لتسجيل الدخول
- ✅ لا يتغير عادة
- ❌ لا يجب تغييره إلا في حالات خاصة

**full_name** (الاسم الكامل):
- ✅ يُعرض في لوحة الإدارة
- ✅ يمكن تغييره بحرية
- ✅ لا يؤثر على تسجيل الدخول
- ✅ يتزامن مع `driver_name` للسائقين

**driver_name** (اسم السائق):
- ✅ يُعرض في كل التقارير
- ✅ يُعرض في قوائم السائقين
- ✅ يتزامن مع `full_name` عند التحديث
- ✅ مرتبط بجدول `drivers`

## الملفات المُعدّلة

### 1. src/components/DriverProfile.tsx
**التغيير:**
```typescript
// ❌ القديم
const result = await updateUserProfileAPI(user?.id || '', {
  username: newDisplayName.trim()
});

// ✅ الجديد
const result = await updateUserProfileAPI(user?.id || '', {
  full_name: newDisplayName.trim()
});
```

**النتيجة:**
- الآن يحدّث `full_name` في `user_accounts`
- يظهر التغيير في لوحة الإدارة

### 2. supabase/functions/update-profile/index.ts
**التغييرات:**

1. **التحقق من تفرد username:**
```typescript
if (username !== undefined) {
  const { data: existingUsername } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('username', username)
    .neq('id', userId)
    .maybeSingle();

  if (existingUsername) {
    return new Response(
      JSON.stringify({ success: false, error: 'Benutzername ist bereits vergeben' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

2. **التحقق من تفرد email:**
```typescript
if (updateData.email !== undefined) {
  const { data: existingEmail } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('email', updateData.email)
    .neq('id', userId)
    .maybeSingle();

  if (existingEmail) {
    return new Response(
      JSON.stringify({ success: false, error: 'E-Mail-Adresse ist bereits vergeben' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

3. **رسائل خطأ واضحة:**
```typescript
if (updateError) {
  let errorMessage = updateError.message;
  if (updateError.code === '23505') {
    if (errorMessage.includes('username')) {
      errorMessage = 'Benutzername ist bereits vergeben';
    } else if (errorMessage.includes('email')) {
      errorMessage = 'E-Mail-Adresse ist bereits vergeben';
    }
  }

  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. src/components/AdminDashboardV2.tsx
**التغيير:**

1. **إضافة عمود جديد:**
```tsx
// الترويسة
<th>Vollständiger Name</th>  {/* جديد */}
<th>Fahrer</th>

// المحتوى
<td>{userAccount.full_name || '—'}</td>  {/* جديد */}
<td>{userAccount.driver_name || '—'}</td>
```

**النتيجة:**
- الآن يعرض كلاً من `full_name` و `driver_name`
- يمكن رؤية كلا القيمتين في لوحة الإدارة

## الاختبارات المطلوبة

### ✅ اختبار 1: تحديث اسم السائق
```
1. سجل دخول كسائق
2. اذهب للملف الشخصي
3. غيّر الاسم إلى "اسم جديد"
4. احفظ التغييرات
5. سجل دخول كإداري
6. افتح تبويب Users
7. تحقق:
   - Vollständiger Name = "اسم جديد" ✓
   - Fahrer = "اسم جديد" ✓
```

### ✅ اختبار 2: محاولة اسم مستخدم مكرر
```
1. سجل دخول كإداري
2. حاول تغيير username لمستخدم إلى اسم موجود
3. تحقق: رسالة "Benutzername ist bereits vergeben" ✓
4. التحديث مرفوض ✓
```

### ✅ اختبار 3: محاولة بريد مكرر
```
1. سجل دخول كإداري
2. حاول تغيير email لمستخدم إلى بريد موجود
3. تحقق: رسالة "E-Mail-Adresse ist bereits vergeben" ✓
4. التحديث مرفوض ✓
```

### ✅ اختبار 4: تحديث اسم مستخدم فريد
```
1. سجل دخول كإداري
2. غيّر username لمستخدم إلى اسم غير موجود
3. تحقق: التحديث نجح ✓
4. تحقق: يمكن تسجيل الدخول بالاسم الجديد ✓
```

### ✅ اختبار 5: عرض الأسماء في لوحة الإدارة
```
1. سجل دخول كإداري
2. افتح تبويب Users
3. تحقق من وجود:
   - عمود "Benutzername" ✓
   - عمود "Vollständiger Name" ✓
   - عمود "Fahrer" ✓
4. تحقق من أن كل حساب يعرض:
   - username في عمود "Benutzername" ✓
   - full_name في عمود "Vollständiger Name" ✓
   - driver_name في عمود "Fahrer" (للسائقين فقط) ✓
```

## الخلاصة

✅ **تم الإصلاح:**
1. تحديث الاسم الآن يحدّث `full_name` في `user_accounts`
2. التغييرات تظهر فوراً في لوحة الإدارة
3. التحقق من تفرد `username` و `email` قبل التحديث
4. رسائل خطأ واضحة للمستخدم
5. عرض كلاً من `full_name` و `driver_name` في جدول Users

✅ **الحماية:**
- لا يمكن إنشاء اسم مستخدم مكرر
- لا يمكن إنشاء بريد إلكتروني مكرر
- رسائل واضحة بالألمانية عند الخطأ

✅ **التزامن:**
- `driver_name` يتحدث في جدول `drivers`
- `full_name` يتحدث في جدول `user_accounts`
- كلاهما يُعرض بشكل صحيح في لوحة الإدارة

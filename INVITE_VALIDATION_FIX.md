# إصلاح: التحقق من تفرد اسم المستخدم والبريد عند الدعوات

## المشكلة السابقة

❌ عند إنشاء رابط دعوة أو حساب جديد:
- لا يوجد تحقق من أن اسم المستخدم مستخدم مسبقاً
- لا يوجد تحقق من أن البريد الإلكتروني مستخدم مسبقاً
- الخطأ يظهر فقط عند محاولة الحفظ في قاعدة البيانات
- رسالة الخطأ غير واضحة للمستخدم

## الحل المطبق

✅ تم إضافة التحقق المسبق في **3 أماكن**:

### 1. InviteManagement (إنشاء روابط الدعوة)
### 2. DirectAccountCreation (إنشاء حساب مباشر)
### 3. admin-update-user Edge Function (تعديل بيانات المستخدم)

---

## التفاصيل الفنية

### 1. InviteManagement.tsx

**الموقع:** `src/components/InviteManagement.tsx`

**ماذا يفعل:**
عند إنشاء رابط دعوة جديد، يتحقق من عدم وجود نفس اسم المستخدم أو البريد.

**الكود المضاف:**

```typescript
// Check if username already exists
if (supabase) {
  const { data: existingUsername } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('username', username.trim())
    .maybeSingle();

  if (existingUsername) {
    setMessage({ type: 'error', text: 'Benutzername ist bereits vergeben' });
    setGenerating(false);
    return;
  }

  // Check if email already exists (username@domain.com format)
  const emailToCheck = `${username.trim().toLowerCase()}@transo-flex.de`;
  const { data: existingEmail } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('email', emailToCheck)
    .maybeSingle();

  if (existingEmail) {
    setMessage({ type: 'error', text: 'E-Mail-Adresse ist bereits vergeben' });
    setGenerating(false);
    return;
  }
}
```

**النتيجة:**
- ✅ يظهر تحذير فوري عند اختيار اسم مستخدم موجود
- ✅ يظهر تحذير فوري إذا كان البريد موجود
- ✅ لا يُنشئ رابط الدعوة إلا إذا كانت البيانات فريدة

---

### 2. DirectAccountCreation.tsx

**الموقع:** `src/components/DirectAccountCreation.tsx`

**ماذا يفعل:**
عند إنشاء حساب مباشر (بدون دعوة)، يتحقق من عدم وجود نفس اسم المستخدم أو البريد.

**الكود المضاف:**

```typescript
// Check if username already exists
if (supabase) {
  const { data: existingUsername } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('username', formData.username.trim())
    .maybeSingle();

  if (existingUsername) {
    setMessage({ type: 'error', text: 'Benutzername ist bereits vergeben' });
    setLoading(false);
    return;
  }

  // Check if email already exists
  const emailToCheck = `${formData.emailLocalPart.trim().toLowerCase()}@transo-flex.de`;
  const { data: existingEmail } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('email', emailToCheck)
    .maybeSingle();

  if (existingEmail) {
    setMessage({ type: 'error', text: 'E-Mail-Adresse ist bereits vergeben' });
    setLoading(false);
    return;
  }
}
```

**النتيجة:**
- ✅ يظهر تحذير فوري عند محاولة إنشاء حساب باسم موجود
- ✅ يظهر تحذير فوري إذا كان البريد موجود
- ✅ لا يُنشئ الحساب إلا إذا كانت البيانات فريدة

---

### 3. admin-update-user Edge Function

**الموقع:** `supabase/functions/admin-update-user/index.ts`

**ماذا يفعل:**
عند تعديل اسم مستخدم أو بريد من لوحة الإدارة، يتحقق من عدم التعارض.

**الكود المضاف:**

```typescript
// Check for unique constraint violations before updating
if (username !== undefined) {
  const { data: existingUsername } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('username', username)
    .neq('id', userId)  // استثناء المستخدم الحالي
    .maybeSingle();

  if (existingUsername) {
    return new Response(
      JSON.stringify({ success: false, error: 'Benutzername ist bereits vergeben' }),
      {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

if (email !== undefined) {
  const { data: existingEmail } = await supabase
    .from('user_accounts')
    .select('id')
    .eq('email', email)
    .neq('id', userId)
    .maybeSingle();

  if (existingEmail) {
    return new Response(
      JSON.stringify({ success: false, error: 'E-Mail-Adresse ist bereits vergeben' }),
      {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// حماية إضافية: رسائل واضحة لأخطاء قاعدة البيانات
if (updateError) {
  let errorMessage = updateError.message;
  if (updateError.code === '23505') { // PostgreSQL unique violation code
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

**النتيجة:**
- ✅ يرفض التعديل إذا كان الاسم الجديد مستخدم
- ✅ يرفض التعديل إذا كان البريد الجديد مستخدم
- ✅ يستثني المستخدم نفسه (يمكن حفظ نفس البيانات)
- ✅ رسائل خطأ واضحة بالألمانية

---

## كيف يعمل النظام الآن

### السيناريو 1: إنشاء رابط دعوة

```
┌─────────────────────────────────────────────────────┐
│ 1. المشرف يحاول إنشاء رابط دعوة                    │
│    Username: "ahmad_m"                              │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. التحقق من اسم المستخدم                          │
├─────────────────────────────────────────────────────┤
│  SELECT id FROM user_accounts                       │
│  WHERE username = 'ahmad_m'                         │
└─────────────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        │                       │
   [موجود] ❌              [غير موجود] ✓
        │                       │
        ↓                       ↓
┌──────────────────┐   ┌───────────────────┐
│ رفض الدعوة       │   │ التحقق من البريد  │
├──────────────────┤   ├───────────────────┤
│ رسالة خطأ:       │   │ ahmad_m@          │
│ "Benutzername    │   │ transo-flex.de    │
│  ist bereits     │   └───────────────────┘
│  vergeben"       │            ↓
└──────────────────┘   ┌───────────────────┐
                       │ SELECT id         │
                       │ FROM user_accounts│
                       │ WHERE email = ... │
                       └───────────────────┘
                                ↓
                    ┌───────────┴───────────┐
                    │                       │
               [موجود] ❌              [غير موجود] ✓
                    │                       │
                    ↓                       ↓
            ┌──────────────────┐   ┌──────────────────┐
            │ رفض الدعوة       │   │ إنشاء الدعوة     │
            ├──────────────────┤   ├──────────────────┤
            │ رسالة خطأ:       │   │ ✓ حفظ الدعوة    │
            │ "E-Mail-Adresse  │   │ ✓ توليد الرابط   │
            │  ist bereits     │   │ ✓ عرض نافذة      │
            │  vergeben"       │   │   المشاركة       │
            └──────────────────┘   └──────────────────┘
```

### السيناريو 2: إنشاء حساب مباشر

```
┌─────────────────────────────────────────────────────┐
│ 1. المشرف يملأ نموذج إنشاء حساب                    │
│    Username: "test_user"                            │
│    Email: "test_user"                               │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. التحقق من جميع الحقول                           │
├─────────────────────────────────────────────────────┤
│  ✓ الاسم الكامل ليس فارغاً                         │
│  ✓ اسم المستخدم بالتنسيق الصحيح                   │
│  ✓ البريد الإلكتروني صالح                         │
│  ✓ كلمة المرور على الأقل 6 أحرف                   │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. التحقق من التفرد                                │
├─────────────────────────────────────────────────────┤
│  🔍 هل username موجود؟                             │
│  🔍 هل email موجود؟                                │
└─────────────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        │                       │
    [مكرر] ❌               [فريد] ✓
        │                       │
        ↓                       ↓
┌──────────────────┐   ┌──────────────────┐
│ رفض الإنشاء      │   │ إنشاء الحساب     │
├──────────────────┤   ├──────────────────┤
│ رسالة خطأ واضحة │   │ ✓ حفظ الحساب    │
└──────────────────┘   │ ✓ ربط السائق     │
                       │   (إن وجد)       │
                       └──────────────────┘
```

### السيناريو 3: تعديل بيانات مستخدم من لوحة الإدارة

```
┌─────────────────────────────────────────────────────┐
│ 1. المشرف يحاول تغيير username لمستخدم             │
│    من "user1" إلى "user2"                          │
│    User ID: abc-123                                 │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. Edge Function: admin-update-user                │
├─────────────────────────────────────────────────────┤
│  ✓ التحقق من صلاحيات المشرف                        │
│  ✓ التحقق من أن المستخدم نشط                       │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. التحقق من التفرد                                │
├─────────────────────────────────────────────────────┤
│  SELECT id FROM user_accounts                       │
│  WHERE username = 'user2'                           │
│  AND id != 'abc-123'  ← استثناء المستخدم نفسه      │
└─────────────────────────────────────────────────────┘
                    ↓
        ┌───────────┴───────────┐
        │                       │
   [موجود] ❌              [غير موجود] ✓
        │                       │
        ↓                       ↓
┌──────────────────┐   ┌──────────────────┐
│ رفض التعديل      │   │ السماح بالتعديل  │
├──────────────────┤   ├──────────────────┤
│ Status: 409      │   │ UPDATE username  │
│ Error:           │   │ Status: 200      │
│ "Benutzername    │   │ Success: true    │
│  ist bereits     │   └──────────────────┘
│  vergeben"       │
└──────────────────┘
```

---

## التغطية الكاملة

### ✅ أماكن التحقق من التفرد

| المكان | التحقق من Username | التحقق من Email | رسالة واضحة |
|--------|-------------------|-----------------|-------------|
| **InviteManagement** | ✅ | ✅ | ✅ |
| **DirectAccountCreation** | ✅ | ✅ | ✅ |
| **admin-update-user** | ✅ | ✅ | ✅ |
| **update-profile** | ✅ | ✅ | ✅ |

### ✅ الحماية على مستوى قاعدة البيانات

```sql
-- في user_accounts table
username text UNIQUE NOT NULL,
email text UNIQUE NOT NULL,
```

**طبقات الحماية:**
1. ✅ **Frontend Validation** - تحقق فوري قبل إرسال البيانات
2. ✅ **Edge Function Validation** - تحقق في الخادم
3. ✅ **Database Constraint** - حماية نهائية في قاعدة البيانات

---

## الرسائل المعروضة للمستخدم

### باللغة الألمانية

| الحالة | الرسالة |
|--------|---------|
| اسم مستخدم مكرر | `Benutzername ist bereits vergeben` |
| بريد إلكتروني مكرر | `E-Mail-Adresse ist bereits vergeben` |

### الترجمة العربية

| الحالة | الرسالة |
|--------|---------|
| اسم مستخدم مكرر | اسم المستخدم مستخدم بالفعل |
| بريد إلكتروني مكرر | البريد الإلكتروني مستخدم بالفعل |

---

## الاختبارات المطلوبة

### ✅ اختبار 1: رابط الدعوة - اسم مستخدم مكرر
```
1. سجل دخول كإداري
2. اذهب لتبويب "Einladungen"
3. أدخل اسم مستخدم موجود مسبقاً
4. اضغط "Einladung erstellen"
5. تحقق: رسالة "Benutzername ist bereits vergeben" ✓
6. تحقق: لم يُنشأ رابط الدعوة ✓
```

### ✅ اختبار 2: حساب مباشر - بريد مكرر
```
1. سجل دخول كإداري
2. اذهب لتبويب "Benutzer" → "Konto direkt erstellen"
3. أدخل بريد إلكتروني موجود مسبقاً
4. املأ باقي الحقول
5. اضغط "Konto erstellen"
6. تحقق: رسالة "E-Mail-Adresse ist bereits vergeben" ✓
7. تحقق: لم يُنشأ الحساب ✓
```

### ✅ اختبار 3: تعديل من لوحة الإدارة - اسم مكرر
```
1. سجل دخول كإداري
2. اذهب لتبويب "Benutzer"
3. اختر مستخدم
4. حاول تغيير username إلى اسم موجود
5. تحقق: رسالة "Benutzername ist bereits vergeben" ✓
6. تحقق: لم يتم التعديل ✓
```

### ✅ اختبار 4: تعديل لنفس القيمة (يجب أن ينجح)
```
1. سجل دخول كإداري
2. اذهب لتبويب "Benutzer"
3. اختر مستخدم
4. احفظ نفس username الحالي
5. تحقق: التعديل نجح ✓ (لأنه نفس المستخدم)
```

### ✅ اختبار 5: رابط دعوة - اسم جديد
```
1. سجل دخول كإداري
2. اذهب لتبويب "Einladungen"
3. أدخل اسم مستخدم جديد غير موجود
4. اضغط "Einladung erstellen"
5. تحقق: تم إنشاء رابط الدعوة بنجاح ✓
6. تحقق: ظهرت نافذة المشاركة ✓
```

---

## الخلاصة

✅ **تم الإصلاح الكامل:**
1. التحقق من تفرد username قبل إنشاء الدعوة
2. التحقق من تفرد email قبل إنشاء الدعوة
3. التحقق من تفرد username/email قبل إنشاء حساب مباشر
4. التحقق من تفرد username/email عند التعديل من لوحة الإدارة
5. رسائل خطأ واضحة بالألمانية
6. منع إنشاء البيانات المكررة

✅ **الحماية:**
- 3 طبقات من التحقق (Frontend + Edge Function + Database)
- رسائل واضحة للمستخدم
- استثناء المستخدم نفسه عند التعديل

✅ **تجربة المستخدم:**
- تحذيرات فورية قبل الحفظ
- رسائل واضحة بدون تفاصيل تقنية
- لا حاجة لإعادة ملء النموذج

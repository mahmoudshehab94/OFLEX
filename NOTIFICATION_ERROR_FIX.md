# إصلاح خطأ "OneSignal غير مُفعّل"

## المشكلة

عند محاولة تفعيل الإشعارات، تظهر رسالة:

```
غير مُفعّل. يُرجى التواصل مع الإدارة OneSignal. فشل تعريف الإشتراكات
```

---

## السبب الرئيسي

هذا الخطأ يظهر لأحد الأسباب التالية:

### 1. OneSignal SDK فشل في التحميل

**التشخيص:**
- افتح Console (F12)
- ابحث عن: `❌ OneSignal failed to load`

**الأسباب:**
- مانع الإعلانات يحجب OneSignal CDN
- اتصال الإنترنت ضعيف
- إعدادات الخصوصية في المتصفح

**الحل:**
```
1. عطّل مانع الإعلانات (AdBlock, uBlock Origin, إلخ)
2. تأكد من اتصال الإنترنت
3. جرّب متصفح آخر
4. تحقق من إعدادات الخصوصية
```

### 2. OneSignal App ID غير صحيح

**التشخيص:**
- Console يُظهر: `❌ OneSignal App ID not configured`

**التحقق:**
```bash
# افتح .env وتأكد من:
VITE_ONESIGNAL_APP_ID=1db29131-1f03-4188-8b3b-af2ae9c43717
```

**الحل:**
```bash
# إذا كان مفقوداً، أضف السطر أعلاه إلى .env
# ثم أعد تشغيل التطبيق:
npm run dev
```

### 3. أذونات المتصفح مرفوضة

**التشخيص:**
- رسالة: `يرجى السماح بالإشعارات في المتصفح`
- Console: `❌ Notification permission denied`

**الحل (Chrome/Edge):**
```
1. اضغط على أيقونة القفل 🔒 بجانب URL
2. اذهب إلى "Site settings"
3. ابحث عن "Notifications"
4. غيّرها إلى "Allow"
5. أعد تحميل الصفحة وجرّب مرة أخرى
```

**الحل (Firefox):**
```
1. اضغط على أيقونة القفل 🔒
2. "Connection secure" → "More information"
3. علامة التبويب "Permissions"
4. "Receive notifications" → "Allow"
5. أعد تحميل الصفحة
```

---

## التحسينات المُطبّقة

تم تحسين معالجة الأخطاء في الكود:

### 1. رسائل خطأ أوضح

**قبل:**
```
فشل تفعيل الإشعارات. OneSignal غير مفعّل. يرجى التواصل مع الإدارة.
```

**بعد:**
```javascript
// حسب نوع الخطأ:
'نظام الإشعارات غير مُهيأ. تواصل مع الإدارة لتفعيل OneSignal.'
'فشل تحميل نظام الإشعارات. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
'خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى.'
'حدث خطأ غير متوقع. تأكد من السماح بالإشعارات وحاول مرة أخرى.'
```

### 2. معالجة أفضل للأخطاء

**في `onesignal.ts`:**
```typescript
// الآن نمسك الأخطاء من waitForOneSignal ونرميها بوضوح
try {
  if (!window.OneSignal) {
    await this.waitForOneSignal();
  }
} catch (error) {
  throw new Error('OneSignal failed to load');
}
```

### 3. propagate الأخطاء بشكل صحيح

**قبل:**
```typescript
catch (error) {
  console.error('Failed to subscribe:', error);
  return null;  // ❌ يخفي الخطأ
}
```

**بعد:**
```typescript
catch (error: any) {
  console.error('Failed to subscribe:', error);
  throw error;  // ✅ يُظهر الخطأ للمستخدم
}
```

---

## خطوات التشخيص

### الخطوة 1: افتح Console

```
اضغط F12 في المتصفح
اذهب إلى علامة التبويب "Console"
```

### الخطوة 2: اضغط "تفعيل"

### الخطوة 3: افحص الرسائل

#### ✅ النجاح - يجب أن ترى:
```
🔔 Starting subscription process...
⏳ Waiting for OneSignal to load...
📱 Requesting notification permission...
✅ Permission granted, logging in to OneSignal...
🔑 Getting player ID...
✅ Player ID: xxxxx-xxxxx-xxxxx
💾 Saving to database...
✅ Subscription saved successfully!
```

#### ❌ الفشل - حدد المشكلة:

**إذا رأيت:**
```
❌ OneSignal App ID not configured
```
→ المشكلة: `.env` لا يحتوي على App ID
→ الحل: أضف `VITE_ONESIGNAL_APP_ID` إلى `.env`

**إذا رأيت:**
```
❌ OneSignal failed to load
```
→ المشكلة: SDK لم يتم تحميله
→ الحل: عطّل مانع الإعلانات، تحقق من الإنترنت

**إذا رأيت:**
```
❌ Notification permission denied
```
→ المشكلة: المستخدم رفض الأذونات
→ الحل: اتبع خطوات إعادة تعيين الأذونات أعلاه

**إذا رأيت:**
```
❌ Database error: ...
```
→ المشكلة: خطأ في قاعدة البيانات
→ الحل: تحقق من اتصال Supabase

---

## الاختبار اليدوي

افتح Console واكتب:

```javascript
// 1. تحقق من OneSignal
console.log('OneSignal loaded:', !!window.OneSignal);

// 2. تحقق من App ID
console.log('App ID:', import.meta.env.VITE_ONESIGNAL_APP_ID);

// 3. تحقق من أذونات الإشعارات
console.log('Notification permission:', Notification.permission);

// 4. جرّب طلب الإذن يدوياً
Notification.requestPermission().then(result => {
  console.log('Permission result:', result);
});
```

**النتائج المتوقعة:**
```
OneSignal loaded: true
App ID: 1db29131-1f03-4188-8b3b-af2ae9c43717
Notification permission: default (أو granted أو denied)
Permission result: granted (إذا وافق المستخدم)
```

---

## الحلول السريعة

### الحل 1: إعادة تعيين كل شيء

```bash
# 1. امسح cache المتصفح (Ctrl+Shift+Delete)
# 2. امسح أذونات الموقع
# 3. أعد تشغيل المتصفح
# 4. افتح التطبيق وجرّب مرة أخرى
```

### الحل 2: جرّب متصفح آخر

```
Chrome → Firefox
Edge → Chrome
Safari → Chrome (على Mac)
```

### الحل 3: وضع التصفح الخاص

```
Ctrl+Shift+N (Chrome/Edge)
Ctrl+Shift+P (Firefox)

هذا يتجاوز مشاكل Cache والإضافات
```

### الحل 4: تحقق من OneSignal Dashboard

```
1. اذهب إلى: https://dashboard.onesignal.com/
2. سجل دخول
3. اختر التطبيق
4. Settings → Keys & IDs
5. تأكد من أن App ID يطابق ما في .env
```

---

## الملفات المعدلة

### 1. `src/lib/onesignal.ts`

**التحسينات:**
- ✅ معالجة أفضل لأخطاء تحميل SDK
- ✅ رمي الأخطاء بدلاً من إخفائها
- ✅ رسائل خطأ أوضح

```typescript
// قبل:
catch (error) {
  return null;
}

// بعد:
catch (error: any) {
  throw error;
}
```

### 2. `src/components/NotificationSettings.tsx`

**التحسينات:**
- ✅ رسائل خطأ بالعربية أوضح
- ✅ تصنيف الأخطاء حسب النوع
- ✅ إرشادات للمستخدم

```typescript
// رسائل خطأ محددة لكل حالة
if (error?.message?.includes('not configured')) {
  errorMessage = 'نظام الإشعارات غير مُهيأ...';
} else if (error?.message?.includes('failed to load')) {
  errorMessage = 'فشل تحميل نظام الإشعارات...';
}
```

---

## Build Status

```bash
npm run build
# ✅ built in 10.05s
# ✅ No errors
# ✅ PWA generated successfully
```

---

## ملاحظات مهمة

### على iOS Safari:
```
❌ Web Push غير مدعوم بالكامل على iOS Safari
✅ استخدم Chrome أو Firefox للحصول على أفضل تجربة
```

### في بيئة الإنتاج:
```
✅ يتطلب HTTPS
✅ Netlify/Vercel يوفران HTTPS تلقائياً
❌ مواقع HTTP لن تعمل
```

### مع مانع الإعلانات:
```
❌ قد يحجب OneSignal SDK
✅ عطّل مانع الإعلانات للموقع
✅ أو أضف الموقع إلى قائمة الاستثناءات
```

---

## FAQ

### س: لماذا تظهر رسالة "OneSignal غير مُفعّل"؟

**ج:** الأسباب الشائعة:
1. مانع الإعلانات يحجب OneSignal
2. App ID غير موجود في `.env`
3. اتصال الإنترنت ضعيف
4. إعدادات الخصوصية صارمة

### س: هل أحتاج إلى حساب OneSignal؟

**ج:** لا، App ID موجود مسبقاً في `.env`. فقط تأكد من أنه موجود.

### س: هل يعمل بدون اتصال إنترنت؟

**ج:** لا، تحتاج إلى اتصال لاستقبال الإشعارات.

### س: كم مرة سأحصل على التذكيرات؟

**ج:** الإعدادات الافتراضية:
- البدء: 6 مساءً (18:00)
- كل 30 دقيقة
- حتى تسجل العمل أو ينتهي اليوم

---

## الخلاصة

المشكلة الرئيسية: **معالجة الأخطاء لم تكن واضحة**

الحل المُطبّق:
1. ✅ تحسين رسائل الخطأ
2. ✅ معالجة أفضل لفشل تحميل SDK
3. ✅ رمي الأخطاء بشكل صحيح
4. ✅ إرشادات واضحة للمستخدم

**الآن:** رسائل الخطأ أوضح وتساعد المستخدم على فهم المشكلة وحلها.

---

**آخر تحديث:** 2026-03-11
**الإصدار:** 1.1
**الحالة:** ✅ تم التحسين

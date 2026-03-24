# تقرير تشخيصي - نظام الإشعارات

## التاريخ: 24 مارس 2026

---

## 📋 ملخص المشكلة

تم تفعيل نظام الإشعارات ولكن لا يتم إرسال أي تنبيهات إلى المستخدمين.

---

## 🔍 نتائج الفحص

### ✅ الأمور التي تعمل بشكل صحيح:

1. **قاعدة البيانات**
   - جدول `notification_subscriptions` موجود ويعمل
   - السائق "mahmoud" لديه اشتراك مفعّل
   - OneSignal Player ID موجود: `335827c3-0be9-4918-a31b-0854eba4b226`
   - External ID موجود: `user_ef982f84-11b5-4143-a1fe-b0d717676d79`

2. **Edge Functions**
   - دالة `send-daily-reminders` موجودة ومنشورة
   - الدالة تعمل بدون أخطاء في الكود
   - المنطق البرمجي صحيح

3. **الأسرار البيئية**
   - `ONESIGNAL_APP_ID` مكون: ✅
   - `ONESIGNAL_REST_API_KEY` مكون: ✅
   - جميع أسرار Supabase مكونة: ✅

### ❌ المشكلة الرئيسية المكتشفة:

**مفتاح OneSignal REST API Key غير صحيح أو غير صالح**

عند محاولة إرسال إشعار تجريبي، حصلنا على الخطأ التالي:

```json
{
  "errors": [
    "Access denied. Please include an 'Authorization: ...' header with a valid API key"
  ]
}
```

هذا يعني أن:
- المفتاح المكون في Supabase غير صحيح
- أو المفتاح منتهي الصلاحية
- أو تم إلغاؤه من لوحة تحكم OneSignal

---

## 🔧 الحل المطلوب

### الخطوة 1: الحصول على مفتاح API صحيح من OneSignal

1. افتح لوحة تحكم OneSignal: https://app.onesignal.com
2. اختر تطبيقك أو أنشئ تطبيق جديد
3. اذهب إلى **Settings > Keys & IDs**
4. انسخ **REST API Key** (يجب أن يبدأ بـ `os_v2_...` أو `Basic ...`)

### الخطوة 2: تحديث المفتاح

يجب إضافة المفتاح الصحيح إلى Supabase. استخدم الأمر التالي:

```bash
# من لوحة تحكم Supabase أو باستخدام CLI
supabase secrets set ONESIGNAL_REST_API_KEY="YOUR_ACTUAL_REST_API_KEY"
```

**ملاحظة مهمة:** المفتاح الصحيح عادة يكون بأحد الأشكال التالية:
- `os_v2_app_xxxxxxxxxxxxxxxx` (النوع الجديد)
- أو مفتاح Base64 طويل (النوع القديم)

---

## 📊 إحصائيات الاختبار الحالي

من آخر اختبار لدالة إرسال التنبيهات:

```json
{
  "date": "2026-03-24",
  "hour": 21,
  "minute": 3,
  "stats": {
    "totalActiveDrivers": 5,
    "driversWithSubmissions": 2,
    "driversNeedingReminder": 3,
    "remindersSent": 0,
    "driversSkipped": 3
  },
  "skippedDrivers": [
    {"name": "musto", "reason": "No subscription"},
    {"name": "Hossam fahrer", "reason": "No subscription"},
    {"name": "Rayan", "reason": "No subscription"}
  ]
}
```

### ملاحظات:
- 3 سائقين يحتاجون تنبيهات لكن ليس لديهم اشتراكات
- السائق "mahmoud" سجل ساعات عمله بالفعل، لذلك لا يحتاج تنبيه
- السائق "Elgendy" سجل ساعات عمله أيضاً

---

## 🧪 دالة الاختبار

تم إنشاء دالة `test-notification` يمكن استخدامها لاختبار إرسال الإشعارات:

```bash
curl -X POST "https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/test-notification" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "user_ef982f84-11b5-4143-a1fe-b0d717676d79",
    "title": "اختبار",
    "message": "رسالة تجريبية"
  }'
```

---

## ✅ خطوات ما بعد إصلاح المفتاح

بعد تحديث `ONESIGNAL_REST_API_KEY` بالمفتاح الصحيح:

1. **اختبر الإشعارات يدوياً** باستخدام دالة `test-notification`
2. **اطلب من السائقين الآخرين تفعيل الإشعارات** من صفحة الإعدادات
3. **راقب سجل الإشعارات** في جدول `notification_reminders_log`

---

## 📱 كيف يفعّل السائقون الإشعارات؟

يجب على كل سائق:

1. تسجيل الدخول إلى حسابه
2. الذهاب إلى تبويب **الإعدادات** (Settings)
3. الضغط على **"تفعيل إشعارات التذكير"**
4. السماح للمتصفح بإرسال الإشعارات عند طلب الإذن
5. تخصيص الإعدادات (ساعة البدء، التكرار، إلخ)

---

## 🔔 متى يتم إرسال التنبيهات؟

النظام يرسل تنبيهات تلقائية عندما:

- **الساعة >= ساعة البدء المحددة** (افتراضي: 6 مساءً)
- **السائق لم يسجل ساعات عمله اليوم**
- **مرت المدة المحددة** منذ آخر تنبيه (افتراضي: 30 دقيقة)
- **اليوم ليس عطلة نهاية أسبوع** (إذا كانت الإعدادات تتخطى العطلات)

---

## 🎯 الخلاصة

**المشكلة الوحيدة:** مفتاح OneSignal REST API Key غير صحيح أو منتهي الصلاحية.

**الحل:** الحصول على المفتاح الصحيح من OneSignal وتحديثه في أسرار Supabase.

بعد ذلك، سيعمل النظام بشكل كامل وستُرسل الإشعارات تلقائياً! 🚀

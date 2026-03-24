# تحديث مفتاح OneSignal API

## المفتاح الجديد الذي حصلت عليه:

```
os_v2_app_dwzjcmi7anayrcz3v4votrbxc4ilyx2y76zemtfjwt7hyfmjjsast3tkeovzzerbxmyjfn64mfw2x6jsen3hpmjpdjoxalabwws4hby
```

---

## خطوات تحديث المفتاح في Supabase:

### الطريقة 1: من لوحة تحكم Supabase (الأسهل)

1. افتح لوحة تحكم Supabase: https://supabase.com/dashboard
2. اختر مشروعك: `edeneqmxicfwmcbsxrxx`
3. اذهب إلى **Project Settings** (⚙️) من القائمة الجانبية
4. اختر **Edge Functions** من القائمة
5. اضغط على تبويب **Secrets**
6. ابحث عن `ONESIGNAL_REST_API_KEY` في القائمة
7. إذا كان موجوداً، اضغط على **Edit** وحدّث القيمة
8. إذا لم يكن موجوداً، اضغط على **Add new secret**:
   - Name: `ONESIGNAL_REST_API_KEY`
   - Value: `os_v2_app_dwzjcmi7anayrcz3v4votrbxc4ilyx2y76zemtfjwt7hyfmjjsast3tkeovzzerbxmyjfn64mfw2x6jsen3hpmjpdjoxalabwws4hby`
9. اضغط على **Save** أو **Add**

### الطريقة 2: باستخدام Supabase CLI (إذا كان لديك صلاحية الوصول)

```bash
supabase secrets set ONESIGNAL_REST_API_KEY="os_v2_app_dwzjcmi7anayrcz3v4votrbxc4ilyx2y76zemtfjwt7hyfmjjsast3tkeovzzerbxmyjfn64mfw2x6jsen3hpmjpdjoxalabwws4hby" --project-ref edeneqmxicfwmcbsxrxx
```

---

## بعد التحديث:

### اختبار إرسال إشعار تجريبي:

```bash
curl -X POST "https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/test-notification" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZW5lcW14aWNmd21jYnN4cnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDkyMTAsImV4cCI6MjA4NDU4NTIxMH0.zwcZ4ajrGKzRPyz--m7FjQc8n5VXmeCrCbH-y02U628" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "user_ef982f84-11b5-4143-a1fe-b0d717676d79",
    "title": "اختبار التنبيهات",
    "message": "إذا وصلك هذا الإشعار، فالنظام يعمل بشكل ممتاز!"
  }'
```

إذا نجح الاختبار، ستحصل على رد مثل:

```json
{
  "success": true,
  "message": "Test notification sent successfully",
  "notification_id": "xxxxx-xxxxx-xxxxx",
  "recipients": 1,
  "external_id": "user_ef982f84-11b5-4143-a1fe-b0d717676d79"
}
```

---

## ملاحظة مهمة:

⚠️ **بعد تحديث المفتاح، قد يستغرق الأمر دقيقة أو دقيقتين حتى يتم تحميل القيمة الجديدة في Edge Functions**

إذا فشل الاختبار الأول، انتظر دقيقة وحاول مرة أخرى.

---

## تأكد من نجاح التحديث:

بعد تحديث المفتاح ونجاح الاختبار، النظام سيعمل تلقائياً وسيرسل:

1. ✅ **تنبيهات يومية للسائقين** الذين لم يسجلوا ساعات عملهم
2. ✅ **ملخصات للمشرفين** عن السائقين الذين لم يسجلوا
3. ✅ **تنبيهات دورية** حسب الإعدادات المخصصة لكل مستخدم

---

## العودة إلى التطبيق

بعد التحديث الناجح، يمكنك:
- دعوة السائقين الآخرين لتفعيل الإشعارات من صفحة الإعدادات
- تخصيص أوقات التنبيهات من صفحة الإعدادات
- مراقبة سجل الإشعارات في قاعدة البيانات

🎉 نظام الإشعارات جاهز للعمل!

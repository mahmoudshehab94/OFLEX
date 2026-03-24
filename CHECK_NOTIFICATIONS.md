# دليل فحص الإشعارات

## الخطوات للتأكد من أن كل شيء يعمل:

### 1. فحص Console المتصفح
1. اضغط `F12` لفتح Developer Tools
2. اذهب إلى تبويب **Console**
3. أعد تحميل الصفحة (Ctrl+R أو Cmd+R)

**الرسائل المتوقعة عند التحميل:**
```
🔧 OneSignal Configuration Check:
  - App ID: 1db29131... ✅
  - Domain: localhost
  - Protocol: https:

🚀 Initializing OneSignal...
✅ OneSignal SDK loaded
⚙️ Configuring OneSignal with App ID: 1db29131...
✅ OneSignal initialized successfully
```

### 2. فحص تحميل السكريبت
1. في Developer Tools، اذهب إلى تبويب **Network** (الشبكة)
2. أعد تحميل الصفحة
3. ابحث عن `OneSignalSDK.page.js`
4. يجب أن يكون:
   - **Status**: 200 ✅
   - **Type**: script
   - **Size**: ~100-200 KB

**إذا رأيت:**
- Status: (blocked) ❌ → تحقق من Ad Blocker
- Status: (failed) ❌ → تحقق من اتصال الإنترنت
- Status: (canceled) ❌ → تحقق من إعدادات المتصفح

### 3. اختبار تفعيل الإشعارات
1. اذهب إلى صفحة الإشعارات في التطبيق
2. اضغط على زر **"تفعيل"**
3. راقب Console - يجب أن ترى:

```
🔔 Starting subscription process...
🚀 OneSignal not initialized, initializing now...
⏳ Waiting for OneSignal to be ready...
✅ OneSignal is ready
📱 Requesting notification permission...
✅ Permission granted, logging in to OneSignal...
🔑 Getting player ID...
✅ Player ID: [some-id]
💾 Saving to database...
✅ Subscription saved successfully!
```

4. يجب أن تظهر نافذة منبثقة من المتصفح تطلب السماح بالإشعارات
5. اضغط **"السماح"** أو **"Allow"**

### 4. المشاكل الشائعة وحلولها

#### المشكلة: OneSignal SDK لا يتم تحميله
**الأعراض:**
```
❌ Failed to load OneSignal SDK
❌ OneSignal not available after 20000 ms
```

**الحلول:**
1. أوقف جميع Ad Blockers (uBlock Origin, AdBlock Plus, إلخ)
2. أوقف Privacy Badger أو Ghostery
3. تأكد من السماح بالسكريبتات من `onesignal.com`
4. جرب متصفحاً آخر (Chrome, Firefox, Edge)
5. تحقق من اتصال الإنترنت

#### المشكلة: الإذن مرفوض
**الأعراض:**
```
❌ Notification permission denied
يرجى السماح بالإشعارات في المتصفح
```

**الحلول:**
1. في Chrome:
   - اضغط على أيقونة القفل/المعلومات في شريط العنوان
   - اذهب إلى "إعدادات الموقع" أو "Site settings"
   - ابحث عن "الإشعارات" وغيره إلى "السماح"
   - أعد تحميل الصفحة

2. في Firefox:
   - اضغط على أيقونة المعلومات في شريط العنوان
   - اذهب إلى "الأذونات" → "الإشعارات"
   - أزل الحظر أو اسمح بالإشعارات

#### المشكلة: خطأ في قاعدة البيانات
**الأعراض:**
```
❌ Database error
خطأ في قاعدة البيانات
```

**الحلول:**
1. تحقق من اتصال الإنترنت
2. تحقق من أن ملف .env يحتوي على:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
3. أعد تحميل الصفحة

### 5. اختبار على Netlify (الموقع الحقيقي)

للحصول على أفضل النتائج:
1. انشر التطبيق على Netlify: https://transoflex.netlify.app
2. جرب الإشعارات هناك
3. OneSignal مُهيأ للعمل على هذا النطاق

### 6. فحص قاعدة البيانات

بعد التفعيل الناجح، يجب أن تجد سجل في:
- جدول: `notification_subscriptions`
- الحقول:
  - `user_account_id`: معرف المستخدم
  - `onesignal_player_id`: معرف الجهاز في OneSignal
  - `enabled`: true
  - `role`: driver/supervisor/admin

## استنتاج

إذا رأيت جميع الرسائل الخضراء ✅ في Console ولم تظهر أي أخطاء ❌، فكل شيء يعمل بشكل صحيح!

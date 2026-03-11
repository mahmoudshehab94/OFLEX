# دليل استكشاف مشاكل الإشعارات وحلها

## 🔴 المشكلة: الإشعارات لا تعمل على أجهزة المستخدمين

---

## 📋 الفحص التشخيصي

### 1. تحقق من إعدادات OneSignal Dashboard

#### الخطوة 1: افتح OneSignal Dashboard
```
https://dashboard.onesignal.com/apps/1db29131-1f03-4188-8b3b-af2ae9c43717
```

#### الخطوة 2: تحقق من Web Push Configuration
```
Settings → Platforms → Web Push
```

**تأكد من:**

1. **Site URL:**
   ```
   ✅ يجب أن يكون: https://transoflex.netlify.app
   ❌ ليس: http://transoflex.netlify.app (بدون https)
   ```

2. **Allowed Origins (إذا وُجد):**
   ```
   ✅ يجب أن يتضمن: https://transoflex.netlify.app
   ```

3. **Default Notification Icon:**
   ```
   ✅ يجب أن يكون محدد (أي رابط صورة صالح)
   مثال: https://transoflex.netlify.app/icon.svg
   ```

4. **Service Worker Configuration:**
   ```
   ✅ يجب أن يكون Enabled
   ```

---

### 2. تحقق من إعدادات المتصفح

#### Chrome/Edge:
```
1. اذهب إلى: chrome://settings/content/notifications
2. تحقق من أن transoflex.netlify.app ليس في قائمة "Not allowed"
3. إذا كان محظوراً، احذفه من القائمة
4. أعد تحميل الموقع واسمح بالإشعارات مرة أخرى
```

#### Firefox:
```
1. اذهب إلى: about:preferences#privacy
2. انزل إلى "Permissions" → "Notifications" → "Settings"
3. ابحث عن transoflex.netlify.app
4. إذا كان محظوراً، احذفه
5. أعد تحميل الموقع
```

#### Safari (macOS):
```
1. Safari → Settings → Websites → Notifications
2. ابحث عن transoflex.netlify.app
3. اضبطه على "Allow"
```

---

### 3. تحقق من Service Worker

افتح Developer Console على الموقع واكتب:

```javascript
// تحقق من تسجيل Service Worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(reg => console.log('SW:', reg.scope));
});

// تحقق من حالة OneSignal
console.log('OneSignal loaded:', !!window.OneSignal);
console.log('OneSignal App ID:', import.meta.env.VITE_ONESIGNAL_APP_ID);

// تحقق من صلاحيات الإشعارات
console.log('Notification permission:', Notification.permission);
```

**النتائج المتوقعة:**
```
✅ Service Workers: 2 (على الأقل واحد)
✅ OneSignal loaded: true
✅ OneSignal App ID: 1db29131-1f03-4188-8b3b-af2ae9c43717
✅ Notification permission: "granted" أو "default"
```

---

### 4. اختبار الإشعارات يدوياً

#### من OneSignal Dashboard:

```
1. اذهب إلى: Messages → New Push
2. Audience: All Subscribed Users
3. عنوان: "اختبار"
4. محتوى: "هذا اختبار للإشعارات"
5. Send Message
```

**إذا لم يصل:**
- المشكلة في إعدادات OneSignal أو المتصفح
- راجع الخطوات السابقة

**إذا وصل:**
- OneSignal يعمل، المشكلة في الكود
- راجع الأقسام التالية

---

## 🔧 الحلول الشائعة

### الحل 1: إعادة تفعيل الإشعارات

اطلب من المستخدم:

```
1. فتح الموقع: https://transoflex.netlify.app
2. تسجيل الدخول
3. الذهاب إلى الملف الشخصي → Benachrichtigungen
4. إذا كانت مفعّلة، اضغط "إيقاف" ثم "تفعيل" مرة أخرى
5. اسمح بالإشعارات في المتصفح
```

---

### الحل 2: مسح بيانات المتصفح

```
1. في المتصفح، اضغط F12 (Developer Tools)
2. اذهب إلى Application (أو Storage)
3. احذف:
   - Cookies لـ transoflex.netlify.app
   - Local Storage
   - Session Storage
   - Service Workers
4. أعد تحميل الصفحة (Ctrl + Shift + R)
5. سجل دخول وفعّل الإشعارات مرة أخرى
```

---

### الحل 3: تحديث Service Worker

إذا كانت المشكلة في Service Worker القديم:

```javascript
// في Console، قم بإلغاء تسجيل جميع Service Workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('All service workers unregistered');
  location.reload();
});
```

---

### الحل 4: فحص قاعدة البيانات

تحقق من أن المستخدم مسجل في قاعدة البيانات:

```sql
-- ابحث عن المستخدم
SELECT
  ns.id,
  ns.user_account_id,
  ns.onesignal_player_id,
  ns.onesignal_external_id,
  ns.enabled,
  ua.username,
  ua.email
FROM notification_subscriptions ns
JOIN user_accounts ua ON ns.user_account_id = ua.id
WHERE ua.username = 'USERNAME_HERE';
```

**النتائج المتوقعة:**
```
✅ enabled: true
✅ onesignal_player_id: UUID صالح (ليس NULL)
✅ onesignal_external_id: user_[UUID]
```

**إذا كانت NULL أو enabled = false:**
```sql
-- أعد تفعيل الاشتراك
UPDATE notification_subscriptions
SET
  enabled = true,
  updated_at = NOW()
WHERE user_account_id = 'USER_ACCOUNT_ID';
```

---

## 🐛 الأخطاء الشائعة وحلولها

### خطأ 1: "Failed to fetch"

**السبب:**
- مشكلة في الاتصال بالإنترنت
- OneSignal API محجوب
- CORS issues

**الحل:**
```javascript
// تحقق من الوصول إلى OneSignal API
fetch('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js')
  .then(r => console.log('OneSignal API accessible:', r.ok))
  .catch(e => console.error('OneSignal API blocked:', e));
```

---

### خطأ 2: "Permission denied"

**السبب:**
- المستخدم رفض الإذن
- المتصفح يحجب الإشعارات
- الموقع في قائمة المحظورات

**الحل:**
1. تحقق من إعدادات المتصفح (راجع القسم 2 أعلاه)
2. اطلب من المستخدم السماح يدوياً
3. جرّب في متصفح آخر

---

### خطأ 3: "OneSignal is not defined"

**السبب:**
- SDK لم يتم تحميله
- تم حظر السكريبت
- Adblocker يحجب OneSignal

**الحل:**
```javascript
// في Console
console.log('OneSignal:', window.OneSignal);
console.log('OneSignalDeferred:', window.OneSignalDeferred);

// إذا كان undefined، حاول تحميله يدوياً:
const script = document.createElement('script');
script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
document.head.appendChild(script);
```

---

### خطأ 4: "Can only be used on: https://transoflex.netlify.app"

**السبب:**
- المستخدم يفتح الموقع على نطاق مختلف
- OneSignal مُهيأ فقط لـ transoflex.netlify.app

**الحل:**
```
✅ تأكد من أن المستخدم يفتح: https://transoflex.netlify.app
❌ ليس: http://transoflex.netlify.app
❌ ليس: www.transoflex.netlify.app
❌ ليس: localhost
```

---

### خطأ 5: "Player ID is null"

**السبب:**
- المستخدم لم يسجل دخول في OneSignal
- OneSignal لم يتم تهيئته بشكل صحيح
- Service Worker لم يتم تسجيله

**الحل:**
```javascript
// تحقق من Player ID
window.OneSignal.User.PushSubscription.id.then(id => {
  console.log('Player ID:', id);
});

// إذا كان null، حاول:
window.OneSignal.login('user_[USER_ACCOUNT_ID]').then(() => {
  console.log('Logged in successfully');
});
```

---

## 📱 اختبار شامل

### الخطوات:

#### 1. على Production (transoflex.netlify.app):

```bash
# افتح Developer Console واكتب:

// خطوة 1: تحقق من البيئة
console.log('URL:', window.location.href);
console.log('HTTPS:', window.location.protocol === 'https:');

// خطوة 2: تحقق من OneSignal
console.log('OneSignal:', !!window.OneSignal);
console.log('App ID:', '1db29131-1f03-4188-8b3b-af2ae9c43717');

// خطوة 3: تحقق من الصلاحيات
console.log('Permission:', Notification.permission);

// خطوة 4: تحقق من Player ID (إذا كان مفعلاً)
if (window.OneSignal) {
  window.OneSignal.User.PushSubscription.id.then(id => {
    console.log('Player ID:', id);
  });
}

// خطوة 5: تحقق من Service Worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
});
```

**النتائج المتوقعة:**
```
✅ URL: https://transoflex.netlify.app/...
✅ HTTPS: true
✅ OneSignal: true
✅ App ID: 1db29131-1f03-4188-8b3b-af2ae9c43717
✅ Permission: "granted"
✅ Player ID: [UUID]
✅ Service Workers: 2+
```

---

#### 2. اختبار التفعيل:

```
1. اذهب إلى الملف الشخصي
2. Benachrichtigungen → تفعيل
3. راقب Console:
   - يجب أن ترى: 🔔 Starting subscription process...
   - يجب أن ترى: ✅ Permission granted
   - يجب أن ترى: ✅ Player ID: [UUID]
   - يجب أن ترى: ✅ Subscription saved successfully!
4. إذا ظهرت أخطاء، انسخها وابحث عنها في هذا الملف
```

---

#### 3. اختبار استلام الإشعارات:

```
أ. من OneSignal Dashboard:
   1. Messages → New Push
   2. Audience: Test Users (أضف Player ID)
   3. عنوان: "اختبار"
   4. محتوى: "هل تستلم هذا؟"
   5. Send Message
   6. يجب أن يصل خلال ثوانٍ

ب. من Edge Function:
   curl -X POST \
     "https://edeneqmxicfwmcbsxrxx.supabase.co/functions/v1/send-daily-reminders" \
     -H "Authorization: Bearer [ANON_KEY]" \
     -H "Content-Type: application/json"
```

---

## 🎯 الأسباب الشائعة لعدم عمل الإشعارات

### 1. المستخدم لم يفعّل الإشعارات
**الحل:** اطلب منه الذهاب إلى الملف الشخصي وتفعيلها

### 2. المستخدم رفض الإذن في المتصفح
**الحل:** امسح إعدادات الموقع في المتصفح وحاول مرة أخرى

### 3. Adblocker يحجب OneSignal
**الحل:** عطّل Adblocker للموقع

### 4. المستخدم في وضع Incognito/Private
**الحل:** استخدم نافذة عادية، ليست خاصة

### 5. Service Worker قديم أو معطوب
**الحل:** امسح Service Workers وأعد التحميل

### 6. المستخدم يفتح HTTP بدلاً من HTTPS
**الحل:** تأكد من فتح https://transoflex.netlify.app

### 7. OneSignal App ID خاطئ أو غير مُهيأ
**الحل:** راجع إعدادات OneSignal Dashboard

### 8. قاعدة البيانات: enabled = false
**الحل:** حدّث الحقل في قاعدة البيانات

### 9. المستخدم في بلد محظور
**الحل:** تحقق من OneSignal supported countries

### 10. المتصفح قديم أو لا يدعم Web Push
**الحل:** حدّث المتصفح أو استخدم متصفحاً حديثاً

---

## 📊 فحص شامل للنظام

### استخدم هذا السكريبت للفحص الكامل:

```javascript
async function diagnoseNotifications() {
  console.log('🔍 Starting Notification Diagnostics...\n');

  // 1. Environment
  console.log('1️⃣ Environment:');
  console.log('   URL:', window.location.href);
  console.log('   Protocol:', window.location.protocol);
  console.log('   Domain:', window.location.hostname);
  console.log('   HTTPS:', window.location.protocol === 'https:');

  // 2. OneSignal
  console.log('\n2️⃣ OneSignal:');
  console.log('   Loaded:', !!window.OneSignal);
  console.log('   App ID:', import.meta.env?.VITE_ONESIGNAL_APP_ID || 'Not found');

  if (window.OneSignal) {
    try {
      const playerId = await window.OneSignal.User.PushSubscription.id;
      console.log('   Player ID:', playerId || 'NULL');

      const permission = await window.OneSignal.Notifications.permission;
      console.log('   Permission:', permission);
    } catch (e) {
      console.log('   Error getting OneSignal info:', e.message);
    }
  }

  // 3. Browser Notification API
  console.log('\n3️⃣ Browser API:');
  console.log('   Notification supported:', 'Notification' in window);
  console.log('   Permission:', Notification?.permission || 'Not supported');
  console.log('   ServiceWorker supported:', 'serviceWorker' in navigator);

  // 4. Service Workers
  console.log('\n4️⃣ Service Workers:');
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    console.log('   Count:', regs.length);
    regs.forEach((reg, i) => {
      console.log(`   SW ${i + 1}:`, reg.scope);
    });
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // 5. Database (requires login)
  console.log('\n5️⃣ Database:');
  console.log('   Check subscription in Supabase using your user_account_id');

  console.log('\n✅ Diagnostics Complete!');
  console.log('\nNext Steps:');
  console.log('1. Check that all values are correct');
  console.log('2. If Player ID is NULL, try enabling notifications');
  console.log('3. If Permission is "denied", reset site permissions');
  console.log('4. If OneSignal not loaded, check for adblockers');
}

// Run it:
diagnoseNotifications();
```

---

## ✅ قائمة التحقق النهائية

قبل أن تطلب المساعدة، تأكد من:

- [ ] الموقع يعمل على HTTPS (https://transoflex.netlify.app)
- [ ] OneSignal Dashboard مُهيأ بشكل صحيح
- [ ] Site URL في OneSignal = https://transoflex.netlify.app
- [ ] المستخدم سجل دخول في التطبيق
- [ ] المستخدم فعّل الإشعارات من الملف الشخصي
- [ ] المستخدم سمح بالإشعارات في المتصفح
- [ ] لا يوجد Adblocker نشط
- [ ] المتصفح محدّث ويدعم Web Push
- [ ] Service Workers مسجلة بشكل صحيح
- [ ] Player ID ليس NULL في قاعدة البيانات
- [ ] enabled = true في قاعدة البيانات
- [ ] ONESIGNAL_APP_ID صحيح في .env
- [ ] Secrets منشورة على Supabase Edge Functions

---

## 📞 الدعم الإضافي

إذا جربت كل شيء ولا يزال لا يعمل:

### 1. جمع المعلومات:

```
- المتصفح والإصدار: [مثال: Chrome 120]
- نظام التشغيل: [مثال: Windows 11]
- الرسالة الخطأ الكاملة: [انسخها من Console]
- نتيجة سكريبت التشخيص: [شغّل السكريبت أعلاه]
- لقطة شاشة من Console
- لقطة شاشة من إعدادات المتصفح
```

### 2. تحقق من OneSignal Status:

```
https://status.onesignal.com/
```

### 3. راجع OneSignal Docs:

```
https://documentation.onesignal.com/docs/troubleshooting-web-push
```

---

**آخر تحديث:** 2026-03-11
**الإصدار:** 1.0
**الحالة:** دليل شامل لاستكشاف مشاكل الإشعارات

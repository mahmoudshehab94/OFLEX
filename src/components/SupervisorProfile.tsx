import { useState, useEffect } from 'react';
import { User, Camera, Lock, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase, hashPassword } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ProfileData {
  display_name: string;
  avatar_url: string | null;
}

const getAvatarUrl = (avatarPath: string | null): string | null => {
  if (!avatarPath || !supabase) return null;

  // If it's already a full URL, return it
  if (avatarPath.startsWith('http')) return avatarPath;

  // Otherwise, generate public URL from path
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(avatarPath);

  return publicUrl;
};

export function SupervisorProfile() {
  const { user, updateUserProfile, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDisplayName(data.username || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'يجب اختيار صورة فقط' });
      return;
    }

    setUploadingImage(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update profile using Edge Function (bypasses RLS)
      const result = await updateUserProfileAPI(user.id, { avatar_url: filePath });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update avatar');
      }

      // Refresh user data from database
      await refreshUser();
      setAvatarUrl(filePath);
      setMessage({ type: 'success', text: 'تم تحديث الصورة الشخصية بنجاح' });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setMessage({ type: 'error', text: 'فشل رفع الصورة' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setMessage(null);

    try {
      // Update profile using Edge Function (bypasses RLS)
      const result = await updateUserProfileAPI(user.id, { username: displayName });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }

      // Refresh user data from database
      await refreshUser();
      setMessage({ type: 'success', text: 'تم تحديث الاسم بنجاح' });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'فشل تحديث الاسم' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'كلمتا المرور غير متطابقتين' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Verify current password by comparing with stored hash
      const { data: account } = await supabase
        .from('user_accounts')
        .select('password_hash')
        .eq('id', user?.id)
        .maybeSingle();

      const currentPasswordHash = await hashPassword(currentPassword);
      if (!account || account.password_hash !== currentPasswordHash) {
        setMessage({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة' });
        setSaving(false);
        return;
      }

      // Hash and update new password using Edge Function
      const newPasswordHash = await hashPassword(newPassword);
      const result = await updateUserProfileAPI(user.id, { password_hash: newPasswordHash });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

      setMessage({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: 'فشل تغيير كلمة المرور' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">الملف الشخصي</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">إدارة معلوماتك الشخصية</p>
          </div>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-4 border-slate-200 dark:border-slate-600">
              {getAvatarUrl(avatarUrl) ? (
                <img src={getAvatarUrl(avatarUrl)!} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-slate-400 dark:text-slate-500" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer transition-colors">
              <Camera className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
          </div>
          {uploadingImage && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">جاري رفع الصورة...</p>
          )}
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              الاسم الكامل
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white"
              placeholder="أدخل اسمك الكامل"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">لا يمكن تغيير اسم المستخدم</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التغييرات</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Lock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">تغيير كلمة المرور</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">تحديث كلمة المرور الخاصة بك</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              كلمة المرور الحالية
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white"
              placeholder="أدخل كلمة المرور الحالية"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white"
              placeholder="أدخل كلمة المرور الجديدة"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white"
              placeholder="أعد إدخال كلمة المرور الجديدة"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white py-2 px-4 rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>جاري التحديث...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>تغيير كلمة المرور</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, validateInviteToken, markInviteAsUsed, hashPassword } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'supervisor' | 'driver';
  driver_id: string | null;
  avatar_url: string | null;
  full_name: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, username: string, inviteToken: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserAvatar: (avatarUrl: string) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionData = localStorage.getItem('userSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);

        const expiresAt = new Date(session.expiresAt);
        if (expiresAt > new Date()) {
          setUser(session.user);
        } else {
          localStorage.removeItem('userSession');
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      localStorage.removeItem('userSession');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Database connection error' };
      }

      const { data: users, error: queryError } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      if (queryError) {
        return { success: false, error: 'Database error occurred' };
      }

      if (!users) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Hash the password to compare with stored hash
      const passwordHash = await hashPassword(password);
      if (users.password_hash !== passwordHash) {
        return { success: false, error: 'Invalid email or password' };
      }

      const userData: User = {
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        driver_id: users.driver_id,
        avatar_url: users.avatar_url,
        full_name: users.full_name,
        phone: users.phone,
      };

      setUser(userData);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      localStorage.setItem('userSession', JSON.stringify({
        user: userData,
        expiresAt: expiresAt.toISOString(),
      }));

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const register = async (email: string, password: string, username: string, inviteToken: string, avatarUrl?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Database connection error' };
      }

      const validation = await validateInviteToken(inviteToken);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid invite' };
      }

      const invite = validation.invite!;

      const { data: existingUser } = await supabase
        .from('user_accounts')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      let driverId = invite.driver_id;

      if (invite.role === 'driver' && !driverId && invite.new_driver_name) {
        const { data: newDriver, error: driverError } = await supabase
          .from('drivers')
          .insert({
            driver_name: invite.new_driver_name || '',
            license_letters: invite.new_driver_license_letters || null,
            license_numbers: invite.new_driver_license_numbers || null,
            is_active: true,
          })
          .select()
          .single();

        if (driverError) {
          return { success: false, error: 'Failed to create driver record' };
        }

        driverId = newDriver.id;
      }

      // Hash the password before storing
      const passwordHash = await hashPassword(password);

      const { data: newUser, error: insertError } = await supabase
        .from('user_accounts')
        .insert({
          email,
          password_hash: passwordHash,
          username,
          role: invite.role,
          driver_id: driverId,
          avatar_url: avatarUrl || null,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        return { success: false, error: 'Failed to create account' };
      }

      await markInviteAsUsed(inviteToken);

      const userData: User = {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        driver_id: newUser.driver_id,
        avatar_url: newUser.avatar_url,
      };

      setUser(userData);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      localStorage.setItem('userSession', JSON.stringify({
        user: userData,
        expiresAt: expiresAt.toISOString(),
      }));

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const updateUserAvatar = (avatarUrl: string) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      avatar_url: avatarUrl
    };

    setUser(updatedUser);

    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.user.avatar_url = avatarUrl;
      localStorage.setItem('userSession', JSON.stringify(session));
    }
  };

  const updateUserProfile = (updates: Partial<User>) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      ...updates
    };

    setUser(updatedUser);

    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.user = updatedUser;
      localStorage.setItem('userSession', JSON.stringify(session));
    }
  };

  const refreshUser = async () => {
    if (!user || !supabase) return;

    try {
      const { data: userData, error } = await supabase
        .from('user_accounts')
        .select('id, email, username, role, driver_id, avatar_url, full_name, phone')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !userData) {
        console.error('Error refreshing user data:', error);
        return;
      }

      const refreshedUser: User = {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        role: userData.role,
        driver_id: userData.driver_id,
        avatar_url: userData.avatar_url,
        full_name: userData.full_name,
        phone: userData.phone,
      };

      setUser(refreshedUser);

      const sessionData = localStorage.getItem('userSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.user = refreshedUser;
        localStorage.setItem('userSession', JSON.stringify(session));
      }

      console.log('User data refreshed from database:', refreshedUser);
    } catch (error) {
      console.error('Exception refreshing user:', error);
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('userSession');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUserAvatar, updateUserProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

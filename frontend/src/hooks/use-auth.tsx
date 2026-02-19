import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Define the possible user roles
type UserRole = 'USER' | 'ADMIN';

// User info from our database
type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  referral_code: string;
};

// Update the context value to include user data
type AuthContextValue = {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  loginGuest: () => Promise<void>;
  register: (input: {
    full_name: string;
    email: string;
    password: string;
    sponsor_referral_code: string;
    position: 'LEFT' | 'RIGHT';
    country?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// API base URL helper
function getApiBaseUrl() {
  const isDevelopment = import.meta.env.DEV;
  if (isDevelopment) {
    return ''; // Use relative URLs in development (Vite proxy will handle it)
  }
  return (import.meta.env.VITE_API_URL || 'https://fox-trading-api-production.up.railway.app').replace(/\/$/, '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Supabase user with our backend database
  const syncUser = useCallback(async (currentSession: Session) => {
    try {
      console.log('Syncing user with backend...');
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAppUser(data.user);
        console.log('User synced successfully:', data.user);
      } else {
        console.error('Failed to sync user with backend');

        if (response.status === 401) {
          console.warn('Sync failed with 401 - Session invalid. Logging out.');
          await supabase.auth.signOut();
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return;
        }

        // If sync fails (non-401), we might want to log them out or retry?
        // For now, just set appUser to null
        setAppUser(null);
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      setAppUser(null);
    }
  }, []);

  // Initialize session from Supabase
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        syncUser(session);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);

        if (session) {
          // Only sync on specific events to avoid redundant calls, 
          // but SIGNED_IN and INITIAL_SESSION are key.
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            await syncUser(session);
          }
        } else {
          setAppUser(null);
        }

        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [syncUser]);

  // Get user role from app user
  const userRole = useMemo(() => {
    return appUser?.role ?? null;
  }, [appUser]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }
    // onAuthStateChange will handle the rest
  }, []);

  // Guest login function
  const loginGuest = useCallback(async () => {
    const baseUrl = getApiBaseUrl();
    // This endpoint returns a session token, we need to set it manually
    const response = await fetch(`${baseUrl}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Guest login failed');
    }

    // Set the session in Supabase client
    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token
    });

    if (error) {
      throw new Error(error.message);
    }
    // onAuthStateChange will handle user sync
  }, []);

  // Register function - NOW USES SUPABASE DIRECTLY
  const register = useCallback(async (input: {
    full_name: string;
    email: string;
    password: string;
    sponsor_referral_code: string;
    position: 'LEFT' | 'RIGHT';
    country?: string;
    phone?: string;
  }) => {
    const { email, password, full_name, sponsor_referral_code, position, country, phone } = input;

    // Sign up with Supabase, passing metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          sponsor_referral_code,
          position,
          country,
          phone
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    // If auto-confirm is enabled in Supabase, data.session will be present.
    // If email confirmation is required, data.session will be null.
    if (data.session) {
      // Auto-logged in (rare for email signup usually, unless disabled confirm)
      // onAuthStateChange will handle sync
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAppUser(null);
    setSession(null);
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh error:', error);
      throw error;
    }
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      appUser,
      isAuthenticated: Boolean(session),
      isLoading,
      userRole,
      login,
      loginGuest,
      register,
      logout,
      refreshSession,
    }),
    [session, user, appUser, isLoading, userRole, login, loginGuest, register, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Helper hook to get access token for API calls
export function useAccessToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

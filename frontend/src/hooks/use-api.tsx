import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { api } from '@/lib/api';

export interface DashboardData {
  user_name: string;
  user_email: string;
  phone?: string;
  country?: string;
  referral_code: string;
  join_date: string;
  total_investment: number;
  investment_wallet_balance: number;
  package_wallet_balance: number;
  investment_unlocked: boolean;
  investment_unlocked_at: string | null;
  total_income: number;
  total_withdrawal: number;
  left_leg_business: number;
  right_leg_business: number;
  total_business: number;
  direct_team: number;
  total_team: number;
  income_breakdown: Array<{
    source: string;
    amount: number;
  }>;
  recent_transactions: Array<{
    id: string;
    amount: number;
    type: string;
    income_source: string;
    description?: string;
    timestamp: string;
  }>;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchDashboard = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const dashboardData = await api<DashboardData>('/api/user/dashboard');
      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (isAuthenticated && !loading) {
        fetchDashboard();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return { data, loading, error, refetch: fetchDashboard };
}

export function useUserProfile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    async function fetchProfile() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const profileData = await api('/api/user/profile');
        setData(profileData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch profile data');
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [isAuthenticated]);

  return { data, loading, error };
}
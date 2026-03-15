import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, Search, ShieldBan, ShieldCheck, Wallet, TrendingUp,
  DollarSign, ArrowDown, Loader2, Calendar
} from 'lucide-react';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  referral_code: string;
  phone: string | null;
  country: string | null;
  is_blocked: boolean;
  investment_unlocked: boolean;
  created_at: string;
  wallet: {
    investment_balance: number;
    package_balance: number;
    income_balance: number;
  };
  total_deposited: number;
  total_profit: number;
  total_income: number;
  total_withdrawal: number;
}

const UserManagement: React.FC = () => {
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', searchQuery],
    queryFn: () => api<{ users: AdminUser[]; total: number }>(
      `/api/admin/users${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`
    ),
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api(`/api/admin/users/${userId}/block`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const handleSearch = () => setSearchQuery(search);

  const users = data?.users || [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-yellow-500" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.total || 0} registered users
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
          />
          <Button onClick={handleSearch} variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      )}

      {/* Users Table */}
      {!isLoading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                <th className="py-3 px-3">User</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-2 text-right">Package</th>
                <th className="py-3 px-2 text-right">Investment</th>
                <th className="py-3 px-2 text-right">Income</th>
                <th className="py-3 px-2 text-right">Deposited</th>
                <th className="py-3 px-2 text-right">Profit</th>
                <th className="py-3 px-2 text-right">Total Income</th>
                <th className="py-3 px-2 text-right">Withdrawn</th>
                <th className="py-3 px-2 text-center">Joined</th>
                <th className="py-3 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className={`border-b border-border/50 hover:bg-muted/20 ${user.is_blocked ? 'opacity-60 bg-red-500/5' : ''}`}>
                  <td className="py-3 px-3">
                    <div className="font-medium truncate max-w-[160px]">{user.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{user.email}</div>
                    <div className="text-xs text-yellow-500">{user.referral_code}</div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {user.is_blocked ? (
                      <Badge variant="destructive" className="text-xs">Blocked</Badge>
                    ) : (
                      <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs">Active</Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs">
                    ${user.wallet.package_balance.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-blue-400">
                    ${user.wallet.investment_balance.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-green-400">
                    ${user.wallet.income_balance.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs">
                    ${user.total_deposited.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-yellow-400">
                    ${user.total_profit.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-cyan-400">
                    ${user.total_income.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-xs text-pink-400">
                    ${user.total_withdrawal.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-center text-xs text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Button
                      size="sm"
                      variant={user.is_blocked ? 'outline' : 'destructive'}
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        if (confirm(`Are you sure you want to ${user.is_blocked ? 'unblock' : 'block'} ${user.full_name}?`)) {
                          blockMutation.mutate(user.id);
                        }
                      }}
                      disabled={blockMutation.isPending}
                    >
                      {user.is_blocked ? (
                        <><ShieldCheck className="h-3 w-3 mr-1" /> Unblock</>
                      ) : (
                        <><ShieldBan className="h-3 w-3 mr-1" /> Block</>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found.
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-yellow-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <DollarSign className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">Total Deposited</div>
              <div className="text-lg font-bold text-yellow-500">
                ${users.reduce((s, u) => s + u.total_deposited, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <TrendingUp className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">Total Profit Paid</div>
              <div className="text-lg font-bold text-blue-500">
                ${users.reduce((s, u) => s + u.total_profit, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <Wallet className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">Total Income</div>
              <div className="text-lg font-bold text-green-500">
                ${users.reduce((s, u) => s + u.total_income, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="border-pink-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <ArrowDown className="h-4 w-4 text-pink-500 mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">Total Withdrawn</div>
              <div className="text-lg font-bold text-pink-500">
                ${users.reduce((s, u) => s + u.total_withdrawal, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import React, { Suspense } from "react";

// Eagerly loaded (needed immediately)
import Index from "./pages/Index";
import AppLayout from "./layouts/AppLayout";

// Lazy-loaded pages (code-split into separate chunks)
const Login = React.lazy(() => import("./pages/Login"));
const Register = React.lazy(() => import("./pages/Register"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Dashboard = React.lazy(() => import("./pages/app/Dashboard"));
const Network = React.lazy(() => import("./pages/app/Network"));
const Referrals = React.lazy(() => import("./pages/app/Referrals"));
const Wallet = React.lazy(() => import("./pages/app/Wallet"));
const Profile = React.lazy(() => import("./pages/app/Profile"));
const Salary = React.lazy(() => import("./pages/app/Salary"));
const Rewards = React.lazy(() => import("./pages/app/Rewards"));
const ChangePassword = React.lazy(() => import("./pages/app/Settings/ChangePassword"));
const AddWithdrawalAddress = React.lazy(() => import("./pages/app/Settings/AddWithdrawalAddress"));
const PaymentsPage = React.lazy(() => import("./pages/app/admin/Payments"));
const CryptoDeposit = React.lazy(() => import("./pages/app/CryptoDeposit"));
const DepositHistory = React.lazy(() => import("./pages/app/DepositHistory"));
const DirectTeam = React.lazy(() => import("./pages/app/DirectTeam"));
const TotalTeam = React.lazy(() => import("./pages/app/TotalTeam"));
const MyIncome = React.lazy(() => import("./pages/app/MyIncome"));
const ReferralIncome = React.lazy(() => import("./pages/app/ReferralIncome"));
const DirectIncome = React.lazy(() => import("./pages/app/DirectIncome"));
const SalaryIncome = React.lazy(() => import("./pages/app/SalaryIncome"));
const WithdrawalIncome = React.lazy(() => import("./pages/app/WithdrawalIncome"));
const WithdrawalInvestment = React.lazy(() => import("./pages/app/WithdrawalInvestment"));
const WithdrawalHistory = React.lazy(() => import("./pages/app/WithdrawalHistory"));
const MyInvestments = React.lazy(() => import("./pages/app/MyInvestments"));
const TeamInvestments = React.lazy(() => import("./pages/app/TeamInvestments"));
const AddFunds = React.lazy(() => import("./pages/app/admin/AddFunds"));
const UserManagement = React.lazy(() => import("./pages/app/admin/UserManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Shared loading spinner for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { userRole } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />

        {/* Public-Only Routes */}
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />

        {/* Protected App Routes */}
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />

          <Route path="deposit/crypto" element={<CryptoDeposit />} />
          <Route path="deposit/history" element={<DepositHistory />} />

          <Route path="investment/my" element={<MyInvestments />} />
          <Route path="investment/team" element={<TeamInvestments />} />

          <Route path="income/my" element={<MyIncome />} />
          <Route path="income/referral" element={<ReferralIncome />} />
          <Route path="income/direct" element={<DirectIncome />} />
          <Route path="income/salary" element={<SalaryIncome />} />

          <Route path="network/direct" element={<DirectTeam />} />
          <Route path="network/total" element={<TotalTeam />} />

          <Route path="withdrawal/income" element={<WithdrawalIncome />} />
          <Route path="withdrawal/investment" element={<WithdrawalInvestment />} />
          <Route path="withdrawal/history" element={<WithdrawalHistory />} />

          <Route path="settings/password" element={<ChangePassword />} />
          <Route path="settings/address" element={<AddWithdrawalAddress />} />

          {/* Legacy routes */}
          <Route path="network" element={<Network />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="profile" element={<Profile />} />
          <Route path="salary" element={<Salary />} />
          <Route path="rewards" element={<Rewards />} />

          {/* Admin-Only Routes */}
          {userRole === 'ADMIN' && (
            <>
              <Route path="admin/payments" element={<PaymentsPage />} />
              <Route path="admin/add-funds" element={<AddFunds />} />
              <Route path="admin/users" element={<UserManagement />} />
            </>
          )}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

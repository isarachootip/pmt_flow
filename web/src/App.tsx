import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleguidePage } from './pages/styleguide';

import { AuthProvider } from './features/auth/auth-context';
import { LoginPage } from './features/auth/login-page';
import { RequireAuth } from './features/auth/require-auth';
import { RequireRole } from './features/auth/require-role';
import { AppLayout } from './features/layout/app-layout';

const DashboardPage = React.lazy(() => import('./pages/dashboard'));
const OrdersPage = React.lazy(() => import('./pages/orders'));
const TicketsPage = React.lazy(() => import('./pages/tickets'));
const ConversionPage = React.lazy(() => import('./pages/conversion'));
const GanttPage = React.lazy(() => import('./pages/gantt'));
const QcPage = React.lazy(() => import('./pages/qc'));
const CompletedPage = React.lazy(() => import('./pages/completed'));
const BlueprintsPage = React.lazy(() => import('./pages/blueprints'));
const BoqPage = React.lazy(() => import('./pages/boq'));
const MaPage = React.lazy(() => import('./pages/ma'));
const ReportsPage = React.lazy(() => import('./pages/reports'));
const UsersPage = React.lazy(() => import('./pages/admin/users'));
const ApiLogsPage = React.lazy(() => import('./pages/admin/api-logs'));
const SettingsPage = React.lazy(() => import('./pages/admin/settings'));
const KmPage = React.lazy(() => import('./pages/km'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageSkeleton = () => (
  <div className="p-8 animate-pulse flex flex-col gap-4 w-full h-full">
    <div className="h-8 w-64 bg-[var(--border-soft)] rounded"></div>
    <div className="h-32 w-full bg-[var(--border-soft)] rounded"></div>
  </div>
);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/v2">
          <Routes>
            <Route path="/styleguide" element={<StyleguidePage />} />
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<RequireRole><Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense></RequireRole>} />
              <Route path="orders" element={<RequireRole><Suspense fallback={<PageSkeleton />}><OrdersPage /></Suspense></RequireRole>} />
              <Route path="tickets" element={<RequireRole><Suspense fallback={<PageSkeleton />}><TicketsPage /></Suspense></RequireRole>} />
              <Route path="conversion" element={<RequireRole><Suspense fallback={<PageSkeleton />}><ConversionPage /></Suspense></RequireRole>} />
              <Route path="gantt" element={<RequireRole><Suspense fallback={<PageSkeleton />}><GanttPage /></Suspense></RequireRole>} />
              <Route path="qc" element={<RequireRole><Suspense fallback={<PageSkeleton />}><QcPage /></Suspense></RequireRole>} />
              <Route path="completed" element={<RequireRole><Suspense fallback={<PageSkeleton />}><CompletedPage /></Suspense></RequireRole>} />
              <Route path="blueprints" element={<RequireRole><Suspense fallback={<PageSkeleton />}><BlueprintsPage /></Suspense></RequireRole>} />
              <Route path="boq" element={<RequireRole><Suspense fallback={<PageSkeleton />}><BoqPage /></Suspense></RequireRole>} />
              <Route path="ma" element={<RequireRole><Suspense fallback={<PageSkeleton />}><MaPage /></Suspense></RequireRole>} />
              <Route path="reports" element={<RequireRole><Suspense fallback={<PageSkeleton />}><ReportsPage /></Suspense></RequireRole>} />
              <Route path="admin/users" element={<RequireRole><Suspense fallback={<PageSkeleton />}><UsersPage /></Suspense></RequireRole>} />
              <Route path="admin/api-logs" element={<RequireRole><Suspense fallback={<PageSkeleton />}><ApiLogsPage /></Suspense></RequireRole>} />
              <Route path="admin/settings" element={<RequireRole><Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense></RequireRole>} />
              <Route path="km" element={<RequireRole><Suspense fallback={<PageSkeleton />}><KmPage /></Suspense></RequireRole>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

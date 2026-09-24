import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleguidePage } from './pages/styleguide';

import { AuthProvider } from './features/auth/auth-context';
import { LoginPage } from './features/auth/login-page';
import { RequireAuth } from './features/auth/require-auth';
import { RequireRole } from './features/auth/require-role';
import { AppLayout } from './features/layout/app-layout';

import DashboardPage from './pages/dashboard';
import OrdersPage from './pages/orders';
import TicketsPage from './pages/tickets';
import ConversionPage from './pages/conversion';
import GanttPage from './pages/gantt';
import QcPage from './pages/qc';
import CompletedPage from './pages/completed';
import BlueprintsPage from './pages/blueprints';
import BoqPage from './pages/boq';
import MaPage from './pages/ma';
import ReportsPage from './pages/reports';
import UsersPage from './pages/admin/users';
import ApiLogsPage from './pages/admin/api-logs';
import SettingsPage from './pages/admin/settings';
import KmPage from './pages/km';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
              <Route path="dashboard" element={<RequireRole><DashboardPage /></RequireRole>} />
              <Route path="orders" element={<RequireRole><OrdersPage /></RequireRole>} />
              <Route path="tickets" element={<RequireRole><TicketsPage /></RequireRole>} />
              <Route path="conversion" element={<RequireRole><ConversionPage /></RequireRole>} />
              <Route path="gantt" element={<RequireRole><GanttPage /></RequireRole>} />
              <Route path="qc" element={<RequireRole><QcPage /></RequireRole>} />
              <Route path="completed" element={<RequireRole><CompletedPage /></RequireRole>} />
              <Route path="blueprints" element={<RequireRole><BlueprintsPage /></RequireRole>} />
              <Route path="boq" element={<RequireRole><BoqPage /></RequireRole>} />
              <Route path="ma" element={<RequireRole><MaPage /></RequireRole>} />
              <Route path="reports" element={<RequireRole><ReportsPage /></RequireRole>} />
              <Route path="admin/users" element={<RequireRole><UsersPage /></RequireRole>} />
              <Route path="admin/api-logs" element={<RequireRole><ApiLogsPage /></RequireRole>} />
              <Route path="admin/settings" element={<RequireRole><SettingsPage /></RequireRole>} />
              <Route path="km" element={<RequireRole><KmPage /></RequireRole>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

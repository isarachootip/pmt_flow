import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { canAccess } from '@/lib/rbac';
import { ForbiddenPage } from './forbidden-page';

export function RequireRole({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <ForbiddenPage />;

  if (!canAccess(user.role, location.pathname)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

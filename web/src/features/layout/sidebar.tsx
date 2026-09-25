import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getMenuForRole } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

export function Sidebar({ className, onClose }: { className?: string, onClose?: () => void }) {
  const { user } = useAuth();
  const location = useLocation();

  const menuGroups = React.useMemo(() => {
    return user ? getMenuForRole(user.role) : [];
  }, [user]);

  const { data: summary } = useQuery({
    queryKey: ['jobs-summary'],
    queryFn: () => api.get<any>('/api/v1/jobs/summary'),
    enabled: !!user,
  });

  const getBadgeContent = (key: string) => {
    if (!summary) return null;
    switch (key) {
      case 'orders': return summary.new_today > 0 ? summary.new_today : null;
      case 'tickets': return summary.pending_plan > 0 ? summary.pending_plan : null;
      case 'gantt': return summary.overdue > 0 ? summary.overdue : null;
      default: return null;
    }
  };

  return (
    <aside className={cn("flex flex-col h-full bg-surface-bg font-sans border-r border-surface-border", className)}>
      <div className="flex items-center justify-between h-[64px] px-6 lg:hidden border-b border-surface-border">
        <span className="font-semibold text-lg text-text">เมนู</span>
        {onClose && (
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {menuGroups.map((group, i) => (
          <div key={i} className="mb-6 px-4">
            <h3 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3">
              {group.group}
            </h3>
            <div className="flex flex-col space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                const badgeCount = getBadgeContent(item.key);

                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-text hover:bg-surface-subtle"
                    )}
                  >
                    {item.step ? (
                      <span className={cn(
                        "w-[20px] h-[20px] flex items-center justify-center rounded-full text-[11px] font-bold shrink-0",
                        isActive ? "bg-primary text-white" : "bg-surface-border text-text-secondary"
                      )}>
                        {item.step}
                      </span>
                    ) : (
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-text-secondary")} />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {badgeCount !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-border text-text text-xs font-semibold">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-surface-border mt-auto">
        <a
          href="/v1"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-subtle transition-all"
          title="สลับไปยัง PMT Flow v1 (เวอร์ชันเดิม)"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-black font-semibold">สลับไป V1 (Legacy)</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold">
            v1.0
          </span>
        </a>
      </div>
    </aside>
  );
}

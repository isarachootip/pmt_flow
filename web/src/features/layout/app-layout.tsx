import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Search, Bell, LogOut, Key } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { Sidebar } from './sidebar';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = React.useState(false);

  const avatarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setIsAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen bg-surface-bg font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-[248px] h-full shrink-0">
        <Sidebar className="w-full" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[248px] bg-white shadow-xl">
            <Sidebar onClose={() => setIsSidebarOpen(false)} className="w-full border-r-0" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[44px] border-b border-surface-border bg-surface-card px-3 md:px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1 text-text-secondary hover:text-text rounded-md hover:bg-surface-subtle"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white font-bold text-xs shadow-xs">
                P
              </div>
              <span className="font-semibold text-sm text-text hidden sm:block tracking-tight">PMT Flow v2</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
            <button className="p-1.5 text-text-secondary hover:text-text rounded-md hover:bg-surface-subtle flex items-center gap-1.5 text-xs">
              <Search className="w-4 h-4" />
              <span className="hidden md:inline-block text-[11px] border border-surface-border px-1 py-0.2 rounded font-mono">⌘K</span>
            </button>
            <button className="p-1.5 text-text-secondary hover:text-text rounded-md hover:bg-surface-subtle relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D12D2D] border border-white"></span>
            </button>
            
            <div className="h-4 w-px bg-surface-border mx-1" />
            
            <div className="relative" ref={avatarRef}>
              <button 
                onClick={() => setIsAvatarOpen(!isAvatarOpen)}
                className="flex items-center gap-2 hover:bg-surface-subtle py-0.5 px-1.5 rounded-md transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-surface-border flex items-center justify-center text-text font-semibold text-xs">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:flex flex-col items-start text-left">
                  <span className="text-xs font-semibold text-text leading-tight">{user?.full_name}</span>
                  <span className="text-[10px] text-text-secondary leading-tight">{user?.role}</span>
                </div>
              </button>
              
              {isAvatarOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-card rounded-md shadow-hover border border-surface-border py-1 z-50">
                  <div className="px-4 py-2 border-b border-surface-border-soft md:hidden">
                    <span className="block text-sm font-medium text-text truncate">{user?.full_name}</span>
                    <span className="block text-xs text-text-secondary mt-0.5">{user?.role}</span>
                  </div>
                  <button className="w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-subtle flex items-center gap-2">
                    <Key className="w-4 h-4 text-text-secondary" />
                    เปลี่ยนรหัสผ่าน
                  </button>
                  <button 
                    onClick={() => logout()}
                    className="w-full text-left px-4 py-2 text-sm text-[#D12D2D] hover:bg-surface-subtle flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 min-h-0 overflow-hidden bg-surface-bg flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { UserRole } from './auth';
import { 
  Inbox, 
  GanttChartSquare, 
  CheckSquare, 
  CheckCircle2, 
  FolderOpen, 
  Calculator, 
  FileSignature, 
  BarChart3, 
  Users, 
  Activity, 
  Settings, 
  BookOpen,
  LucideIcon
} from 'lucide-react';

export interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  roles: UserRole[];
  badge?: string;
  step?: number;
}

export interface MenuGroup {
  group: string;
  items: MenuItem[];
}

export const MENU_STRUCTURE: MenuGroup[] = [
  {
    group: 'Pipeline',
    items: [
      { key: 'orders',    label: 'รับงาน',         icon: Inbox,            path: '/orders',    roles: ['ADMIN', 'AE', 'QC', 'CONTACT_CENTER'], step: 1 },
      { key: 'gantt',     label: 'Project & Gantt', icon: GanttChartSquare, path: '/gantt',     roles: ['ADMIN', 'AE', 'QC', 'CONTACT_CENTER'], step: 2 },
      { key: 'qc',        label: 'QC',              icon: CheckSquare,      path: '/qc',        roles: ['ADMIN', 'AE', 'QC', 'CONTACT_CENTER'], step: 3 },
      { key: 'completed', label: 'ปิดงาน',          icon: CheckCircle2,     path: '/completed', roles: ['ADMIN', 'AE', 'QC', 'CONTACT_CENTER'], step: 4 },
    ]
  },
  {
    group: 'คลังข้อมูล',
    items: [
      { key: 'blueprints', label: 'แบบติดตั้ง',    icon: FolderOpen,    path: '/blueprints', roles: ['ADMIN', 'AE'] },
      { key: 'boq',        label: 'คลัง BOQ กลาง',  icon: Calculator,    path: '/boq',        roles: ['ADMIN', 'AE'] },
      { key: 'ma',         label: 'สัญญา MA',        icon: FileSignature, path: '/ma',         roles: ['ADMIN', 'AE'] }
    ]
  },
  {
    group: 'รายงาน',
    items: [
      { key: 'reports', label: 'รายงาน', icon: BarChart3, path: '/reports', roles: ['ADMIN', 'AE'] }
    ]
  },
  {
    group: 'ระบบ',
    items: [
      { key: 'users',    label: 'ผู้ใช้งาน',      icon: Users,    path: '/admin/users',    roles: ['ADMIN'] },
      { key: 'api-logs', label: 'API Monitor',   icon: Activity, path: '/admin/api-logs', roles: ['ADMIN'] },
      { key: 'settings', label: 'ตั้งค่า',         icon: Settings, path: '/admin/settings', roles: ['ADMIN'] },
      { key: 'km',       label: 'KM คลังความรู้',  icon: BookOpen, path: '/km',             roles: ['ADMIN', 'AE', 'QC', 'CONTACT_CENTER'] }
    ]
  }
];

export function getMenuForRole(role: UserRole): MenuGroup[] {
  return MENU_STRUCTURE.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(role))
  })).filter(group => group.items.length > 0);
}

export function canAccess(role: UserRole, path: string): boolean {
  if (path === '/' || path === '/dashboard' || path === '/orders') return true;
  
  for (const group of MENU_STRUCTURE) {
    for (const item of group.items) {
      if (path.startsWith(item.path)) {
        return item.roles.includes(role);
      }
    }
  }
  return true; 
}

import { useState, useMemo } from 'react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useResetPassword,
  useDeleteUser,
  useLoginLogs,
  User,
  LoginLog,
} from '@/features/admin/api';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Key,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
  UserCheck,
  UserX,
} from 'lucide-react';
import { formatDateTimeDMY } from '@/lib/date';
import { toast } from 'sonner';

type RoleType = 'ADMIN' | 'AE' | 'QC' | 'CONTACT_CENTER';

function renderRoleBadge(role: string) {
  switch (role) {
    case 'ADMIN':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-rose-50 border-rose-300 text-rose-900">
          ADMIN
        </span>
      );
    case 'QC':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-50 border-emerald-300 text-emerald-900">
          QC
        </span>
      );
    case 'AE':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-purple-50 border-purple-300 text-purple-900">
          AE
        </span>
      );
    case 'CONTACT_CENTER':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-50 border-amber-300 text-amber-900">
          CONTACT_CENTER
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-gray-100 border-gray-300 text-black">
          {role}
        </span>
      );
  }
}

export default function AdminUsersPage() {
  const { data: rawUsers, isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: rawLogs, isLoading: logsLoading, refetch: refetchLogs } = useLoginLogs();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();

  const users: User[] = Array.isArray(rawUsers) ? rawUsers : ((rawUsers as any)?.data || []);
  const loginLogs: LoginLog[] = Array.isArray(rawLogs) ? rawLogs : ((rawLogs as any)?.data || []);

  // Navigation tab: users or login audit logs
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');

  // Master-Detail selected user
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    role: 'AE' as RoleType,
    password: '',
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    username: '',
    full_name: '',
    email: '',
    role: 'AE' as RoleType,
    is_active: true,
    password: '',
  });

  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Summary counts
  const roleStats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => u.role === 'ADMIN').length;
    const aeCount = users.filter((u) => u.role === 'AE').length;
    const qcCount = users.filter((u) => u.role === 'QC').length;
    const ccCount = users.filter((u) => u.role === 'CONTACT_CENTER').length;
    const activeCount = users.filter((u) => u.is_active).length;
    const inactiveCount = total - activeCount;

    return { total, adminCount, aeCount, qcCount, ccCount, activeCount, inactiveCount };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u: User) => {
      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && !u.is_active) return false;
      if (statusFilter === 'INACTIVE' && u.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const uname = String(u.username || '').toLowerCase();
        const fname = String(u.full_name || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const role = String(u.role || '').toLowerCase();
        const ucode = String(u.user_code || '').toLowerCase();
        return (
          uname.includes(q) ||
          fname.includes(q) ||
          email.includes(q) ||
          role.includes(q) ||
          ucode.includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Filtered Login Logs
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return loginLogs;
    const q = logSearchQuery.toLowerCase().trim();
    return loginLogs.filter((log) => {
      const uname = String(log.username || '').toLowerCase();
      const ip = String(log.ip_address || '').toLowerCase();
      const reason = String(log.fail_reason || '').toLowerCase();
      return uname.includes(q) || ip.includes(q) || reason.includes(q);
    });
  }, [loginLogs, logSearchQuery]);

  // Logs for selected user
  const userLogs = useMemo(() => {
    if (!selectedUser) return [];
    return loginLogs.filter(
      (log) =>
        log.username?.toLowerCase() === selectedUser.username?.toLowerCase() ||
        String(log.user_id) === String(selectedUser.id)
    ).slice(0, 10);
  }, [loginLogs, selectedUser]);

  // Handler: Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.username.trim() || !createFormData.full_name.trim()) {
      toast.error('กรุณากรอกชื่อผู้ใช้และชื่อ-นามสกุล');
      return;
    }
    if (!createFormData.password || createFormData.password.length < 6) {
      toast.error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    try {
      await createUser.mutateAsync({
        username: createFormData.username.trim(),
        full_name: createFormData.full_name.trim(),
        email: createFormData.email.trim(),
        role: createFormData.role,
        password: createFormData.password,
      });
      toast.success(`สร้างผู้ใช้งาน "${createFormData.username}" สำเร็จ`);
      setIsCreateOpen(false);
      setCreateFormData({
        username: '',
        full_name: '',
        email: '',
        role: 'AE',
        password: '',
      });
      setShowCreatePassword(false);
    } catch (err: any) {
      toast.error(err?.message || 'ไม่สามารถสร้างผู้ใช้งานได้ กรุณาตรวจสอบข้อมูล');
    }
  };

  // Handler: Open Edit User Modal
  const openEditModal = (user: User) => {
    setEditFormData({
      id: String(user.id),
      username: user.username,
      full_name: user.full_name,
      email: user.email || '',
      role: user.role,
      is_active: user.is_active,
      password: '',
    });
    setShowEditPassword(false);
    setIsEditOpen(true);
  };

  // Handler: Save Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.full_name.trim()) {
      toast.error('กรุณากรอกชื่อ-นามสกุล');
      return;
    }
    if (editFormData.password && editFormData.password.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    try {
      const payload: Partial<User> = {
        full_name: editFormData.full_name.trim(),
        email: editFormData.email.trim(),
        role: editFormData.role,
        is_active: editFormData.is_active,
      };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }

      await updateUser.mutateAsync({
        id: editFormData.id,
        payload,
      });

      toast.success('บันทึกการแก้ไขข้อมูลผู้ใช้งานสำเร็จ');
      setIsEditOpen(false);

      // Refresh selected user if it was the one edited
      if (selectedUser && String(selectedUser.id) === String(editFormData.id)) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                full_name: editFormData.full_name.trim(),
                email: editFormData.email.trim(),
                role: editFormData.role,
                is_active: editFormData.is_active,
              }
            : null
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'ไม่สามารถบันทึกการแก้ไขได้');
    }
  };

  // Handler: Toggle Active Status
  const handleToggleActive = async (user: User) => {
    if (user.username === 'admin' || user.user_code === 'USR-001') {
      toast.error('ไม่สามารถระงับการใช้งานบัญชี Admin หลักได้');
      return;
    }

    const actionText = user.is_active ? 'ระงับการใช้งาน' : 'เปิดใช้งาน';
    if (!confirm(`คุณต้องการ${actionText}ผู้ใช้ "${user.username}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      await updateUser.mutateAsync({
        id: String(user.id),
        payload: { is_active: !user.is_active },
      });
      toast.success(`${actionText}ผู้ใช้เรียบร้อยแล้ว`);
      if (selectedUser && String(selectedUser.id) === String(user.id)) {
        setSelectedUser((prev) => (prev ? { ...prev, is_active: !user.is_active } : null));
      }
    } catch (err: any) {
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  // Handler: Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      toast.error('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    try {
      await resetPassword.mutateAsync({
        id: String(resetUser.id),
        new_password: resetPasswordValue,
      });
      toast.success(`รีเซ็ตรหัสผ่านของผู้ใช้ "${resetUser.username}" สำเร็จ (เซสชันเดิมถูกยกเลิกแล้ว)`);
      setResetUser(null);
      setResetPasswordValue('');
      setShowResetPassword(false);
    } catch (err: any) {
      toast.error(err?.message || 'ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
  };

  // Handler: Delete (Deactivate) User
  const handleDelete = async (user: User) => {
    if (user.username === 'admin' || user.user_code === 'USR-001') {
      toast.error('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (Admin) ได้');
      return;
    }

    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการปิดการใช้งาน/ลบผู้ใช้ "${user.username}"?`)) {
      try {
        await deleteUser.mutateAsync(String(user.id));
        toast.success(`ปิดการใช้งานผู้ใช้ "${user.username}" สำเร็จ`);
        if (selectedUser && String(selectedUser.id) === String(user.id)) {
          setSelectedUser(null);
        }
      } catch (err: any) {
        toast.error(err?.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน');
      }
    }
  };

  // DataGrid Columns: Users
  const userColumns: ColumnDef<User>[] = [
    {
      id: 'user_code',
      header: 'รหัสผู้ใช้',
      width: 100,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-black font-semibold">
          {row.user_code || `USR-${row.id}`}
        </span>
      ),
    },
    {
      id: 'username',
      header: 'ชื่อผู้ใช้ (Username)',
      width: 140,
      cell: ({ row }) => <span className="font-bold text-black">{row.username}</span>,
    },
    {
      id: 'full_name',
      header: 'ชื่อ-นามสกุล',
      accessorKey: 'full_name',
      width: 180,
      cell: ({ row }) => <span className="text-black font-medium">{row.full_name}</span>,
    },
    {
      id: 'email',
      header: 'อีเมล',
      accessorKey: 'email',
      width: 190,
      cell: ({ row }) => <span className="text-black text-xs">{row.email || '-'}</span>,
    },
    {
      id: 'role',
      header: 'สิทธิ์การใช้งาน (Role)',
      width: 140,
      cell: ({ row }) => renderRoleBadge(row.role),
    },
    {
      id: 'is_active',
      header: 'สถานะ',
      width: 110,
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
            row.is_active
              ? 'bg-emerald-50 border border-emerald-300 text-black'
              : 'bg-gray-100 border border-gray-300 text-gray-600'
          }`}
        >
          {row.is_active ? 'ใช้งาน (Active)' : 'ปิดใช้งาน'}
        </span>
      ),
    },
    {
      id: 'last_login_at',
      header: 'เข้าสู่ระบบล่าสุด',
      width: 160,
      cell: ({ row }) => (
        <span className="text-black font-medium text-xs">
          {row.last_login_at ? formatDateTimeDMY(row.last_login_at) : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'จัดการ',
      width: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openEditModal(row)}
            title="แก้ไขข้อมูลผู้ใช้"
            className="text-black hover:bg-gray-200 h-7 px-2 text-xs font-semibold"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> แก้ไข
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setResetUser(row);
              setResetPasswordValue('');
              setShowResetPassword(false);
            }}
            title="เปลี่ยนรหัสผ่าน"
            className="text-black hover:bg-gray-200 h-7 px-2 text-xs font-semibold"
          >
            <Key className="w-3.5 h-3.5 mr-1" /> รหัสผ่าน
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row)}
            title="ลบ / ระงับการใช้งาน"
            disabled={row.username === 'admin' || row.user_code === 'USR-001'}
            className="text-rose-700 hover:text-rose-900 hover:bg-rose-50 h-7 px-1.5 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // DataGrid Columns: Login Audit Logs
  const logColumns: ColumnDef<LoginLog>[] = [
    {
      id: 'created_at',
      header: 'วัน-เวลา เข้าสู่ระบบ',
      width: 170,
      cell: ({ row }) => (
        <span className="text-black font-medium text-xs">
          {formatDateTimeDMY(row.created_at, true)}
        </span>
      ),
    },
    {
      id: 'username',
      header: 'ชื่อผู้ใช้งาน (Username)',
      width: 160,
      cell: ({ row }) => <span className="font-bold text-black text-xs">{row.username}</span>,
    },
    {
      id: 'status',
      header: 'ผลการเข้าสู่ระบบ',
      width: 160,
      cell: ({ row }) =>
        row.success ? (
          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> สำเร็จ
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-xs font-bold">
            <XCircle className="w-3.5 h-3.5 text-rose-700" /> ไม่สำเร็จ
          </span>
        ),
    },
    {
      id: 'ip_address',
      header: 'IP Address',
      width: 150,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-black">{row.ip_address || '-'}</span>
      ),
    },
    {
      id: 'fail_reason',
      header: 'หมายเหตุ / รายละเอียดความผิดพลาด',
      width: 250,
      cell: ({ row }) => (
        <span className="text-xs text-black">
          {row.fail_reason ? (
            <span className="text-rose-700 font-medium">{row.fail_reason}</span>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </span>
      ),
    },
  ];

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (activeTab === 'users') refetchUsers();
          else refetchLogs();
          toast.success('รีเฟรชข้อมูลล่าสุดเรียบร้อย');
        }}
        className="h-7 text-xs px-2 text-black hover:bg-gray-100 flex items-center gap-1 font-semibold"
        title="รีเฟรชข้อมูล"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>รีเฟรช</span>
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          setCreateFormData({
            username: '',
            full_name: '',
            email: '',
            role: 'AE',
            password: '',
          });
          setShowCreatePassword(false);
          setIsCreateOpen(true);
        }}
        className="h-7 text-xs px-3 text-black font-bold flex items-center gap-1.5 shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>+ สร้างผู้ใช้งาน</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-2.5 overflow-hidden">
      <PageHeader
        title="จัดการผู้ใช้งานและสิทธิ์ (User Management & RBAC)"
        pageKey="users"
        actions={headerActions}
      />

      {/* Role Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 my-1 shrink-0">
        <button
          type="button"
          onClick={() => setRoleFilter('ALL')}
          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
            roleFilter === 'ALL'
              ? 'bg-blue-50 border-blue-400 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-black font-semibold">
            <span>ทั้งหมด</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-black text-black mt-0.5">{roleStats.total}</div>
          <div className="text-[10px] text-black">
            ใช้งาน: {roleStats.activeCount} | ปิด: {roleStats.inactiveCount}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('ADMIN')}
          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
            roleFilter === 'ADMIN'
              ? 'bg-rose-50 border-rose-400 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-950 font-bold">
            <span>ADMIN</span>
            <Shield className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-black text-black mt-0.5">{roleStats.adminCount}</div>
          <div className="text-[10px] text-black">ผู้ดูแลระบบ</div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('AE')}
          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
            roleFilter === 'AE'
              ? 'bg-purple-50 border-purple-400 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-purple-950 font-bold">
            <span>AE</span>
            <Users className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-lg font-black text-black mt-0.5">{roleStats.aeCount}</div>
          <div className="text-[10px] text-black">บริการลูกค้า</div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('QC')}
          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
            roleFilter === 'QC'
              ? 'bg-emerald-50 border-emerald-400 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-950 font-bold">
            <span>QC</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-black mt-0.5">{roleStats.qcCount}</div>
          <div className="text-[10px] text-black">ตรวจสอบคุณภาพ</div>
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter('CONTACT_CENTER')}
          className={`flex flex-col p-2.5 rounded-lg border text-left transition-all ${
            roleFilter === 'CONTACT_CENTER'
              ? 'bg-amber-50 border-amber-400 shadow-sm'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
            <span>CONTACT</span>
            <Users className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-black text-black mt-0.5">{roleStats.ccCount}</div>
          <div className="text-[10px] text-black">ศูนย์รับเรื่อง</div>
        </button>

        <div className="flex flex-col justify-center p-2.5 rounded-lg border border-gray-200 bg-white text-left">
          <div className="text-xs text-black font-semibold">สถานะบัญชี</div>
          <div className="text-xs text-black mt-1 space-y-0.5">
            <div>
              🟢 ใช้งาน: <span className="font-bold text-black">{roleStats.activeCount}</span>
            </div>
            <div>
              ⚪ ปิดใช้งาน: <span className="font-bold text-black">{roleStats.inactiveCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0 bg-white border border-gray-200 rounded-lg p-2 mb-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-primary text-black shadow-sm'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>รายชื่อผู้ใช้งาน ({filteredUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-primary text-black shadow-sm'
                : 'text-black hover:bg-gray-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>บันทึกการเข้าสู่ระบบ (Audit Logs) ({loginLogs.length})</span>
          </button>
        </div>

        {/* Search & Status Filters */}
        {activeTab === 'users' ? (
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อผู้ใช้, ชื่อ, อีเมล, สิทธิ์..."
                className="pl-8 h-8 text-xs text-black placeholder:text-gray-500 bg-white border-gray-300"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 text-xs text-black font-semibold border border-gray-300 rounded-md px-2 bg-white"
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="ACTIVE">เฉพาะใช้งาน (Active)</option>
              <option value="INACTIVE">เฉพาะปิดใช้งาน (Inactive)</option>
            </select>

            {(searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="h-8 text-xs text-black font-medium hover:bg-gray-100 px-2"
              >
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black" />
              <Input
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อผู้ใช้, IP, เหตุผล..."
                className="pl-8 h-8 text-xs text-black placeholder:text-gray-500 bg-white border-gray-300"
              />
            </div>
            {logSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogSearchQuery('')}
                className="h-8 text-xs text-black font-medium hover:bg-gray-100 px-2"
              >
                ล้างค้นหา
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 mt-1">
        {activeTab === 'users' ? (
          <MasterDetailLayout
            pageKey="users"
            masterContent={
              <DataGrid
                columns={userColumns}
                data={filteredUsers}
                isLoading={usersLoading}
                onRowSelect={(row: User) => setSelectedUser(row)}
                getRowId={(row) => String(row.id || row.username)}
                selectedRowId={selectedUser ? String(selectedUser.id || selectedUser.username) : undefined}
              />
            }
            detailContent={
              selectedUser ? (
                <div className="flex flex-col h-full p-4 bg-card border border-soft rounded-xl shadow-card text-black space-y-4 overflow-y-auto">
                  {/* Detail Header */}
                  <div className="flex justify-between items-start border-b border-soft pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 text-black font-black flex items-center justify-center text-xl border border-primary/40">
                        {selectedUser.full_name?.charAt(0) || selectedUser.username?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-black flex items-center gap-2">
                          <span>{selectedUser.full_name}</span>
                          <span className="text-xs font-mono text-gray-600 font-normal">
                            ({selectedUser.username})
                          </span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-semibold text-black bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                            {selectedUser.user_code || `USR-${selectedUser.id}`}
                          </span>
                          {renderRoleBadge(selectedUser.role)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUser(null)}
                      className="text-black font-semibold hover:bg-gray-100"
                    >
                      ปิด
                    </Button>
                  </div>

                  {/* Quick Action Bar */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-soft rounded-lg">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(selectedUser)}
                      className="text-black text-xs font-bold flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>แก้ไขข้อมูล</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setResetUser(selectedUser);
                        setResetPasswordValue('');
                        setShowResetPassword(false);
                      }}
                      className="text-black text-xs font-bold flex items-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>รีเซ็ตรหัสผ่าน</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleActive(selectedUser)}
                      disabled={selectedUser.username === 'admin' || selectedUser.user_code === 'USR-001'}
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        selectedUser.is_active ? 'text-amber-800' : 'text-emerald-800'
                      }`}
                    >
                      {selectedUser.is_active ? (
                        <>
                          <UserX className="w-3.5 h-3.5 text-amber-700" />
                          <span>ระงับการใช้งาน</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>เปิดใช้งานบัญชี</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Profile Key Information Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-3 bg-white border border-soft rounded-lg">
                      <span className="text-xs text-black font-semibold block">สถานะบัญชี</span>
                      <span className="font-bold text-black text-sm mt-0.5 inline-block">
                        {selectedUser.is_active ? '🟢 ใช้งาน (Active)' : '⚪ ปิดใช้งาน (Inactive)'}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-soft rounded-lg">
                      <span className="text-xs text-black font-semibold block">สิทธิ์ในระบบ (Role)</span>
                      <div className="mt-1">{renderRoleBadge(selectedUser.role)}</div>
                    </div>

                    <div className="p-3 bg-white border border-soft rounded-lg">
                      <span className="text-xs text-black font-semibold block">อีเมล</span>
                      <span className="font-bold text-black text-xs mt-0.5 block truncate">
                        {selectedUser.email || '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-soft rounded-lg">
                      <span className="text-xs text-black font-semibold block">สร้างบัญชีเมื่อ</span>
                      <span className="font-bold text-black text-xs mt-0.5 block">
                        {selectedUser.created_at ? formatDateTimeDMY(selectedUser.created_at) : '-'}
                      </span>
                    </div>

                    <div className="p-3 bg-white border border-soft rounded-lg sm:col-span-2">
                      <span className="text-xs text-black font-semibold block">เข้าสู่ระบบล่าสุด</span>
                      <span className="font-bold text-black text-xs mt-0.5 block">
                        {selectedUser.last_login_at
                          ? formatDateTimeDMY(selectedUser.last_login_at)
                          : 'ยังไม่เคยเข้าสู่ระบบ'}
                      </span>
                    </div>
                  </div>

                  {/* User-specific Login Audit Logs */}
                  <div className="p-3 bg-white border border-soft rounded-lg flex-1 min-h-[160px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-black text-xs flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-black" />
                        <span>ประวัติการเข้าสู่ระบบล่าสุดของผู้ใช้</span>
                      </h4>
                      <span className="text-[11px] text-black">
                        {userLogs.length} รายการล่าสุด
                      </span>
                    </div>

                    {userLogs.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="p-2 font-bold text-black">วัน-เวลา</th>
                              <th className="p-2 font-bold text-black">ผลลัพธ์</th>
                              <th className="p-2 font-bold text-black">IP Address</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {userLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="p-2 text-black font-medium">
                                  {formatDateTimeDMY(log.created_at, true)}
                                </td>
                                <td className="p-2">
                                  {log.success ? (
                                    <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> สำเร็จ
                                    </span>
                                  ) : (
                                    <span className="text-rose-700 font-bold inline-flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> ล้มเหลว ({log.fail_reason || 'ผิดพลาด'})
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 font-mono text-black">{log.ip_address || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-xs text-black py-6">
                        ยังไม่มีประวัติการเข้าสู่ระบบที่บันทึกไว้สำหรับผู้ใช้นี้
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full items-center justify-center p-6 text-center text-black bg-card border border-soft rounded-xl shadow-card">
                  <Users className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="font-bold text-black text-sm">เลือกผู้ใช้งานจากตารางรายการ</p>
                  <p className="text-xs text-black mt-1">
                    เพื่อดูโปรไฟล์, สิทธิ์การใช้งาน, บันทึกการเข้าสู่ระบบ, และจัดการบัญชี
                  </p>
                </div>
              )
            }
          />
        ) : (
          <div className="h-full bg-card border border-soft rounded-xl shadow-card p-2 flex flex-col">
            <DataGrid
              columns={logColumns}
              data={filteredLogs}
              isLoading={logsLoading}
              getRowId={(row) => String(row.id)}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Create User Modal (Restored Password Field + Validation) */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-black flex items-center gap-2">
                  <Plus className="w-5 h-5 text-black" />
                  <span>สร้างผู้ใช้งานใหม่ (Create User)</span>
                </h2>
                <p className="text-xs text-black mt-0.5">
                  กรอกข้อมูลผู้ใช้ กำหนดบทบาท และรหัสผ่านเริ่มต้น
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-500 hover:text-black p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-sm">
              {/* Username */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  ชื่อผู้ใช้ (Username) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น somsak.s หรือ admin2"
                  value={createFormData.username}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, username: e.target.value })
                  }
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมศักดิ์ สุขใจ"
                  value={createFormData.full_name}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, full_name: e.target.value })
                  }
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  อีเมล (Email)
                </label>
                <input
                  type="email"
                  placeholder="somsak@vibepmt.online"
                  value={createFormData.email}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, email: e.target.value })
                  }
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  สิทธิ์การใช้งาน (Role) <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
                  value={createFormData.role}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, role: e.target.value as RoleType })
                  }
                >
                  <option value="AE">AE (เจ้าหน้าที่บริการลูกค้า & โครงการ)</option>
                  <option value="QC">QC (เจ้าหน้าที่ตรวจสอบคุณภาพ & หน้างาน)</option>
                  <option value="CONTACT_CENTER">CONTACT_CENTER (ศูนย์รับเรื่อง & รับแจ้งปัญหา)</option>
                  <option value="ADMIN">ADMIN (ผู้ดูแลระบบสูงสุด)</option>
                </select>
              </div>

              {/* Password Field (The Missing Field) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-black">
                    รหัสผ่าน (Password) <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-black">อย่างน้อย 6 ตัวอักษร</span>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="เช่น Admin@1234 หรือ Pmt#2026"
                    value={createFormData.password}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, password: e.target.value })
                    }
                    className="w-full border border-gray-300 p-2.5 pr-10 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1"
                    title={showCreatePassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showCreatePassword ? (
                      <EyeOff className="w-4 h-4 text-black" />
                    ) : (
                      <Eye className="w-4 h-4 text-black" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-black font-semibold hover:bg-gray-100"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createUser.isPending}
                  className="text-black font-bold shadow-sm"
                >
                  {createUser.isPending ? 'กำลังสร้าง...' : 'บันทึกสร้างผู้ใช้'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Edit User Modal */}
      {/* ========================================================================= */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-black flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-black" />
                  <span>แก้ไขข้อมูลผู้ใช้งาน: {editFormData.username}</span>
                </h2>
                <p className="text-xs text-black mt-0.5">
                  ปรับปรุงชื่อ-นามสกุล อีเมล บทบาท และสถานะการใช้งาน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-gray-500 hover:text-black p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-sm">
              {/* Username (Readonly) */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  disabled
                  value={editFormData.username}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-black bg-gray-100 font-bold cursor-not-allowed"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, full_name: e.target.value })
                  }
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  อีเมล (Email)
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  สิทธิ์การใช้งาน (Role)
                </label>
                <select
                  disabled={editFormData.username === 'admin'}
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, role: e.target.value as RoleType })
                  }
                >
                  <option value="AE">AE (เจ้าหน้าที่บริการลูกค้า & โครงการ)</option>
                  <option value="QC">QC (เจ้าหน้าที่ตรวจสอบคุณภาพ & หน้างาน)</option>
                  <option value="CONTACT_CENTER">CONTACT_CENTER (ศูนย์รับเรื่อง & รับแจ้งปัญหา)</option>
                  <option value="ADMIN">ADMIN (ผู้ดูแลระบบสูงสุด)</option>
                </select>
                {editFormData.username === 'admin' && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    * ไม่สามารถเปลี่ยนสิทธิ์ของบัญชี Admin หลักได้
                  </p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div>
                  <span className="text-xs font-bold text-black block">สถานะการใช้งานบัญชี</span>
                  <span className="text-[11px] text-black">
                    {editFormData.is_active ? 'เปิดให้เข้าใช้งานระบบได้ตามปกติ' : 'ระงับการเข้าสู่ระบบ'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active}
                    disabled={editFormData.username === 'admin'}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, is_active: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Optional New Password */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-black">
                    เปลี่ยนรหัสผ่านใหม่ (ไม่บังคับ)
                  </label>
                  <span className="text-[11px] text-gray-500">เว้นว่างไว้หากไม่ต้องการเปลี่ยน</span>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    placeholder="ใส่รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                    value={editFormData.password}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, password: e.target.value })
                    }
                    className="w-full border border-gray-300 p-2.5 pr-10 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1"
                  >
                    {showEditPassword ? (
                      <EyeOff className="w-4 h-4 text-black" />
                    ) : (
                      <Eye className="w-4 h-4 text-black" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditOpen(false)}
                  className="text-black font-semibold hover:bg-gray-100"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateUser.isPending}
                  className="text-black font-bold shadow-sm"
                >
                  {updateUser.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Reset Password Modal */}
      {/* ========================================================================= */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-black flex items-center gap-2">
                  <Key className="w-5 h-5 text-black" />
                  <span>รีเซ็ตรหัสผ่าน</span>
                </h2>
                <p className="text-xs text-black mt-0.5">
                  สำหรับ: <span className="font-bold text-black">{resetUser.full_name}</span> (
                  {resetUser.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setResetPasswordValue('');
                }}
                className="text-gray-500 hover:text-black p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-black block mb-1">
                  รหัสผ่านใหม่ <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="เช่น Admin@1234 หรือ Pmt#2026"
                    className="w-full border border-gray-300 p-2.5 pr-10 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black p-1"
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4 text-black" />
                    ) : (
                      <Eye className="w-4 h-4 text-black" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-black mt-1">
                  * ต้องมีความยาวอย่างน้อย 6 ตัวอักษร (เซสชันการเข้าสู่ระบบเดิมของผู้ใช้จะถูกยกเลิกทันที)
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setResetUser(null);
                    setResetPasswordValue('');
                  }}
                  className="text-black font-semibold hover:bg-gray-100"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={resetPassword.isPending}
                  className="text-black font-bold shadow-sm"
                >
                  {resetPassword.isPending ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useResetPassword, useDeleteUser, User } from '@/features/admin/api';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Key, Trash2 } from 'lucide-react';
import { formatDateTimeDMY } from '@/lib/date';
import { toast } from 'sonner';

export default function AdminUsersPage() {
  const { data: rawUsers, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();

  const users: User[] = Array.isArray(rawUsers) ? rawUsers : ((rawUsers as any)?.data || []);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<Partial<User>>({ role: 'AE', is_active: true });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.full_name) {
      toast.error('กรุณากรอกชื่อผู้ใช้และชื่อ-นามสกุล');
      return;
    }
    await createUser.mutateAsync(formData);
    setIsCreateOpen(false);
    setFormData({ role: 'AE', is_active: true });
    toast.success('สร้างผู้ใช้งานสำเร็จ');
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updateUser.mutateAsync({ id, payload: { is_active: !currentStatus } });
    toast.success(`เปลี่ยนสถานะผู้ใช้เรียบร้อย`);
  };

  const handleResetPassword = async () => {
    if (resetPasswordId && newPassword) {
      await resetPassword.mutateAsync({ id: resetPasswordId, new_password: newPassword });
      setResetPasswordId(null);
      setNewPassword('');
      toast.success('รีเซ็ตรหัสผ่านสำเร็จ');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('คุณต้องการลบผู้ใช้งานนี้ใช่หรือไม่?')) {
      await deleteUser.mutateAsync(id);
      if (selectedUser?.id === id) setSelectedUser(null);
      toast.success('ลบผู้ใช้งานสำเร็จ');
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u: User) => {
      const uname = String(u.username || '').toLowerCase();
      const fname = String(u.full_name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const role = String(u.role || '').toLowerCase();
      return uname.includes(q) || fname.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [users, searchQuery]);

  const columns: ColumnDef<User>[] = [
    { 
      id: 'username', 
      header: 'ชื่อผู้ใช้ (Username)', 
      width: 150,
      cell: ({ row }) => <span className="font-semibold text-primary">{row.username}</span>
    },
    { id: 'full_name', header: 'ชื่อ-นามสกุล', accessorKey: 'full_name', width: 180 },
    { id: 'email', header: 'อีเมล', accessorKey: 'email', width: 200 },
    { 
      id: 'role', 
      header: 'สิทธิ์การใช้งาน (Role)', 
      width: 140,
      cell: ({ row }) => {
        const role = row.role;
        const color = role === 'ADMIN' ? 'bg-rose-50 border-rose-300 text-rose-900' :
                      role === 'QC' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                      role === 'AE' ? 'bg-purple-50 border-purple-300 text-purple-900' : 'bg-amber-50 border-amber-300 text-amber-900';
        return (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>
            {role}
          </span>
        );
      }
    },
    { 
      id: 'is_active', 
      header: 'สถานะ', 
      width: 110,
      cell: ({ row }) => (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${row.is_active ? 'bg-emerald-50 border border-emerald-300 text-black' : 'bg-gray-100 border border-gray-300 text-gray-500'}`}>
          {row.is_active ? 'ใช้งาน (Active)' : 'ปิดใช้งาน'}
        </span>
      )
    },
    { 
      id: 'last_login_at', 
      header: 'เข้าสู่ระบบล่าสุด', 
      width: 160,
      cell: ({ row }) => <span className="text-black font-medium">{row.last_login_at ? formatDateTimeDMY(row.last_login_at) : '-'}</span>
    },
    { 
      id: 'actions', 
      header: 'จัดการ', 
      width: 180,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setResetPasswordId(row.id)} title="เปลี่ยนรหัสผ่าน" className="text-black text-xs">
            <Key className="w-3.5 h-3.5 mr-1" /> รหัสผ่าน
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)} title="ลบผู้ใช้" className="text-rose-600 hover:text-rose-700 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  const actions = (
    <Button 
      variant="primary" 
      onClick={() => setIsCreateOpen(true)}
      className="text-black font-semibold flex items-center gap-1.5"
    >
      <Plus className="w-4 h-4" />
      <span>+ สร้างผู้ใช้งาน</span>
    </Button>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="จัดการผู้ใช้งาน (User Management)" pageKey="users" actions={actions} />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ชื่อผู้ใช้, ชื่อ-นามสกุล, อีเมล, สิทธิ์)..."
              className="pl-9 h-9 text-sm text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-9 text-xs text-black font-medium hover:bg-gray-100"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredUsers.length}</span> จากทั้งหมด <span className="font-bold text-black">{users.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="users"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredUsers}
              isLoading={isLoading}
              onRowSelect={(row: any) => setSelectedUser(row)}
              getRowId={(row) => String(row.id || row.username)}
              selectedRowId={selectedUser ? String(selectedUser.id || selectedUser.username) : undefined}
            />
          }
          detailContent={
            selectedUser ? (
              <div className="flex flex-col h-full p-6 bg-card border border-soft rounded-xl shadow-card text-black space-y-4 overflow-y-auto">
                <div className="flex justify-between items-start border-b border-soft pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-lg">
                      {selectedUser.full_name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-black">{selectedUser.full_name} ({selectedUser.username})</h3>
                      <p className="text-xs text-black">อีเมล: {selectedUser.email || '-'} | สิทธิ์: {selectedUser.role}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)} className="text-black">ปิด</Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">สถานะบัญชี</span>
                    <span className="font-bold text-black text-sm">{selectedUser.is_active ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน'}</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">สิทธิ์ในระบบ (Role)</span>
                    <span className="font-bold text-black text-sm">{selectedUser.role}</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">เข้าสู่ระบบล่าสุด</span>
                    <span className="font-bold text-black text-sm">{selectedUser.last_login_at ? formatDateTimeDMY(selectedUser.last_login_at) : '-'}</span>
                  </div>
                </div>

                <div className="p-4 bg-white border border-soft rounded-lg space-y-3">
                  <h4 className="font-semibold text-black text-sm">การดำเนินการกับบัญชีผู้ใช้</h4>
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active)}
                      className="text-black text-xs font-semibold"
                    >
                      {selectedUser.is_active ? 'ระงับการใช้งาน' : 'เปิดใช้งานบัญชี'}
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => setResetPasswordId(selectedUser.id)}
                      className="text-black text-xs font-semibold"
                    >
                      รีเซ็ตรหัสผ่าน
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกผู้ใช้งานเพื่อดูข้อมูลโปรไฟล์และประวัติการเข้าใช้งาน
              </div>
            )
          }
        />
      </div>

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-black">สร้างผู้ใช้งานใหม่</h2>
            <form onSubmit={handleCreate} className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-black block mb-1">ชื่อผู้ใช้ (Username)</label>
                <input 
                  required
                  placeholder="เช่น somsak.s" 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                  onChange={e => setFormData({ ...formData, username: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-black block mb-1">ชื่อ-นามสกุล</label>
                <input 
                  required
                  placeholder="เช่น สมศักดิ์ สุขใจ" 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-black block mb-1">อีเมล</label>
                <input 
                  type="email"
                  placeholder="somsak@vibepmt.online" 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-black block mb-1">สิทธิ์ (Role)</label>
                <select 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-black bg-white"
                  value={formData.role || 'AE'}
                  onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                >
                  <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                  <option value="AE">AE (เจ้าหน้าที่บริการลูกค้า)</option>
                  <option value="QC">QC (เจ้าหน้าที่ตรวจสอบคุณภาพ)</option>
                  <option value="CONTACT_CENTER">CONTACT_CENTER (ศูนย์รับเรื่อง)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
                <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-black">ยกเลิก</Button>
                <Button type="submit" variant="primary" className="text-black font-semibold">สร้างผู้ใช้</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-black">รีเซ็ตรหัสผ่าน</h2>
            <div className="space-y-3">
              <input 
                type="password" 
                placeholder="รหัสผ่านใหม่ (เช่น Admin@1234)" 
                className="w-full border border-gray-300 p-2.5 rounded-lg text-black"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
              <Button variant="ghost" onClick={() => { setResetPasswordId(null); setNewPassword(''); }} className="text-black">ยกเลิก</Button>
              <Button variant="primary" onClick={handleResetPassword} className="text-black font-semibold">บันทึกรหัสผ่าน</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

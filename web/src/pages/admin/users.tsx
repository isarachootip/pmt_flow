import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useResetPassword, useDeleteUser, User } from '@/features/admin/api';
import { format } from 'date-fns';

// Minimal mock components if they don't exist in the project yet
// Normally these would be imported from '@/components/ui/...'
// Assuming basic HTML equivalents for now to ensure compilation, or we can use the ones that likely exist.

export default function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [formData, setFormData] = useState<Partial<User>>({});

  const handleCreate = async () => {
    await createUser.mutateAsync(formData);
    setIsCreateOpen(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updateUser.mutateAsync({ id, payload: { is_active: !currentStatus } });
  };

  const handleResetPassword = async () => {
    if (resetPasswordId && newPassword) {
      await resetPassword.mutateAsync({ id: resetPasswordId, new_password: newPassword });
      setResetPasswordId(null);
      setNewPassword('');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await deleteUser.mutateAsync(id);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'var(--primary)';
      case 'AE': return 'purple';
      case 'QC': return 'green';
      case 'CONTACT_CENTER': return 'orange';
      default: return 'gray';
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">จัดการผู้ใช้งาน (Admin)</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md" onClick={() => setIsCreateOpen(true)}>สร้างผู้ใช้</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold">ชื่อผู้ใช้</th>
              <th className="px-4 py-3 font-semibold">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">สิทธิ์</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 font-semibold">เข้าสู่ระบบล่าสุด</th>
              <th className="px-4 py-3 font-semibold text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user: User) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{user.username}</td>
                <td className="px-4 py-3">{user.full_name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border border-gray-200">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getRoleColor(user.role) }}></span>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={user.is_active} onChange={() => handleToggleActive(user.id, user.is_active)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${user.is_active ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </td>
                <td className="px-4 py-3">
                  {user.last_login_at ? format(new Date(user.last_login_at), 'dd/MM/yyyy HH:mm') : '-'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button className="text-blue-600 hover:underline" onClick={() => setResetPasswordId(user.id)}>Reset Pass</button>
                  <button className="text-red-600 hover:underline" onClick={() => handleDelete(user.id)}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] space-y-4">
            <h2 className="text-xl font-bold">สร้างผู้ใช้งานใหม่</h2>
            <div className="space-y-3">
              <input placeholder="Username" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, username: e.target.value })} />
              <input placeholder="Full Name" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              <input placeholder="Email" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, email: e.target.value })} />
              <select className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, role: e.target.value as any })}>
                <option value="">Select Role</option>
                <option value="ADMIN">ADMIN</option>
                <option value="AE">AE</option>
                <option value="QC">QC</option>
                <option value="CONTACT_CENTER">CONTACT CENTER</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <button className="px-4 py-2 border rounded-md" onClick={() => setIsCreateOpen(false)}>ยกเลิก</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={handleCreate}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] space-y-4">
            <h2 className="text-xl font-bold">Reset Password</h2>
            <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border p-2 rounded-md" />
            <div className="flex justify-end space-x-2 pt-4">
              <button className="px-4 py-2 border rounded-md" onClick={() => setResetPasswordId(null)}>ยกเลิก</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={handleResetPassword}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

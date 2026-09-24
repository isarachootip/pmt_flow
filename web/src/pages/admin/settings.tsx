import { useLoginLogs, useWipeTransactions, LoginLog } from '@/features/admin/api';
import { format } from 'date-fns';

export default function AdminSettingsPage() {
  const { data: loginLogs, isLoading } = useLoginLogs();
  const wipeTransactions = useWipeTransactions();

  const handleWipe = async () => {
    if (confirm('คำเตือน: คุณต้องการล้างข้อมูลทดสอบ (Transactions) ทั้งหมดใช่หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้!')) {
      await wipeTransactions.mutateAsync();
      alert('ล้างข้อมูลเรียบร้อยแล้ว');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings (Admin)</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">System Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Version</span><span className="font-medium">v2.0.0</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Uptime</span><span className="font-medium text-green-600">99.9%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">DB Status</span><span className="font-medium text-green-600">Connected</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-600">ระมัดระวังในการใช้งานส่วนนี้ ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้</p>
          <button 
            onClick={handleWipe}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            ล้างข้อมูลทดสอบ
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Login Audit Logs (ล่าสุด 50 รายการ)</h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">เวลา</th>
                <th className="px-4 py-3 font-semibold">ชื่อผู้ใช้</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
                <th className="px-4 py-3 font-semibold">IP Address</th>
                <th className="px-4 py-3 font-semibold">เหตุผล (ถ้ามี)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : loginLogs.slice(0, 50).map((log: LoginLog) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}</td>
                  <td className="px-4 py-3 font-medium">{log.username}</td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="text-green-600 font-semibold">สำเร็จ</span>
                    ) : (
                      <span className="text-red-600 font-semibold">ล้มเหลว</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{log.ip_address || '-'}</td>
                  <td className="px-4 py-3 text-red-500">{log.fail_reason || '-'}</td>
                </tr>
              ))}
              {!isLoading && loginLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    ไม่มีประวัติการเข้าสู่ระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

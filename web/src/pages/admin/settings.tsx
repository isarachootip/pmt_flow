import { useLoginLogs, useWipeTransactions, LoginLog } from '@/features/admin/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  Server, 
  ShieldAlert, 
  Database, 
  KeyRound, 
  CheckCircle2, 
  XCircle, 
  Trash2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const { data: rawLoginLogs, isLoading } = useLoginLogs();
  const wipeTransactions = useWipeTransactions();

  const loginLogs: LoginLog[] = Array.isArray(rawLoginLogs) ? rawLoginLogs : (rawLoginLogs as any)?.data || [];

  const handleWipe = async () => {
    if (window.confirm('⚠️ คำเตือนสำคัญ: คุณต้องการล้างข้อมูลทดสอบ (Transactions) ทั้งหมดใช่หรือไม่?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้!')) {
      try {
        await wipeTransactions.mutateAsync();
        toast.success('ล้างข้อมูลทดสอบในระบบเรียบร้อยแล้ว');
      } catch (err: any) {
        toast.error(err?.message || 'เกิดข้อผิดพลาดในการล้างข้อมูล');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-y-auto space-y-6">
      <PageHeader 
        title="ตั้งค่าระบบและบันทึกความปลอดภัย (Admin Settings)" 
        pageKey="settings" 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Info Card */}
        <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border-soft">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-black">ข้อมูลระบบและเซิร์ฟเวอร์ (System Info)</h2>
              <p className="text-xs text-slate-500">สถานะการทำงานปัจจุบันของระบบ PMT Flow v2</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">System Version</span>
              <span className="font-bold text-black font-mono">v2.0.0 (Unified Standard)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Uptime Status</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> 99.98% Operational
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Database (PostgreSQL)</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Connected (Port 5432)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-600 font-medium">Timezone & Locale</span>
              <span className="font-bold text-black font-mono">Asia/Bangkok (UTC+07:00)</span>
            </div>
          </div>
        </div>

        {/* Danger Zone Card */}
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-700">พื้นที่ความปลอดภัยพิเศษ (Danger Zone)</h2>
              <p className="text-xs text-slate-500">การจัดการข้อมูลระดับฐานข้อมูลส่วนกลาง</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            ปุ่มนี้จะทำการล้างข้อมูลธุรกรรมทดสอบทั้งหมดในระบบ (Orders, BOQ, Gantt Tasks, Daily Logs) โดยจะยังคงบัญชีผู้ใช้ระบบ (sys_users) และ Master Data พื้นฐานไว้
          </p>

          <Button 
            variant="danger" 
            onClick={handleWipe}
            className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>ล้างข้อมูลทดสอบทั้งหมด (Wipe Transactions)</span>
          </Button>
        </div>
      </div>

      {/* Login Audit Logs Section */}
      <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-soft">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-black">ประวัติการเข้าสู่ระบบ (Login Audit Logs)</h2>
              <p className="text-xs text-slate-500">บันทึกความปลอดภัยการเข้าใช้งานระบบ 50 รายการล่าสุด</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-600 font-mono">
            ทั้งหมด {loginLogs.length} บันทึก
          </span>
        </div>

        <div className="overflow-x-auto border border-border-soft rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-border-soft">
              <tr>
                <th className="px-4 py-3 font-bold text-black">วันเวลา (DD/MM/YYYY)</th>
                <th className="px-4 py-3 font-bold text-black">ชื่อผู้ใช้งาน (Username)</th>
                <th className="px-4 py-3 font-bold text-black">ผลการเข้าสู่ระบบ</th>
                <th className="px-4 py-3 font-bold text-black">IP Address</th>
                <th className="px-4 py-3 font-bold text-black">รายละเอียด / หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    กำลังโหลดข้อมูลประวัติความปลอดภัย...
                  </td>
                </tr>
              ) : loginLogs.slice(0, 50).map((log: LoginLog) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-black whitespace-nowrap">
                    {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss น.') : '-'}
                  </td>
                  <td className="px-4 py-3 font-bold text-black font-mono">
                    {log.username}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.success ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> สำเร็จ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3 h-3" /> ล้มเหลว
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {log.ip_address || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium">
                    {log.fail_reason || (log.success ? 'เข้าสู่ระบบสำเร็จ' : '-')}
                  </td>
                </tr>
              ))}
              {!isLoading && loginLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    ไม่มีประวัติการเข้าสู่ระบบในขณะนี้
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

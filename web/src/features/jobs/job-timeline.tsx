import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTimeDMY } from '@/lib/date';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  UserCheck, 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';

export interface AuditLogItem {
  id: number | string;
  timestamp: string;
  user_id?: number | null;
  username?: string;
  full_name?: string;
  role?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  booking_no?: string | null;
  old_values?: any;
  new_values?: any;
  metadata?: any;
}

export function useJobAuditLogs(jobId: number | string) {
  return useQuery({
    queryKey: ['jobAuditLogs', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const res = await api.get<any>(`/api/v1/jobs/${jobId}/audit-logs`);
      return Array.isArray(res) ? res : (res?.data || []);
    },
    enabled: !!jobId,
  });
}

function getActionMeta(action: string) {
  switch (action) {
    case 'RECEIVE_JOB_FROM_INT':
      return {
        label: 'รับงานจากระบบ INT',
        icon: <FileText className="w-4 h-4 text-blue-600" />,
        badgeBg: 'bg-blue-50 border-blue-200 text-black',
      };
    case 'UPDATE_JOB_FROM_INT':
      return {
        label: 'อัปเดตข้อมูลจาก INT (Idempotent)',
        icon: <RefreshCw className="w-4 h-4 text-cyan-600" />,
        badgeBg: 'bg-cyan-50 border-cyan-200 text-black',
      };
    case 'ACCEPT_JOB':
      return {
        label: 'กดรับงานเข้าสู่ระบบ (PMT Accepted)',
        icon: <UserCheck className="w-4 h-4 text-green-600" />,
        badgeBg: 'bg-green-50 border-green-200 text-black',
      };
    case 'CLASSIFY_JOB':
      return {
        label: 'ระบุ / ปรับเปลี่ยนประเภทงาน (Q / R)',
        icon: <ShieldCheck className="w-4 h-4 text-purple-600" />,
        badgeBg: 'bg-purple-50 border-purple-200 text-black',
      };
    case 'CREATE_JOB_MANUAL':
      return {
        label: 'สร้างใบงานใหม่แบบระบุเอง',
        icon: <FileText className="w-4 h-4 text-indigo-600" />,
        badgeBg: 'bg-indigo-50 border-indigo-200 text-black',
      };
    case 'QC_INSPECTION_TASK':
    case 'QC_INSPECTION_JOB':
      return {
        label: 'บันทึกผลการตรวจ QC',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        badgeBg: 'bg-emerald-50 border-emerald-200 text-black',
      };
    case 'TASK_ESCALATED':
      return {
        label: 'ส่งต่อผู้บริหาร (Escalated เกิน 5 รอบ)',
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
        badgeBg: 'bg-red-50 border-red-200 text-black',
      };
    case 'STK_OUTBOUND_SYNC':
      return {
        label: 'ส่งผลการประเมินไปยัง STK',
        icon: <RefreshCw className="w-4 h-4 text-amber-600" />,
        badgeBg: 'bg-amber-50 border-amber-200 text-black',
      };
    default:
      return {
        label: action.replace(/_/g, ' '),
        icon: <Clock className="w-4 h-4 text-gray-700" />,
        badgeBg: 'bg-gray-100 border-gray-300 text-black',
      };
  }
}

export function JobTimeline({ jobId, bookingNo }: { jobId: number | string; bookingNo?: string }) {
  const { data: logs, isLoading, refetch } = useJobAuditLogs(jobId);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  const items: AuditLogItem[] = Array.isArray(logs) ? logs : [];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl p-5 border border-[var(--border-soft)] space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)]">
        <div>
          <h3 className="text-base font-bold text-black flex items-center gap-2">
            <Clock className="w-5 h-5 text-black" />
            <span>ประวัติการดำเนินงาน (Audit Log Timeline)</span>
          </h3>
          <p className="text-xs text-black mt-0.5">
            บันทึก Timestamp รายละเอียดผู้ทำรายการ และการเปลี่ยนสถานะตามเวลาประเทศไทย (Asia/Bangkok){bookingNo ? ` • เลขที่จอง: ${bookingNo}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs font-semibold text-black px-3 py-1.5 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 transition inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>รีเฟรช</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center text-black space-y-2">
          <Clock className="w-10 h-10 text-gray-400 stroke-1" />
          <span className="font-semibold text-sm">ยังไม่มีบันทึก Audit Log สำหรับงานนี้</span>
          <span className="text-xs text-gray-600">
            ระบบจะเริ่มบันทึกอัตโนมัติเมื่อมีการรับงาน เปลี่ยนสถานะ หรือบันทึกข้อมูล
          </span>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-blue-500/40 space-y-6 pt-2 pb-4">
          {items.map((log, idx) => {
            const meta = getActionMeta(log.action);
            const userLabel = log.full_name || log.username || 'System';
            const roleLabel = log.role || 'SYSTEM';

            return (
              <div key={log.id || idx} className="relative group">
                {/* Timeline Pin */}
                <div className="absolute -left-[33px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                </div>

                <div className="bg-[var(--bg-subtle)] border border-[var(--border-soft)] rounded-xl p-4 shadow-2xs hover:shadow-xs transition space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${meta.badgeBg}`}>
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>
                      {log.entity_type && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-200 border border-gray-300 text-black font-semibold">
                          {log.entity_type}:{log.entity_id}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-black flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-black" />
                      <span>{formatDateTimeDMY(log.timestamp)}</span>
                    </span>
                  </div>

                  <div className="text-xs text-black flex items-center gap-2 flex-wrap">
                    <span>ผู้ดำเนินการ:</span>
                    <strong className="text-black">{userLabel}</strong>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-black border border-gray-300">
                      {roleLabel}
                    </span>
                    {log.booking_no && (
                      <span className="text-black font-mono ml-auto">
                        Booking: <strong>{log.booking_no}</strong>
                      </span>
                    )}
                  </div>

                  {/* Changes diff view */}
                  {(log.old_values || log.new_values) && (
                    <div className="p-2.5 bg-white border border-[var(--border-soft)] rounded-lg text-xs space-y-1.5">
                      <span className="font-bold text-black block">ข้อมูลที่มีการเปลี่ยนแปลง:</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {log.old_values && Object.keys(log.old_values).length > 0 && (
                          <div className="bg-red-50/70 border border-red-200 p-2 rounded text-black">
                            <span className="font-semibold text-red-900 block mb-1">ค่าเดิม (Before):</span>
                            <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-black">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && Object.keys(log.new_values).length > 0 && (
                          <div className="bg-green-50/70 border border-green-200 p-2 rounded text-black">
                            <span className="font-semibold text-green-900 block mb-1">ค่าใหม่ (After):</span>
                            <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-black">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata info */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="text-[11px] text-black border-t border-[var(--border-soft)] pt-1.5 flex items-center gap-1.5">
                      <span className="font-semibold">Metadata:</span>
                      <span className="font-mono text-black">
                        {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

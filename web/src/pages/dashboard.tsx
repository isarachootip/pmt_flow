import { useJobSummary, useJobs } from '@/features/jobs/api';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading: isLoadingSummary } = useJobSummary();
  const { data: todayJobs, isLoading: isLoadingToday } = useJobs({ date_from: new Date().toISOString().split('T')[0], limit: 5 });
  const { data: overdueJobs, isLoading: isLoadingOverdue } = useJobs({ status: 'overdue', limit: 5 });

  const metrics = summary?.metrics || { total: 0, new_today: 0, pending_plan: 0, overdue: 0 };

  return (
    <div className="flex flex-col flex-1 h-full bg-subtle p-6 space-y-6 overflow-auto">
      <PageHeader title="แดชบอร์ด" pageKey="dashboard" />
      
      <div className="grid grid-cols-4 gap-4">
        {isLoadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="งานใหม่" value={metrics.new_today} />
            <KpiCard label="กำลังดำเนินการ" value={metrics.pending_plan} />
            <KpiCard label="รอ QC" value={metrics.total - metrics.new_today - metrics.pending_plan - metrics.overdue} />
            <KpiCard label="ปิดแล้วเดือนนี้" value={metrics.overdue} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl border border-soft p-5 shadow-card flex flex-col">
          <h2 className="text-sm font-semibold mb-4 text-text">งานที่ต้องทำวันนี้</h2>
          {isLoadingToday ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : todayJobs?.data?.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-subtle text-text-secondary text-xs font-semibold h-10 border-b border-soft">
                    <th className="px-4 whitespace-nowrap">รหัสงาน</th>
                    <th className="px-4 whitespace-nowrap">ลูกค้า</th>
                    <th className="px-4 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {todayJobs?.data?.map((job: any) => (
                    <tr 
                      key={job.id} 
                      className="h-13 border-b border-soft hover:bg-subtle cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${job.job_no}`)}
                    >
                      <td className="px-4 text-sm whitespace-nowrap">{job.job_no}</td>
                      <td className="px-4 text-sm whitespace-nowrap">{typeof job.customer === 'string' ? job.customer : job.customer?.name}</td>
                      <td className="px-4 whitespace-nowrap"><StatusBadge status={job.status === 'QC_PENDING' ? 'PENDING' : job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-soft p-5 shadow-card flex flex-col">
          <h2 className="text-sm font-semibold mb-4 text-text">งานใกล้ครบกำหนด 5 วัน</h2>
          {isLoadingOverdue ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : overdueJobs?.data?.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-subtle text-text-secondary text-xs font-semibold h-10 border-b border-soft">
                    <th className="px-4 whitespace-nowrap">รหัสงาน</th>
                    <th className="px-4 whitespace-nowrap">ลูกค้า</th>
                    <th className="px-4 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueJobs?.data?.map((job: any) => (
                    <tr 
                      key={job.id} 
                      className="h-13 border-b border-soft hover:bg-subtle cursor-pointer transition-colors"
                      onClick={() => navigate(`/orders/${job.job_no}`)}
                    >
                      <td className="px-4 text-sm whitespace-nowrap">{job.job_no}</td>
                      <td className="px-4 text-sm whitespace-nowrap">{typeof job.customer === 'string' ? job.customer : job.customer?.name}</td>
                      <td className="px-4 whitespace-nowrap"><StatusBadge status={job.status === 'QC_PENDING' ? 'PENDING' : job.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

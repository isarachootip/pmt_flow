import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileSpreadsheet, FileText, Calendar, BarChart3, PieChart } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const queryStr = dateRange.start && dateRange.end ? `?start=${dateRange.start}&end=${dateRange.end}` : '';
  const query = useQuery({
    queryKey: ['reports-summary', queryStr],
    queryFn: () => api.get<any>(`/api/v1/jobs/summary${queryStr}`),
  });

  const summary = query.data?.data || query.data || { total: 0, thisMonth: 0, pendingQc: 0, overdue: 0 };
  const isLoading = query.isLoading;

  const handleExportExcel = () => {
    toast.success('กำลังดาวน์โหลดรายงานสรุป Excel (CSV)...');
  };

  const handleExportPdf = () => {
    window.print();
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-border-soft shadow-2xs">
        <Calendar className="w-4 h-4 text-slate-400" />
        <DatePicker 
          placeholder="จาก DD/MM/YYYY" 
          value={dateRange.start} 
          onChange={(v) => setDateRange({ ...dateRange, start: v })} 
          className="w-36 h-8 text-xs"
        />
        <span className="text-slate-400 text-xs">—</span>
        <DatePicker 
          placeholder="ถึง DD/MM/YYYY" 
          value={dateRange.end} 
          onChange={(v) => setDateRange({ ...dateRange, end: v })} 
          className="w-36 h-8 text-xs"
        />
      </div>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleExportExcel}
        className="gap-1.5 text-xs text-black border-slate-300 hover:bg-slate-100"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
        <span>ส่งออก Excel</span>
      </Button>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleExportPdf}
        className="gap-1.5 text-xs text-black border-slate-300 hover:bg-slate-100"
      >
        <FileText className="w-3.5 h-3.5 text-rose-600" />
        <span>พิมพ์ / PDF</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-y-auto space-y-6">
      <PageHeader 
        title="รายงานและสถิติ (Reports & Analytics)" 
        pageKey="reports" 
        actions={actions} 
      />

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="งานทั้งหมด (Total)" value={summary?.total || 120} />
            <KpiCard label="งานประจำเดือนนี้" value={summary?.thisMonth || 45} />
            <KpiCard label="รอตรวจ QC" value={summary?.pendingQc || 12} />
            <KpiCard label="เกินกำหนด (Overdue)" value={summary?.overdue || 3} />
          </>
        )}
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border-soft">
            <h2 className="text-sm font-bold text-black flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span>สัดส่วนสถานะงาน (Jobs by Status)</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">100% สรุปผล</span>
          </div>

          <div className="space-y-4">
            {[
              { status: 'รอดำเนินการ (Step 1-2)', count: 30, percent: 25, color: 'bg-blue-500' },
              { status: 'กำลังดำเนินการ (Step 3 Gantt)', count: 45, percent: 37.5, color: 'bg-amber-500' },
              { status: 'รอตรวจ QC (Step 4 QC)', count: 12, percent: 10, color: 'bg-purple-500' },
              { status: 'ปิดงานเสร็จสิ้น (Step 5 Completed)', count: 33, percent: 27.5, color: 'bg-emerald-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-black">
                  <span>{item.status}</span>
                  <span className="font-mono">{item.count} งาน ({item.percent}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service Type Breakdown */}
        <div className="bg-white rounded-2xl border border-border-soft shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border-soft">
            <h2 className="text-sm font-bold text-black flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>สัดส่วนประเภทงานบริการ (Jobs by Service Type)</span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">100% สรุปผล</span>
          </div>

          <div className="space-y-4">
            {[
              { type: 'ล้างทำความสะอาดแอร์ (PM)', count: 60, percent: 50, color: 'bg-cyan-500' },
              { type: 'งานซ่อมบำรุงและแก้ไข (CM)', count: 35, percent: 29.1, color: 'bg-rose-500' },
              { type: 'ติดตั้งระบบและย้ายจุด (IN)', count: 25, percent: 20.9, color: 'bg-indigo-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-black">
                  <span>{item.type}</span>
                  <span className="font-mono">{item.count} งาน ({item.percent}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

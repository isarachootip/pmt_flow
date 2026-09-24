import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DatePicker } from '@/components/ui/date-picker';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const queryStr = dateRange.start && dateRange.end ? `?start=${dateRange.start}&end=${dateRange.end}` : '';
  const query = useQuery({
    queryKey: ['reports-summary', queryStr],
    queryFn: () => api.get<any>(`/api/v1/jobs/summary${queryStr}`),
  });

  const summary = query.data?.data || query.data || { total: 0, thisMonth: 0, pendingQc: 0, overdue: 0 };
  const isLoading = query.isLoading;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">รายงาน (Reports)</h1>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 items-center">
            <DatePicker placeholder="จาก DD/MM/YYYY" value={dateRange.start} onChange={(v) => setDateRange({ ...dateRange, start: v })} />
            <span className="self-center text-gray-500">—</span>
            <DatePicker placeholder="ถึง DD/MM/YYYY" value={dateRange.end} onChange={(v) => setDateRange({ ...dateRange, end: v })} />
          </div>
          <button className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 text-sm">Export Excel</button>
          <button className="bg-gray-100 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 text-sm">Export PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'งานทั้งหมด', value: summary?.total || 120, color: 'text-blue-600' },
          { label: 'งานเดือนนี้', value: summary?.thisMonth || 45, color: 'text-green-600' },
          { label: 'รอ QC', value: summary?.pendingQc || 12, color: 'text-orange-600' },
          { label: 'เลยกำหนด', value: summary?.overdue || 3, color: 'text-red-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-gray-500">{stat.label}</span>
            <span className={`text-3xl font-bold mt-2 ${stat.color}`}>{isLoading ? '-' : stat.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Jobs by Status</h2>
          <div className="space-y-4">
            {[
              { status: 'รอดำเนินการ', count: 30, percent: 25, color: 'bg-blue-500' },
              { status: 'กำลังดำเนินการ', count: 45, percent: 37.5, color: 'bg-orange-500' },
              { status: 'รอตรวจ QC', count: 12, percent: 10, color: 'bg-purple-500' },
              { status: 'เสร็จสิ้น', count: 33, percent: 27.5, color: 'bg-green-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.status}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Jobs by Service Type</h2>
          <div className="space-y-4">
            {[
              { type: 'ล้างแอร์ (PM)', count: 60, percent: 50, color: 'bg-cyan-500' },
              { type: 'ซ่อมแอร์ (CM)', count: 35, percent: 29.1, color: 'bg-red-500' },
              { type: 'ติดตั้ง (IN)', count: 25, percent: 20.8, color: 'bg-indigo-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.type}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
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

import { AlertCircle } from 'lucide-react';

export type OrdersStatusFilter = 'all' | 'NEW' | 'SURVEYED' | 'OVERDUE';

export interface StatusCounts {
  all: number;
  newCount: number;
  surveyedCount: number;
  overdueCount: number;
}

export interface OrdersStatusChipsProps {
  statusFilter: OrdersStatusFilter;
  onStatusFilterChange: (status: OrdersStatusFilter) => void;
  counts: StatusCounts;
}

export function OrdersStatusChips({
  statusFilter,
  onStatusFilterChange,
  counts
}: OrdersStatusChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-black mr-0.5">สถานะคิว:</span>

      {/* ทั้งหมด */}
      <button
        type="button"
        onClick={() => onStatusFilterChange('all')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
          statusFilter === 'all'
            ? 'bg-black text-white shadow-xs font-bold'
            : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
        }`}
      >
        <span>ทั้งหมด</span>
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            statusFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'
          }`}
        >
          {counts.all}
        </span>
      </button>

      {/* รอรับงาน (NEW) */}
      <button
        type="button"
        onClick={() => onStatusFilterChange('NEW')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
          statusFilter === 'NEW'
            ? 'bg-amber-600 text-white shadow-xs font-bold border border-amber-700'
            : 'bg-white text-black border border-gray-300 hover:bg-amber-50 hover:border-amber-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${statusFilter === 'NEW' ? 'bg-white' : 'bg-amber-500'}`} />
        <span>รอรับงาน (NEW)</span>
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            statusFilter === 'NEW' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-black'
          }`}
        >
          {counts.newCount}
        </span>
      </button>

      {/* สำรวจ/ร่าง (SURVEYED/BOQ) */}
      <button
        type="button"
        onClick={() => onStatusFilterChange('SURVEYED')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
          statusFilter === 'SURVEYED'
            ? 'bg-indigo-600 text-white shadow-xs font-bold border border-indigo-700'
            : 'bg-white text-black border border-gray-300 hover:bg-indigo-50 hover:border-indigo-300'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${statusFilter === 'SURVEYED' ? 'bg-white' : 'bg-indigo-500'}`} />
        <span>สำรวจ/ร่าง</span>
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            statusFilter === 'SURVEYED' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-black'
          }`}
        >
          {counts.surveyedCount}
        </span>
      </button>

      {/* เกินกำหนด (Overdue Special Red Chip) */}
      <button
        type="button"
        onClick={() => onStatusFilterChange('OVERDUE')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
          statusFilter === 'OVERDUE'
            ? 'bg-rose-600 text-white shadow-xs font-bold border border-rose-700'
            : 'bg-white text-black border border-rose-300 hover:bg-rose-50'
        }`}
      >
        <AlertCircle className={`h-3 w-3 ${statusFilter === 'OVERDUE' ? 'text-white' : 'text-rose-600'}`} />
        <span>เกินกำหนด</span>
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
            statusFilter === 'OVERDUE'
              ? 'bg-rose-800 text-white'
              : 'bg-rose-100 border border-rose-300 text-black'
          }`}
        >
          {counts.overdueCount}
        </span>
      </button>
    </div>
  );
}

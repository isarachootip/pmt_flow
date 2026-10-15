import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

export const COLUMN_STORAGE_KEY = 'pmt_orders_columns_v2';

export interface ColumnOption {
  id: string;
  label: string;
  defaultVisible: boolean;
}

export const AVAILABLE_COLUMNS: ColumnOption[] = [
  { id: 'project_type', label: 'ประเภท (Type)', defaultVisible: true },
  { id: 'job_no', label: 'รหัสงาน & Booking', defaultVisible: true },
  { id: 'customer', label: 'ลูกค้า & เบอร์โทร', defaultVisible: true },
  { id: 'plan_date', label: 'วันนัดหมาย', defaultVisible: true },
  { id: 'status', label: 'สถานะ', defaultVisible: true },
  { id: 'store', label: 'สาขา/Store', defaultVisible: true },
  { id: 'services', label: 'บริการ', defaultVisible: true },
  { id: 'ticket_no', label: 'Ticket', defaultVisible: false },
  { id: 'external_ref_id', label: 'เลขอ้างอิง (Ref ID)', defaultVisible: false },
  { id: 'assigned_tech', label: 'ช่างผู้รับผิดชอบ', defaultVisible: false },
  { id: 'created_at', label: 'วันที่รับเข้าระบบ', defaultVisible: false }
];

export function getInitialVisibleColumns(hasAnyTicket = false): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  AVAILABLE_COLUMNS.forEach(col => {
    if (col.id === 'ticket_no') {
      defaults[col.id] = hasAnyTicket;
    } else {
      defaults[col.id] = col.defaultVisible;
    }
  });

  if (typeof window === 'undefined') return defaults;
  try {
    const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...defaults, ...parsed };
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return defaults;
}

export interface OrdersColumnVisibilityProps {
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (colId: string) => void;
  onResetColumns: () => void;
}

export function OrdersColumnVisibility({
  visibleColumns,
  onToggleColumn,
  onResetColumns
}: OrdersColumnVisibilityProps) {
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold text-black border-gray-300 hover:bg-gray-100 flex items-center gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-black" />
          <span>คอลัมน์</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-gray-100 border border-gray-300 text-black">
            {visibleCount}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white border border-gray-200 shadow-lg p-1">
        <DropdownMenuLabel className="text-xs font-bold text-black px-2 py-1.5">
          แสดง/ซ่อน คอลัมน์
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-200" />
        {AVAILABLE_COLUMNS.map(col => {
          const isChecked = visibleColumns[col.id] !== false;
          return (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={isChecked}
              onCheckedChange={() => onToggleColumn(col.id)}
              className="text-xs text-black font-medium cursor-pointer hover:bg-gray-100 py-1"
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator className="bg-gray-200" />
        <DropdownMenuItem
          onClick={onResetColumns}
          className="text-xs text-black font-semibold cursor-pointer hover:bg-gray-100 flex items-center gap-2 py-1.5 text-black"
        >
          <RotateCcw className="h-3.5 w-3.5 text-black" />
          <span>รีเซ็ตค่าเริ่มต้น</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

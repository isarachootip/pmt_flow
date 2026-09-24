import * as React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export interface ColumnDef<TData> {
  id: string;
  header: string;
  accessorKey?: keyof TData;
  cell?: (props: { row: TData; index: number }) => React.ReactNode;
  width?: number;
}

export interface DataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  selectedRowId?: string;
  onRowSelect?: (row: TData) => void;
  onSort?: (colId: string) => void;
  isLoading?: boolean;
  className?: string;
  getRowId: (row: TData) => string;
}

function DataGrid<TData>({
  data,
  columns,
  selectedRowId,
  onRowSelect,
  onSort,
  isLoading,
  className,
  getRowId
}: DataGridProps<TData>) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-pulse space-y-4 w-full">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-full rounded-md bg-[var(--border-soft)]" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-[var(--border-soft)] rounded-[8px]">
        <Inbox className="mb-4 h-12 w-12 text-[var(--text-neutral)] opacity-20" />
        <h3 className="text-lg font-semibold text-black">ไม่มีข้อมูล</h3>
      </div>
    );
  }

  return (
    <div className={cn('relative h-full overflow-auto border border-[var(--border-soft)] bg-white', className)}>
      <table className="w-full caption-bottom text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[13px] font-semibold text-black shadow-[0_1px_0_var(--border-soft)]">
          <tr className="border-b border-[#E5E6EB]">
            <th className="h-9 w-12 border-r border-[#E5E6EB] px-3 font-semibold text-center sticky left-0 bg-[var(--bg-subtle)] z-20">
              #
            </th>
            {columns.map((col) => (
              <th
                key={col.id}
                onClick={() => onSort?.(col.id)}
                className={cn(
                  'h-9 border-r border-[#E5E6EB] px-3 font-semibold text-left last:border-r-0',
                  onSort && 'cursor-pointer hover:bg-[var(--border-soft)]'
                )}
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-black font-[14px]">
          {data.map((row, idx) => {
            const id = getRowId(row);
            const isSelected = id === selectedRowId;
            return (
              <tr
                key={id}
                onClick={() => onRowSelect?.(row)}
                className={cn(
                  'h-9 border-b border-[var(--border-soft)] transition-colors hover:bg-[var(--bg-subtle)]',
                  isSelected && 'bg-[var(--primary-softer)]',
                  onRowSelect && 'cursor-pointer'
                )}
              >
                <td className={cn(
                  'border-r border-[#E5E6EB] px-3 text-center sticky left-0',
                  isSelected ? 'bg-[var(--primary)] text-white' : 'bg-white'
                )}>
                  {idx + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className="border-r border-[#E5E6EB] px-3 py-1 last:border-r-0"
                  >
                    {col.cell ? col.cell({ row, index: idx }) : (col.accessorKey ? String(row[col.accessorKey]) : null)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataGrid };

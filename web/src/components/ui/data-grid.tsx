import * as React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

export interface ColumnDef<TData> {
  id: string;
  header: string;
  accessorKey?: keyof TData;
  cell?: (props: { row: TData; index: number }) => React.ReactNode;
  width?: number;
  minWidth?: number;
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
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    columns.forEach(col => {
      if (col.width) initial[col.id] = col.width;
    });
    return initial;
  });

  const userResizedRef = React.useRef<Set<string>>(new Set());

  // Keep column widths in sync with column definitions when they change (unless manually resized by user)
  React.useEffect(() => {
    setColumnWidths(prev => {
      const next = { ...prev };
      let hasChanges = false;
      columns.forEach(col => {
        if (col.width && !userResizedRef.current.has(col.id) && next[col.id] !== col.width) {
          next[col.id] = col.width;
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [columns]);

  const totalTableWidth = React.useMemo(() => {
    return columns.reduce((acc, col) => {
      const w = columnWidths[col.id] || col.width || 150;
      return acc + w;
    }, 48); // 48px for '#' column
  }, [columns, columnWidths]);

  const resizingRef = React.useRef<{
    colId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      colId,
      startX: e.clientX,
      startWidth: currentWidth || 150
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + delta);
      userResizedRef.current.add(resizingRef.current.colId);
      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current!.colId]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
    <div className={cn('relative h-full overflow-auto border border-[var(--border-soft)] bg-white select-text', className)}>
      <table 
        className="w-full caption-bottom text-sm border-collapse table-fixed"
        style={{ minWidth: `${totalTableWidth}px` }}
      >
        <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[13px] font-semibold text-black shadow-[0_1px_0_var(--border-soft)]">
          <tr className="border-b border-[#E5E6EB]">
            <th className="h-9 w-12 border-r border-[#E5E6EB] px-2 font-semibold text-center sticky left-0 bg-[var(--bg-subtle)] z-20 shrink-0">
              #
            </th>
            {columns.map((col) => {
              const width = columnWidths[col.id] || col.width || 150;
              return (
                <th
                  key={col.id}
                  className={cn(
                    'relative h-9 border-r border-[#E5E6EB] px-3 font-semibold text-left last:border-r-0 select-none group',
                    onSort && 'cursor-pointer hover:bg-[var(--border-soft)]'
                  )}
                  style={{ width: `${width}px`, minWidth: `${col.minWidth || 50}px` }}
                  onClick={() => onSort?.(col.id)}
                >
                  <div className="truncate pr-2">{col.header}</div>
                  {/* Resizer Handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-30 hover:bg-[var(--primary)] active:bg-[var(--primary)] transition-colors opacity-0 group-hover:opacity-100"
                    onMouseDown={(e) => handleMouseDown(e, col.id, width)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (col.width) {
                        userResizedRef.current.delete(col.id);
                        setColumnWidths(prev => ({
                          ...prev,
                          [col.id]: col.width!
                        }));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title="ลากเพื่อปรับขนาด (ดับเบิลคลิกเพื่อรีเซ็ตขนาดเดิม)"
                  />
                </th>
              );
            })}
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
                  'border-r border-[#E5E6EB] px-2 text-center sticky left-0 shrink-0 font-medium',
                  isSelected ? 'bg-[var(--primary)] text-white' : 'bg-white'
                )}>
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  const width = columnWidths[col.id] || col.width || 150;
                  return (
                    <td
                      key={col.id}
                      className="border-r border-[#E5E6EB] px-3 py-1.5 last:border-r-0 overflow-hidden"
                      style={{ width: `${width}px`, maxWidth: `${width}px` }}
                    >
                      {col.cell ? col.cell({ row, index: idx }) : (col.accessorKey ? <div className="truncate">{String(row[col.accessorKey] ?? '-')}</div> : null)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { DataGrid };

import { ColumnDef } from '@/components/ui/data-grid';
import { Job } from '@/features/jobs/api';
import { formatDMY, format24HourTimeBadge } from '@/lib/date';
import { isQuickJob, isRenovateJob } from '@/features/jobs/job-active-workspace';
import { OrderStatusPill } from './orders-status-pill';
import { getOverdueDays, OverdueBadge } from './orders-overdue';

export function getJobType(job: Job): 'Q' | 'R' | null {
  if (!job) return null;
  if (isQuickJob(job)) return 'Q';
  if (isRenovateJob(job)) return 'R';
  const jNo = String(job.job_no || '').toUpperCase();
  const bNo = String(job.booking_no || (job as any).bookingNo || '').toUpperCase();
  if (jNo.startsWith('JOB-Q') || bNo.startsWith('BK-Q') || jNo.includes('-Q') || bNo.includes('-Q')) return 'Q';
  if (jNo.startsWith('JOB-R') || bNo.startsWith('BK-R') || jNo.includes('-R') || bNo.includes('-R')) return 'R';
  return null;
}

export interface BuildOrdersColumnsProps {
  visibleColumns: Record<string, boolean>;
  selectedJobIds?: Set<string | number>;
  onToggleSelect?: (id: string | number) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
  onQuickAccept?: (job: Job) => void;
  acceptingId?: string | number | null;
}

export function buildOrdersColumns({
  visibleColumns,
  selectedJobIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  onQuickAccept,
  acceptingId
}: BuildOrdersColumnsProps): ColumnDef<Job>[] {
  const allDefs: (ColumnDef<Job> & { id: string })[] = [];

  // 0. Checkbox Selection Column
  if (selectedJobIds && onToggleSelect) {
    allDefs.push({
      id: 'select',
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelectAll?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            title="เลือกทั้งหมด"
          />
        </div>
      ),
      width: 40,
      minWidth: 40,
      sortable: false,
      cell: ({ row }) => {
        const isChecked = selectedJobIds.has(row.id || row.job_no);
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect(row.id || row.job_no);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        );
      }
    });
  }

  allDefs.push(
    // 1. Type (Q / R Icon)
    {
      id: 'project_type',
      header: 'ประเภท',
      width: 65,
      minWidth: 55,
      sortable: false,
      cell: ({ row }) => {
        const jt = getJobType(row);
        if (jt === 'Q') {
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 border border-blue-400 text-black whitespace-nowrap shadow-2xs"
              title="Quick Service"
            >
              Q
            </span>
          );
        }
        if (jt === 'R') {
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 border border-orange-400 text-black whitespace-nowrap shadow-2xs"
              title="Renovate"
            >
              R
            </span>
          );
        }
        const raw = row.project_type || (row as any).job_type || '-';
        return <span className="text-black text-xs font-semibold whitespace-nowrap">{raw}</span>;
      }
    },

    // 2. Job No + Booking
    {
      id: 'job_no',
      header: 'รหัสงาน & Booking',
      width: 175,
      minWidth: 150,
      sortable: true,
      cell: ({ row }) => {
        const booking = row.booking_no || (row as any).bookingNo || (row as any).vfix_no;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-black font-mono text-[13px] whitespace-nowrap">
              {row.job_no}
            </span>
            {booking ? (
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-gray-100 border border-gray-300 text-black font-medium w-fit whitespace-nowrap">
                {booking}
              </span>
            ) : null}
          </div>
        );
      }
    },

    // 3. Customer + Phone
    {
      id: 'customer',
      header: 'ลูกค้า & เบอร์โทร',
      width: 180,
      minWidth: 150,
      sortable: true,
      cell: ({ row }) => {
        const name = typeof row.customer === 'string'
          ? row.customer
          : (row.customer?.name || (row as any).customer_name || '-');
        let phone = '-';
        if (typeof row.customer === 'object' && row.customer?.phone) phone = row.customer.phone;
        else if ((row as any).customer_phone) phone = (row as any).customer_phone;
        else if ((row as any).customerPhone) phone = (row as any).customerPhone;
        else if ((row as any).phone) phone = (row as any).phone;

        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-black font-bold text-sm truncate block max-w-[165px]" title={name}>
              {name}
            </span>
            <span className="text-black font-mono text-xs font-medium whitespace-nowrap">
              {phone}
            </span>
          </div>
        );
      }
    },

    // 4. Appointment Date (+ 24-hr badge + Overdue Badge)
    {
      id: 'plan_date',
      header: 'วันนัดหมาย',
      width: 195,
      minWidth: 170,
      sortable: true,
      cell: ({ row }) => {
        const rawDate = row.plan_date || (row as any).appointment_date || (row as any).survey_date || (row as any).date;
        if (!rawDate) {
          return <span className="text-black font-medium text-sm">-</span>;
        }
        const dateFormatted = formatDMY(rawDate);
        if (dateFormatted === '-') {
          return <span className="text-black font-medium text-sm">-</span>;
        }

        const rawTime = (row.plan_time || (row as any).time_slot || (row as any).schedule_plan?.time_slot || (row as any).survey_time || (row as any).time || (row as any).appointment_time || '') as string;
        const displayTime = format24HourTimeBadge(rawTime, rawDate);
        const overdueDays = getOverdueDays(row);

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-black font-semibold text-sm">{dateFormatted}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 border border-blue-200 text-black">
                {displayTime}
              </span>
            </div>
            {overdueDays ? <OverdueBadge days={overdueDays} /> : null}
          </div>
        );
      }
    },

    // 5. Status Pill
    {
      id: 'status',
      header: 'สถานะ',
      width: 170,
      minWidth: 150,
      sortable: true,
      cell: ({ row }) => {
        const isStkDelivered = (row as any).stk_status === 'DELIVERED' || row.status === 'CLOSED' || row.status === 'CLOSEJOB';
        const st = isStkDelivered ? 'CLOSEJOB' : (row.status === 'QC_PENDING' ? 'PENDING' : row.status);
        const isNew = st === 'NEW' || st === 'WAIT_ACCEPT';
        const isAcceptingThis = acceptingId === (row.id || row.job_no);

        return (
          <div className="flex items-center justify-between gap-1 group/status pr-1">
            <OrderStatusPill status={st} />
            {isNew && onQuickAccept && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAccept(row);
                }}
                disabled={isAcceptingThis}
                className="opacity-0 group-hover/status:opacity-100 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                title="รับงานทันที"
              >
                {isAcceptingThis ? 'กำลังรับ...' : 'รับ'}
              </button>
            )}
          </div>
        );
      }
    },

    // 6. Store
    {
      id: 'store',
      header: 'สาขา/Store',
      width: 140,
      minWidth: 110,
      sortable: true,
      cell: ({ row }) => {
        const branch = row.branch_name || (row as any).store?.name || (row as any).branch || '';
        const code = row.store_code || (row as any).store?.code || row.branch_code || '';
        const display = branch || code || '-';
        return (
          <span className="text-black text-sm font-medium truncate block max-w-[130px]" title={display}>
            {display}
          </span>
        );
      }
    },

    // 7. Services
    {
      id: 'services',
      header: 'บริการ',
      width: 200,
      minWidth: 150,
      sortable: false,
      cell: ({ row }) => {
        const text = Array.isArray(row.services)
          ? row.services.join(', ')
          : (row.services || (row as any).project_sub_type || '-');
        return (
          <div className="truncate max-w-[190px] text-black text-sm font-medium" title={text}>
            {text}
          </div>
        );
      }
    },

    // 8. Ticket
    {
      id: 'ticket_no',
      header: 'Ticket',
      width: 100,
      minWidth: 80,
      sortable: true,
      cell: ({ row }) => {
        const val = row.ticket_no || (row as any).ticketNo || (row as any).ticket_number;
        return val ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-yellow-50 border border-yellow-300 text-black font-bold whitespace-nowrap">
            {val}
          </span>
        ) : (
          <span className="text-black">-</span>
        );
      }
    },

    // 9. External Ref ID
    {
      id: 'external_ref_id',
      header: 'เลขอ้างอิง (Ref ID)',
      width: 140,
      minWidth: 110,
      sortable: true,
      cell: ({ row }) => {
        const val = row.external_ref_id || (row as any).ref_id || (row as any).stk_ref;
        return val ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-semibold whitespace-nowrap">
            {val}
          </span>
        ) : (
          <span className="text-black">-</span>
        );
      }
    },

    // 10. Tech
    {
      id: 'assigned_tech',
      header: 'ช่าง',
      width: 130,
      minWidth: 100,
      sortable: true,
      cell: ({ row }) => {
        const val = row.assigned_tech || '-';
        return <span className="text-black text-sm font-medium truncate block max-w-[120px]" title={val}>{val}</span>;
      }
    },

    // 11. Created At
    {
      id: 'created_at',
      header: 'วันที่เข้าระบบ',
      width: 130,
      minWidth: 105,
      sortable: true,
      cell: ({ row }) => {
        const val = row.created_at ? formatDMY(row.created_at) : '-';
        return <span className="text-black text-sm font-medium whitespace-nowrap">{val}</span>;
      }
    }
  );

  return allDefs.filter(col => visibleColumns[col.id] !== false);
}

export { sortOrdersJobs } from './orders-sort';

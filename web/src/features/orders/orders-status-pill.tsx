import { cn } from '@/lib/utils';

export interface OrderStatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export function getOrderStatusConfig(statusRaw: string | undefined | null): OrderStatusConfig {
  const s = String(statusRaw || '').toUpperCase();
  switch (s) {
    case 'NEW':
      return {
        label: 'รอรับงาน (NEW)',
        badgeClass: 'bg-amber-50 border-amber-300',
        dotClass: 'bg-amber-500'
      };
    case 'PENDING':
    case 'WAIT_ACCEPT':
      return {
        label: 'รอดำเนินการ',
        badgeClass: 'bg-amber-50 border-amber-300',
        dotClass: 'bg-amber-500'
      };
    case 'ACCEPTED':
      return {
        label: 'รับงานแล้ว',
        badgeClass: 'bg-sky-50 border-sky-300',
        dotClass: 'bg-sky-500'
      };
    case 'SURVEYING':
    case 'SURVEYED':
    case 'IN_SURVEY':
      return {
        label: 'สำรวจหน้างาน',
        badgeClass: 'bg-cyan-50 border-cyan-300',
        dotClass: 'bg-cyan-500'
      };
    case 'DESIGNING':
      return {
        label: 'ออกแบบแปลน',
        badgeClass: 'bg-violet-50 border-violet-300',
        dotClass: 'bg-violet-500'
      };
    case 'BOQ':
      return {
        label: 'ทำใบเสนอราคา',
        badgeClass: 'bg-indigo-50 border-indigo-300',
        dotClass: 'bg-indigo-500'
      };
    case 'PLANNED':
      return {
        label: 'วางแผนงาน',
        badgeClass: 'bg-blue-50 border-blue-300',
        dotClass: 'bg-blue-500'
      };
    case 'IN_PROGRESS':
    case 'INSTALLING':
      return {
        label: 'กำลังดำเนินการ',
        badgeClass: 'bg-blue-50 border-blue-300',
        dotClass: 'bg-blue-500'
      };
    case 'WAIT_QC':
    case 'QC_PENDING':
      return {
        label: 'รอตรวจ QC',
        badgeClass: 'bg-orange-50 border-orange-300',
        dotClass: 'bg-orange-500'
      };
    case 'PASSED':
    case 'QC_PASS':
    case 'QC_PASSED':
      return {
        label: 'ผ่าน QC',
        badgeClass: 'bg-emerald-50 border-emerald-300',
        dotClass: 'bg-emerald-500'
      };
    case 'COMPLETED':
    case 'CLOSED':
    case 'CLOSEJOB':
    case 'DELIVERED':
    case 'SENT':
      return {
        label: 'ปิดงานเรียบร้อย',
        badgeClass: 'bg-emerald-50 border-emerald-300',
        dotClass: 'bg-emerald-500'
      };
    case 'REWORK':
      return {
        label: 'ส่งกลับแก้ไข',
        badgeClass: 'bg-purple-50 border-purple-300',
        dotClass: 'bg-purple-500'
      };
    case 'ESCALATED':
      return {
        label: 'ส่งต่อผู้บริหาร',
        badgeClass: 'bg-red-50 border-red-300',
        dotClass: 'bg-red-500'
      };
    case 'REJECTED':
    case 'CANCELLED':
      return {
        label: 'ยกเลิก',
        badgeClass: 'bg-rose-50 border-rose-300',
        dotClass: 'bg-rose-500'
      };
    default:
      return {
        label: statusRaw || '-',
        badgeClass: 'bg-gray-100 border-gray-300',
        dotClass: 'bg-gray-500'
      };
  }
}

export interface OrderStatusPillProps {
  status: string | undefined | null;
  customLabel?: string;
  className?: string;
}

export function OrderStatusPill({ status, customLabel, className }: OrderStatusPillProps) {
  const config = getOrderStatusConfig(status);
  const label = customLabel || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border text-black shadow-2xs whitespace-nowrap',
        config.badgeClass,
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dotClass)} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

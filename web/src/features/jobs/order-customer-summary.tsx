import * as React from 'react';
import { Job } from '@/features/jobs/api';
import { formatDMY, format24HourTimeBadge } from '@/lib/date';
import { 
  User, 
  Phone, 
  MapPin, 
  ExternalLink, 
  Store, 
  Calendar, 
  Clock, 
  Wrench, 
  Package, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderCustomerSummaryProps {
  job: Job;
  className?: string;
  defaultExpanded?: boolean;
}

export function OrderCustomerSummary({
  job,
  className = '',
  defaultExpanded = true
}: OrderCustomerSummaryProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [copiedPhone, setCopiedPhone] = React.useState(false);

  // 1. Customer Name
  const customerName = typeof job.customer === 'string'
    ? job.customer
    : (job.customer?.name || job.customer_name || 'ลูกค้าทั่วไป');

  // 2. Customer Phone
  const rawPhone = (typeof job.customer === 'object' && job.customer?.phone)
    || job.customer_phone
    || job.phone
    || (job as any).customer_data?.phone
    || (job as any).customer_data?.mobile_no
    || (job as any).raw_payload?.customer?.phone
    || '';

  // Format phone nicely: 097-284-0079 or 02-xxx-xxxx
  const formattedPhone = React.useMemo(() => {
    if (!rawPhone) return '';
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length === 9) {
      return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
    }
    return rawPhone;
  }, [rawPhone]);

  // 3. Customer Address & Google Maps
  const address = (typeof job.customer === 'object' && job.customer?.address)
    || job.customer_address
    || job.address
    || (job as any).site_address
    || (job as any).customer_data?.address
    || (job as any).customer_data?.location?.address
    || (job as any).raw_payload?.customer?.address
    || '';

  const googleMapUrl = job.google_map_url
    || (job as any).customer_data?.google_map_url
    || (job as any).customer_data?.location?.google_map_url
    || (job as any).raw_payload?.customer?.google_map_url
    || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');

  // 4. Store / Branch
  const branchName = job.branch_name
    || (job as any).store?.name
    || (job as any).raw_payload?.branch?.name
    || '';
  const storeCode = job.store_code
    || (job as any).store?.code
    || (job as any).raw_payload?.branch?.store_code
    || '';

  // 5. Order items / services from Booking
  const items = React.useMemo(() => {
    if (Array.isArray(job.job_details) && job.job_details.length > 0) {
      return job.job_details;
    }
    const rawItems = (job as any).raw_payload?.jobdetails;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems;
    }
    return [];
  }, [job.job_details, (job as any).raw_payload]);

  const serviceTitle = Array.isArray(job.services)
    ? job.services.join(', ')
    : (job.services || job.project_sub_type || 'บริการติดตั้ง');

  // 6. Remarks / Special Instructions
  const customerRemark = job.special_instructions
    || job.additional_notes
    || (job as any).remarks_data?.comment
    || (job as any).remarks?.note
    || items.find(i => i.remark)?.remark
    || '';

  // 7. Appointment & Schedule (Strictly 24-hr & DD/MM/YYYY)
  const appointmentDate = job.plan_date || (job as any).appointment_date || (job as any).date;
  const rawTime = (job.plan_time || (job as any).time_slot || (job as any).appointment_time || (job as any).time || '') as string;
  const displayTime = format24HourTimeBadge(rawTime, appointmentDate);

  // Copy phone handler
  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rawPhone) return;
    navigator.clipboard.writeText(rawPhone.replace(/\D/g, ''));
    setCopiedPhone(true);
    toast.success(`คัดลอกเบอร์โทร ${formattedPhone || rawPhone} เรียบร้อย`);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className={`border-b border-gray-200 bg-blue-50/40 text-black transition-all ${className}`}>
      {/* Summary Header Bar (Clickable to collapse/expand) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-blue-50/70 transition-colors select-none"
        title={isExpanded ? 'คลิกเพื่อย่อข้อมูลออเดอร์' : 'คลิกเพื่อขยายดูข้อมูลออเดอร์และสถานที่ติดตั้ง'}
      >
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-black bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200">
            <Package className="w-3.5 h-3.5 text-blue-700" />
            <span>ข้อมูลคำสั่งซื้อ & สถานที่ติดตั้ง (Order Details)</span>
          </div>

          <span className="text-xs font-semibold text-black flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-gray-700" />
            {customerName}
          </span>

          {formattedPhone && (
            <span className="text-xs font-mono font-medium text-black bg-white px-2 py-0.5 rounded border border-gray-200 flex items-center gap-1">
              <Phone className="w-3 h-3 text-green-700" />
              {formattedPhone}
            </span>
          )}

          {address && (
            <span className="text-xs text-black max-w-[280px] sm:max-w-[360px] truncate flex items-center gap-1" title={address}>
              <MapPin className="w-3 h-3 text-red-600 shrink-0" />
              <span className="truncate">{address}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {branchName && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-black bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <Store className="w-3 h-3 text-amber-700" />
              {branchName} {storeCode ? `(${storeCode})` : ''}
            </span>
          )}

          <button 
            type="button"
            className="p-1 rounded hover:bg-blue-100 text-black font-semibold text-xs flex items-center gap-1 transition-colors"
            aria-label={isExpanded ? 'ย่อข้อมูล' : 'ขยายข้อมูล'}
          >
            <span className="text-[11px] text-black font-medium hidden sm:inline">
              {isExpanded ? 'ย่อ' : 'ดูรายละเอียด'}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4 text-black" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Grid */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-blue-100 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-black animate-fadeIn">
          {/* 1. Customer & Contact */}
          <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-200 flex flex-col justify-between space-y-1.5">
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-black uppercase tracking-wider mb-1">
                <User className="w-3.5 h-3.5 text-blue-700" />
                <span>ข้อมูลลูกค้า</span>
              </div>
              <div className="font-bold text-sm text-black">{customerName}</div>
            </div>

            <div className="pt-1 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-[11px]">เบอร์โทรติดต่อ:</span>
                {rawPhone ? (
                  <div className="flex items-center gap-1">
                    <a 
                      href={`tel:${rawPhone.replace(/\D/g, '')}`}
                      className="font-mono font-bold text-black hover:text-blue-700 hover:underline flex items-center gap-1"
                      title="คลิกเพื่อโทรออก"
                    >
                      <Phone className="w-3 h-3 text-green-700" />
                      {formattedPhone || rawPhone}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="p-1 hover:bg-gray-200 rounded text-black transition-colors"
                      title="คัดลอกเบอร์โทร"
                    >
                      {copiedPhone ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-700" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-500 font-medium">-</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Site Location & Address */}
          <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-200 flex flex-col justify-between space-y-1.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-black uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-red-600" />
                  <span>สถานที่ติดตั้งหน้างาน</span>
                </div>
                {googleMapUrl && (
                  <a
                    href={googleMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                    title="เปิดตำแหน่งใน Google Maps"
                  >
                    <span>แผนที่</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <p className="text-black font-medium leading-relaxed line-clamp-3" title={address || 'ไม่มีข้อมูลที่อยู่'}>
                {address || 'ไม่มีข้อมูลสถานที่ติดตั้ง'}
              </p>
            </div>

            {googleMapUrl && (
              <div className="pt-1 border-t border-gray-200">
                <a
                  href={googleMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-700 hover:underline flex items-center gap-1 font-medium"
                >
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>เปิดนำทางด้วย Google Maps</span>
                </a>
              </div>
            )}
          </div>

          {/* 3. Order Products / Services & Store */}
          <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-200 flex flex-col justify-between space-y-1.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-black uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-amber-700" />
                  <span>สินค้า / บริการในคำสั่งซื้อ</span>
                </div>
                {branchName && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-black truncate max-w-[120px]" title={`${branchName} ${storeCode ? `(${storeCode})` : ''}`}>
                    {branchName}
                  </span>
                )}
              </div>

              {items.length > 0 ? (
                <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                  {items.map((item: any, idx: number) => {
                    const title = item.installation_detail || item.job_type || item.product_name || `รายการที่ ${idx + 1}`;
                    const qty = item.product_quantity || 1;
                    return (
                      <div key={idx} className="flex items-start justify-between gap-1 text-black font-medium">
                        <span className="line-clamp-2 leading-tight flex-1" title={title}>
                          • {title}
                        </span>
                        <span className="font-mono font-bold text-black shrink-0">
                          x{qty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-black font-medium line-clamp-2 leading-tight" title={serviceTitle}>
                  {serviceTitle}
                </div>
              )}
            </div>

            {customerRemark && (
              <div className="pt-1 border-t border-gray-200 text-[11px] text-black">
                <span className="font-bold text-gray-700">หมายเหตุ: </span>
                <span className="text-gray-900 italic line-clamp-1" title={customerRemark}>
                  "{customerRemark}"
                </span>
              </div>
            )}
          </div>

          {/* 4. Schedule & Assigned Technician */}
          <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-200 flex flex-col justify-between space-y-1.5">
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-black uppercase tracking-wider mb-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                <span>วันนัดหมาย & ทีมช่าง</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-black font-semibold text-xs">
                    {appointmentDate ? formatDMY(appointmentDate) : '-'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 border border-blue-200 text-black">
                    <Clock className="w-2.5 h-2.5 mr-1 text-blue-700" />
                    {displayTime}
                  </span>
                </div>

                <div className="text-xs text-black font-medium flex items-center gap-1 pt-0.5">
                  <Wrench className="w-3 h-3 text-gray-700 shrink-0" />
                  <span className="truncate" title={job.assigned_tech || 'รอระบุทีมช่าง'}>
                    {job.assigned_tech || 'รอระบุทีมช่าง'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-gray-200 flex items-center justify-between text-[11px]">
              <span className="text-gray-600">ประเภท:</span>
              <span className="font-bold px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-black">
                {job.project_type || (job as any).job_type || 'Quick'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import * as React from 'react';
import { Job } from '@/features/jobs/api';
import { 
  ExternalLink, 
  Copy, 
  Check 
} from 'lucide-react';
import { toast } from 'sonner';

export interface OrderCustomerSummaryProps {
  job: Job;
  className?: string;
  defaultExpanded?: boolean;
}

export function OrderCustomerSummary({
  job,
  className = '',
}: OrderCustomerSummaryProps) {
  const [copiedPhone, setCopiedPhone] = React.useState(false);

  // Customer Name
  const customerName = (typeof job.customer === 'string' && job.customer.trim())
    ? job.customer.trim()
    : ((typeof job.customer === 'object' && job.customer?.name)
      || job.customer_name
      || (job as any).customer_data?.name
      || (job as any).customer_data?.customer_name
      || (job as any).raw_payload?.customer?.name
      || (job as any).raw_payload?.customer?.customer_name
      || 'ลูกค้าทั่วไป');

  // Customer Phone
  const rawPhone = (typeof job.customer === 'object' && job.customer?.phone)
    || job.customer_phone
    || job.phone
    || (job as any).customer_data?.phone
    || (job as any).customer_data?.mobile_no
    || (job as any).raw_payload?.customer?.phone
    || '';

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

  // Customer Address & Google Maps
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

  // Store / Branch
  const branchName = job.branch_name
    || (job as any).store?.name
    || (job as any).raw_payload?.branch?.name
    || '';
  const storeCode = job.store_code
    || (job as any).store?.code
    || (job as any).raw_payload?.branch?.store_code
    || '';

  // Order items / services
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

  const itemsSummaryText = React.useMemo(() => {
    if (items.length > 0) {
      return items.map((i: any, idx: number) => {
        const title = i.installation_detail || i.job_type || i.product_name || `รายการ ${idx + 1}`;
        const qty = i.product_quantity ? ` x${i.product_quantity}` : '';
        return `${title}${qty}`;
      }).join(', ');
    }
    return serviceTitle;
  }, [items, serviceTitle]);

  // Remarks
  const customerRemark = job.special_instructions
    || job.additional_notes
    || (job as any).remarks_data?.comment
    || (job as any).remarks?.note
    || items.find((i: any) => i.remark)?.remark
    || '';

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rawPhone) return;
    navigator.clipboard.writeText(rawPhone.replace(/\D/g, ''));
    setCopiedPhone(true);
    toast.success(`คัดลอกเบอร์โทร ${formattedPhone || rawPhone} เรียบร้อย`);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className={`bg-white border-b border-gray-200 text-black px-4 py-2.5 ${className}`}>
      {/* Compact Key-Value Detail List (Strictly Pure Black Text, No Colored Backgrounds, No Subtitles) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        {/* 1. Customer & Phone */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="font-bold text-black shrink-0">ลูกค้า:</span>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-semibold text-black truncate">{customerName}</span>
            {rawPhone && (
              <span className="font-mono text-black inline-flex items-center gap-1 shrink-0">
                <a 
                  href={`tel:${rawPhone.replace(/\D/g, '')}`} 
                  className="text-black hover:underline"
                  title="โทรออก"
                >
                  {formattedPhone || rawPhone}
                </a>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="p-0.5 text-black hover:opacity-70 transition-opacity cursor-pointer"
                  title="คัดลอกเบอร์โทร"
                >
                  {copiedPhone ? <Check className="w-3 h-3 text-black" /> : <Copy className="w-3 h-3 text-black" />}
                </button>
              </span>
            )}
          </div>
        </div>

        {/* 2. Site Address & Map */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="font-bold text-black shrink-0">สถานที่ติดตั้ง:</span>
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-black truncate font-normal" title={address || '-'}>
              {address || '-'}
            </span>
            {googleMapUrl && (
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-black hover:opacity-70 shrink-0 inline-flex items-center p-0.5"
                title="Google Maps"
              >
                <ExternalLink className="w-3 h-3 text-black" />
              </a>
            )}
          </div>
        </div>

        {/* 3. Products / Services */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="font-bold text-black shrink-0">สินค้า/บริการ:</span>
          <span className="text-black truncate font-normal" title={itemsSummaryText}>
            {itemsSummaryText}
          </span>
        </div>

        {/* 4. Branch & Project Type */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="font-bold text-black shrink-0">สาขา/ประเภท:</span>
          <span className="text-black truncate font-normal">
            {branchName ? `${branchName} ${storeCode ? `(${storeCode})` : ''} · ` : ''}
            {job.project_type || (job as any).job_type || 'ทั่วไป'}
          </span>
        </div>

        {/* 5. Special Notes / Remark (Inline if present) */}
        {customerRemark && (
          <div className="flex items-start gap-1.5 md:col-span-2 lg:col-span-4 pt-1 border-t border-gray-100">
            <span className="font-bold text-black shrink-0">หมายเหตุ:</span>
            <span className="text-black truncate font-normal" title={customerRemark}>
              {customerRemark}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderCustomerSummary;

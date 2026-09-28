import { Job } from '@/features/jobs/api';
import { ExternalLink } from 'lucide-react';

export interface OrderCustomerSummaryProps {
  job: Job;
  className?: string;
  defaultExpanded?: boolean;
}

export function OrderCustomerSummary({
  job,
  className = '',
}: OrderCustomerSummaryProps) {
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

  // Remarks
  const customerRemark = job.special_instructions
    || job.additional_notes
    || (job as any).remarks_data?.comment
    || (job as any).remarks?.note
    || ((job as any).job_details && Array.isArray((job as any).job_details) && (job as any).job_details.find((i: any) => i.remark)?.remark)
    || '';

  return (
    <div className={`bg-white border-b border-gray-200 text-black px-4 py-2.5 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {/* Site Address & Map */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="font-bold text-black text-sm shrink-0">สถานที่ติดตั้ง:</span>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-black font-medium text-sm truncate" title={address || '-'}>
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
                <ExternalLink className="w-3.5 h-3.5 text-black" />
              </a>
            )}
          </div>
        </div>

        {/* Special Notes / Remark (Side-by-side on the right if present) */}
        {customerRemark && (
          <div className="flex items-start gap-1.5 min-w-0">
            <span className="font-bold text-black text-sm shrink-0">หมายเหตุ:</span>
            <span className="text-black font-medium text-sm truncate flex-1" title={customerRemark}>
              {customerRemark}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderCustomerSummary;

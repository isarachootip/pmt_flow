import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CsatFormProps {
  jobId: number;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  className?: string;
}

const StarRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={cn('w-8 h-8 cursor-pointer', star <= value ? 'text-[#F5A623] fill-[#F5A623]' : 'text-border stroke-current fill-transparent')}
          onClick={() => onChange(star)}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
};

const CsatForm = React.forwardRef<HTMLDivElement, CsatFormProps>(
  ({ jobId, onSubmit, onCancel, className }, ref) => {
    const [score, setScore] = React.useState(0);
    const [customerFeedback, setCustomerFeedback] = React.useState('');
    const [csatSurveyor, setCsatSurveyor] = React.useState('');
    const [closeNow, setCloseNow] = React.useState(false);

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({
        csat_score: score,
        customer_feedback: customerFeedback,
        csat_remarks: '',
        csat_photos: [],
        csat_surveyor: csatSurveyor,
        close_now: closeNow,
      });
    };

    return (
      <div ref={ref} className={cn('space-y-6', className)}>
        <h2 className="text-lg font-semibold">After Sale CSAT (Job {jobId})</h2>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>คะแนนความพึงพอใจ</Label>
            <StarRating value={score} onChange={setScore} />
          </div>

          <div className="space-y-2">
            <Label>ความคิดเห็นลูกค้า</Label>
            <textarea
              value={customerFeedback}
              onChange={(e) => setCustomerFeedback(e.target.value)}
              className="w-full border border-border rounded-md p-2 h-24 focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
              placeholder="Customer feedback"
            />
          </div>

          <div className="space-y-2">
            <Label>ผู้ประเมิน</Label>
            <Input
              value={csatSurveyor}
              onChange={(e) => setCsatSurveyor(e.target.value)}
              placeholder="Surveyor name"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="close_now"
              checked={closeNow}
              onChange={(e) => setCloseNow(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <Label htmlFor="close_now">ปิดงานทันที (Close Now)</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={score === 0}>Submit CSAT</Button>
          </div>
        </form>
      </div>
    );
  }
);
CsatForm.displayName = 'CsatForm';

export { CsatForm };

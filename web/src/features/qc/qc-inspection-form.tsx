import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QcInspectionFormProps {
  jobId: number;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  className?: string;
}

const CHECKLIST = [
  { id: 'c1', label: 'ความเรียบร้อยของงาน', is_mandatory: true },
  { id: 'c2', label: 'ความปลอดภัย', is_mandatory: true },
  { id: 'c3', label: 'คุณภาพวัสดุ', is_mandatory: true },
  { id: 'c4', label: 'ความสะอาดพื้นที่', is_mandatory: false },
  { id: 'c5', label: 'การจัดเก็บเศษวัสดุ', is_mandatory: false },
];

const QcInspectionForm = React.forwardRef<HTMLDivElement, QcInspectionFormProps>(
  ({ jobId, onSubmit, onCancel, className }, ref) => {
    const [items, setItems] = React.useState(
      CHECKLIST.map(c => ({ item_id: c.id, result: '', remark: '', is_mandatory: c.is_mandatory }))
    );
    const [remarks, setRemarks] = React.useState('');

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const hasMandatoryFail = items.some(i => i.is_mandatory && i.result === 'FAIL');
      if (hasMandatoryFail) {
        if (!window.confirm('มีรายการบังคับไม่ผ่าน งานจะถูกส่งกลับแก้ไข (Rework) ยืนยันหรือไม่?')) {
          return;
        }
      }
      onSubmit({ items, remarks });
    };

    const updateItem = (idx: number, field: string, val: string) => {
      const newItems = [...items];
      (newItems[idx] as any)[field] = val;
      setItems(newItems);
    };

    const passedCount = items.filter(i => i.result === 'PASS').length;

    return (
      <div ref={ref} className={cn('space-y-6 text-black', className)}>
        <h2 className="text-lg font-bold text-black">QC Inspection (Job {jobId})</h2>
        <form onSubmit={handleFormSubmit} className="space-y-6 text-black">
          <div className="space-y-4 border rounded-md p-4 border-gray-200 bg-white">
            {CHECKLIST.map((c, idx) => (
              <div key={c.id} className="flex flex-col gap-2 pb-4 border-b last:border-0 border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[14px] text-black">
                    {c.label} {c.is_mandatory && <span className="text-[#D12D2D]">*</span>}
                  </span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-[14px] text-black cursor-pointer font-medium">
                      <input
                        type="radio"
                        name={`items.${idx}.result`}
                        value="PASS"
                        onChange={() => updateItem(idx, 'result', 'PASS')}
                        checked={items[idx].result === 'PASS'}
                        className="text-primary focus:ring-primary h-4 w-4"
                      />
                      PASS
                    </label>
                    <label className="flex items-center gap-1 text-[14px] text-black cursor-pointer font-medium">
                      <input
                        type="radio"
                        name={`items.${idx}.result`}
                        value="FAIL"
                        onChange={() => updateItem(idx, 'result', 'FAIL')}
                        checked={items[idx].result === 'FAIL'}
                        className="text-primary focus:ring-primary h-4 w-4"
                      />
                      FAIL
                    </label>
                  </div>
                </div>
                <Input
                  value={items[idx].remark}
                  onChange={(e) => updateItem(idx, 'remark', e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม"
                  className="h-[36px] text-black bg-white"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-black font-semibold">Overall Remarks</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 h-24 text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
              placeholder="Additional remarks..."
            />
          </div>

          <div className="flex items-center justify-between text-black">
            <span className="text-[14px] font-semibold text-black">
              Summary: {passedCount} / {CHECKLIST.length} Passed
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onCancel} className="text-black font-medium">Cancel</Button>
              <Button type="submit" className="text-black font-semibold">Submit QC</Button>
            </div>
          </div>
        </form>
      </div>
    );
  }
);
QcInspectionForm.displayName = 'QcInspectionForm';

export { QcInspectionForm };

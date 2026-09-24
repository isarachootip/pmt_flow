import { useState } from 'react';
import { Job } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ConvertBoqDrawerProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConvertBoqDrawer({ job, open, onOpenChange }: ConvertBoqDrawerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [baseStartDate, setBaseStartDate] = useState<string | undefined>(new Date().toISOString().split('T')[0]);
  
  // Dummy items for now, ideally fetched from BOQ API
  const [items, setItems] = useState([
    { name: 'งานติดตั้งท่อ', unit: 'เมตร', qty: 10, unit_price: 100, duration_days: 2, tech: '' },
    { name: 'งานเดินสายไฟ', unit: 'เมตร', qty: 20, unit_price: 50, duration_days: 1, tech: '' },
  ]);

  const convertMutation = useMutation({
    mutationFn: async (payload: any) => {
      const result = await api.post(`/jobs/${job.id}/tasks/import-boq`, payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('แปลง BOQ เป็น Task สำเร็จ');
      onOpenChange(false);
      navigate('/gantt');
    },
    onError: () => {
      toast.error('เกิดข้อผิดพลาดในการแปลง');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    convertMutation.mutate({
      base_start_date: baseStartDate,
      items
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-card shadow-2xl focus:outline-none flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-soft">
            <Dialog.Title className="text-lg font-semibold text-text">
              แปลง BOQ เป็น Task - {job.job_no}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-text-secondary hover:text-text p-1 rounded-full hover:bg-bg-subtle transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">วันเริ่มงาน (Base Start Date)</label>
                <DatePicker value={baseStartDate} onChange={setBaseStartDate} />
              </div>

              <div className="space-y-4 mt-6">
                <h4 className="font-medium text-text">รายการ BOQ</h4>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-bg-subtle p-3 rounded-md border border-soft">
                      <div className="flex-1">
                        <Input value={item.name} readOnly className="bg-card" />
                      </div>
                      <div className="w-24">
                        <Input 
                          type="number" 
                          value={item.duration_days} 
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].duration_days = parseInt(e.target.value) || 0;
                            setItems(newItems);
                          }}
                          placeholder="ระยะเวลา (วัน)" 
                        />
                      </div>
                      <div className="w-40">
                        <Input 
                          value={item.tech} 
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].tech = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="ระบุช่าง (ถ้ามี)" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-soft bg-bg-subtle flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
              <Button type="submit" variant="primary" disabled={convertMutation.isPending}>
                {convertMutation.isPending ? 'กำลังแปลง...' : 'ยืนยันการแปลง'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useEffect, useState } from 'react';
import { useCreateTicket, useUpdateTicket, Ticket } from './api';
import { useJobs } from '@/features/jobs/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface TicketDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Ticket;
}

export function TicketDrawer({ open, onOpenChange, initialData }: TicketDrawerProps) {
  const { data: jobsData } = useJobs({});
  const createMutation = useCreateTicket();
  const updateMutation = useUpdateTicket();

  const [ticketNo, setTicketNo] = useState('');
  const [jobId, setJobId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('เงินสด');
  const [paymentDate, setPaymentDate] = useState<string | undefined>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('PENDING');

  useEffect(() => {
    if (open) {
      if (initialData) {
        setTicketNo(initialData.ticket_no);
        setJobId(initialData.job_id);
        setAmount(initialData.amount);
        setPaymentMethod(initialData.payment_method);
        setPaymentDate(initialData.payment_date ? initialData.payment_date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setStatus(initialData.status);
      } else {
        setTicketNo('');
        setJobId('');
        setAmount(0);
        setPaymentMethod('เงินสด');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setStatus('PENDING');
      }
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) {
      toast.error('กรุณาเลือกงาน');
      return;
    }

    const payload = {
      ticket_no: ticketNo,
      job_id: jobId,
      amount,
      payment_method: paymentMethod,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      status
    };

    try {
      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, ...payload });
        toast.success('อัปเดต Ticket สำเร็จ');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('สร้าง Ticket สำเร็จ');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 transition-opacity" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl focus:outline-none flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-soft">
            <Dialog.Title className="text-lg font-semibold text-text">
              {initialData ? 'แก้ไข Ticket' : 'สร้าง Ticket'}
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
                <label className="text-sm font-medium text-text">เลขที่ Ticket</label>
                <Input value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">งาน</label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger><SelectValue placeholder="เลือกงาน" /></SelectTrigger>
                  <SelectContent>
                    {jobsData?.data?.map((job: any) => (
                      <SelectItem key={job.id} value={job.id}>{job.job_no}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">ยอดเงิน</label>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(parseFloat(e.target.value))} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">วิธีชำระ</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="วิธีชำระ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="เงินสด">เงินสด</SelectItem>
                    <SelectItem value="โอนเงิน">โอนเงิน</SelectItem>
                    <SelectItem value="บัตรเครดิต">บัตรเครดิต</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">วันที่ชำระ</label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">สถานะ</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="DONE">DONE</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-6 border-t border-soft bg-bg-subtle flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as React from 'react';
import { useCreateJob } from '@/features/jobs/api';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface CreateJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateJobDrawer({ open, onOpenChange }: CreateJobDrawerProps) {
  const { mutateAsync: createJob, isPending } = useCreateJob();
  const [formData, setFormData] = React.useState({
    project_type: 'Renovate',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    property_type: '',
    services: '',
    plan_date: '',
    assigned_tech: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, plan_date: date }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createJob({
        project_type: formData.project_type,
        customer: {
          name: formData.customer_name,
          phone: formData.customer_phone,
          address: formData.customer_address,
        },
        property_type: formData.property_type,
        services: formData.services.split(',').map(s => s.trim()).filter(Boolean),
        plan_date: formData.plan_date,
        assigned_tech: formData.assigned_tech,
        status: 'SURVEYED', // Initial status
      });
      toast.success('สร้างงานสำเร็จ');
      onOpenChange(false);
      setFormData({
        project_type: 'Renovate', customer_name: '', customer_phone: '', customer_address: '', property_type: '', services: '', plan_date: '', assigned_tech: ''
      });
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการสร้างงาน');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>สร้างงานใหม่</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">ประเภทงาน</label>
            <div className="flex gap-4">
              {['Renovate', 'Quick Service', 'Survey'].map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="project_type" 
                    value={type} 
                    checked={formData.project_type === type}
                    onChange={handleChange}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">ชื่อลูกค้า</label>
            <input 
              required
              name="customer_name" 
              value={formData.customer_name} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">เบอร์โทร</label>
            <input 
              required
              name="customer_phone" 
              value={formData.customer_phone} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">ที่อยู่</label>
            <input 
              name="customer_address" 
              value={formData.customer_address} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">ประเภทอสังหาริมทรัพย์</label>
            <input 
              name="property_type" 
              value={formData.property_type} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">บริการ (คั่นด้วยลูกน้ำ)</label>
            <input 
              name="services" 
              value={formData.services} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">วันนัด</label>
            <DatePicker 
              value={formData.plan_date} 
              onChange={handleDateChange} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">ช่างที่ได้รับมอบหมาย</label>
            <input 
              name="assigned_tech" 
              value={formData.assigned_tech} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>
          
          <SheetFooter className="mt-6">
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button variant="primary" type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

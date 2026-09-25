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
    booking_no: '',
    external_ref_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    property_type: '',
    services: '',
    plan_date: '',
    plan_time: '09:00',
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
        booking_no: formData.booking_no.trim() || undefined,
        external_ref_id: formData.external_ref_id.trim() || undefined,
        customer: {
          name: formData.customer_name,
          phone: formData.customer_phone,
          address: formData.customer_address,
        },
        property_type: formData.property_type,
        services: formData.services.split(',').map(s => s.trim()).filter(Boolean),
        plan_date: formData.plan_date || undefined,
        plan_time: formData.plan_time || undefined,
        assigned_tech: formData.assigned_tech,
        status: 'SURVEYED', // Initial status
      });
      toast.success('สร้างงานสำเร็จ');
      onOpenChange(false);
      setFormData({
        project_type: 'Renovate',
        booking_no: '',
        external_ref_id: '',
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        property_type: '',
        services: '',
        plan_date: '',
        plan_time: '09:00',
        assigned_tech: ''
      });
    } catch (err) {
      toast.error('เกิดข้อผิดพลาดในการสร้างงาน');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-white text-black" side="right">
        <SheetHeader>
          <SheetTitle className="text-black font-bold text-lg">สร้างงานใหม่</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4 text-black">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">ประเภทงาน</label>
            <div className="flex gap-4">
              {['Renovate', 'Quick Service', 'Survey'].map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer text-black font-medium">
                  <input 
                    type="radio" 
                    name="project_type" 
                    value={type} 
                    checked={formData.project_type === type}
                    onChange={handleChange}
                    className="text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-sm text-black">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black">Booking No</label>
              <input 
                name="booking_no" 
                placeholder="เช่น BK-99001"
                value={formData.booking_no} 
                onChange={handleChange}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black">Ref ID (STK / External)</label>
              <input 
                name="external_ref_id" 
                placeholder="เช่น REF-10001"
                value={formData.external_ref_id} 
                onChange={handleChange}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">ชื่อลูกค้า *</label>
            <input 
              required
              name="customer_name" 
              value={formData.customer_name} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">เบอร์โทร *</label>
            <input 
              required
              name="customer_phone" 
              value={formData.customer_phone} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">ที่อยู่</label>
            <input 
              name="customer_address" 
              value={formData.customer_address} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">ประเภทอสังหาริมทรัพย์</label>
            <input 
              name="property_type" 
              placeholder="เช่น บ้านเดี่ยว, คอนโด, ทาวน์โฮม"
              value={formData.property_type} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">บริการ (คั่นด้วยลูกน้ำ)</label>
            <input 
              name="services" 
              placeholder="เช่น ติดตั้งเครื่องทำน้ำอุ่น, เดินสายไฟ"
              value={formData.services} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black">วันนัด (DD/MM/YYYY)</label>
              <DatePicker 
                value={formData.plan_date} 
                onChange={handleDateChange} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-black">เวลานัด (24 ชั่วโมง)</label>
              <select
                name="plan_time"
                value={formData.plan_time}
                onChange={handleChange}
                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
              >
                <option value="08:30">08:30 น.</option>
                <option value="09:00">09:00 น.</option>
                <option value="10:00">10:00 น.</option>
                <option value="11:00">11:00 น.</option>
                <option value="13:00">13:00 น.</option>
                <option value="13:30">13:30 น.</option>
                <option value="14:00">14:00 น.</option>
                <option value="15:00">15:00 น.</option>
                <option value="16:00">16:00 น.</option>
                <option value="17:00">17:00 น.</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black">ช่างที่ได้รับมอบหมาย</label>
            <input 
              name="assigned_tech" 
              value={formData.assigned_tech} 
              onChange={handleChange}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft focus:border-primary"
            />
          </div>
          
          <SheetFooter className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)} className="text-black font-medium">
              ยกเลิก
            </Button>
            <Button variant="primary" type="submit" disabled={isPending} className="text-black font-semibold">
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

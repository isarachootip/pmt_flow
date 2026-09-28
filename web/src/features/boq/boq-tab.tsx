import { useState, useEffect } from 'react';
import { Job } from '@/features/jobs/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConvertBoqDrawer } from '@/features/jobs/convert-boq-drawer';
import { Package, Download, Plus } from 'lucide-react';

interface BoqItem {
  id?: string;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
}

interface BoqTabProps {
  job: Job;
}

export function BoqTab({ job }: BoqTabProps) {
  const queryClient = useQueryClient();
  const [isConvertDrawerOpen, setIsConvertDrawerOpen] = useState(false);
  
  const initialBoq = {
    items: job.boq_items || [],
    discount: 0
  };

  const { data: boqData } = useQuery({
    queryKey: ['boq', job.id],
    queryFn: async () => {
      try {
        const data = await api.get<any>(`/api/v1/jobs/${job.id}/boq`);
        return data;
      } catch {
        return initialBoq;
      }
    },
    initialData: initialBoq
  });

  const [items, setItems] = useState<BoqItem[]>(boqData?.items || initialBoq.items);
  const [discount, setDiscount] = useState<number>(boqData?.discount || 0);

  // Sync state when data loaded
  useEffect(() => {
    if (boqData?.items) setItems(boqData.items);
    if (boqData?.discount !== undefined) setDiscount(boqData.discount);
  }, [boqData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const result = await api.post(`/api/v1/jobs/${job.id}/boq`, payload);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boq', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: () => {
      // Non-blocking in mock/fallback mode
    }
  });

  const subtotal = items.reduce((acc, item) => acc + (item.qty * (item.unit_price || 0)), 0);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleAddItem = () => {
    setItems([...items, { name: '', unit: '', qty: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof BoqItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const [isFetchingBoq, setIsFetchingBoq] = useState(false);

  const handleFetchBoq = async () => {
    try {
      setIsFetchingBoq(true);
      await api.post(`/api/v1/jobs/${job.id}/boq/preview`, {
        booking_no: job.booking_no,
        base_start_date: job.plan_start_date || job.appointment_date
      });
      toast.success(`ดึงข้อมูล BOQ สำเร็จ (Booking: ${job.booking_no || job.job_no})`);
      setIsConvertDrawerOpen(true);
    } catch {
      toast.info('เปิดหน้าต่าง Preview โครงสร้าง Project & Task');
      setIsConvertDrawerOpen(true);
    } finally {
      setIsFetchingBoq(false);
    }
  };

  const handleImportFromOrder = () => {
    const rawDetails = (job.job_details && job.job_details.length > 0)
      ? job.job_details
      : ((job as any).raw_payload?.jobdetails || []);

    if (rawDetails.length > 0) {
      const newItems: BoqItem[] = rawDetails.map((d: any) => ({
        name: d.installation_detail || d.job_type || d.product_name || 'บริการตามออเดอร์',
        unit: 'งาน',
        qty: Number(d.product_quantity) || 1,
        unit_price: 0
      }));
      setItems(prev => [...prev.filter(i => i.name.trim()), ...newItems]);
      toast.success(`ดึง ${newItems.length} รายการจากคำสั่งซื้อเข้าสู่ตาราง BOQ สำเร็จ`);
      return;
    }

    if (Array.isArray(job.services) && job.services.length > 0) {
      const newItems: BoqItem[] = job.services.map(s => ({
        name: s,
        unit: 'งาน',
        qty: 1,
        unit_price: 0
      }));
      setItems(prev => [...prev.filter(i => i.name.trim()), ...newItems]);
      toast.success(`ดึงบริการ ${job.services.length} รายการจากคำสั่งซื้อเรียบร้อยแล้ว`);
      return;
    }

    const fallbackName = job.project_sub_type || (job as any).service || 'บริการติดตั้งตามคำสั่งซื้อ';
    setItems(prev => [...prev.filter(i => i.name.trim()), {
      name: fallbackName,
      unit: 'งาน',
      qty: 1,
      unit_price: 0
    }]);
    toast.success('ดึงรายการบริการจากคำสั่งซื้อเรียบร้อยแล้ว');
  };

  const handleConvertToTasks = async () => {
    const validItems = items.filter(i => i.name && i.name.trim().length > 0);
    if (validItems.length === 0) {
      toast.error('กรุณาระบุรายการประเมินราคาอย่างน้อย 1 รายการก่อนแปลงเป็น Task');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        boq_items: items,
        discount,
        grand_total: grandTotal
      });
    } catch {
      // proceed if mock/offline
    }

    setIsConvertDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-black text-base">รายการประเมินราคา (BOQ)</h3>
          {job.booking_no && (
            <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-mono font-medium">
              Booking: {job.booking_no}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleImportFromOrder}
            className="text-black font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
            title="ดึงรายการสินค้าและบริการจาก Order ต้นทางลงตาราง BOQ"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 ดึงรายการจาก Order</span>
          </Button>
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleFetchBoq} 
            disabled={isFetchingBoq}
            className="text-black font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
          >
            <span>Preview โครงสร้าง</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAddItem} className="text-black font-medium">
            + เพิ่มรายการ
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto border border-soft rounded-md bg-white">
        <table className="w-full text-left text-sm border-collapse text-black">
          <thead className="bg-bg-subtle sticky top-0 z-10 text-black">
            <tr>
              <th className="p-2 border-b border-soft font-semibold text-black">รายการ</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-28">หน่วย</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-28">จำนวน</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="text-black">
            {items.map((item, idx) => {
              return (
                <tr key={idx} className="border-b border-soft hover:bg-[var(--bg-subtle)]">
                  <td className="p-2">
                    <Input value={item.name} onChange={(e) => handleChange(idx, 'name', e.target.value)} placeholder="ชื่อรายการ" className="text-black bg-white" />
                  </td>
                  <td className="p-2">
                    <Input value={item.unit} onChange={(e) => handleChange(idx, 'unit', e.target.value)} placeholder="หน่วย" className="text-black bg-white" />
                  </td>
                  <td className="p-2">
                    <Input type="number" value={item.qty} onChange={(e) => handleChange(idx, 'qty', parseFloat(e.target.value) || 0)} min="0" className="text-black bg-white" />
                  </td>
                  <td className="p-2 text-center align-middle">
                    <button onClick={() => handleRemoveItem(idx)} className="text-danger hover:text-danger/80 text-lg font-bold" title="ลบรายการ">×</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-black">
                  <div className="max-w-md mx-auto py-4 flex flex-col items-center justify-center space-y-2.5">
                    <Package className="w-10 h-10 text-blue-600" />
                    <div className="text-sm font-bold text-black">
                      ยังไม่มีรายการประเมินราคา BOQ สำหรับใบงานนี้
                    </div>
                    <p className="text-xs text-gray-700 max-w-sm">
                      คุณสามารถดึงรายการสินค้าหรือบริการจากคำสั่งซื้อ (Order) มาเป็นรายการตั้งต้นในตาราง BOQ ได้ทันที หรือกดเพิ่มรายการประเมินราคาเอง
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleImportFromOrder}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ดึงรายการจากคำสั่งซื้อ</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddItem}
                        className="text-black font-medium text-xs border border-gray-300"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>เพิ่มรายการเอง</span>
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-soft pt-4 flex justify-end">
        <Button 
          variant="primary" 
          className="w-64 text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2" 
          onClick={handleConvertToTasks}
          disabled={saveMutation.isPending}
        >
          <span>⚡ แปลง BOQ เป็น Task</span>
        </Button>
      </div>

      <ConvertBoqDrawer
        job={job}
        open={isConvertDrawerOpen}
        onOpenChange={setIsConvertDrawerOpen}
        initialItems={items.filter(i => i.name?.trim())}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Job } from '@/features/jobs/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
      toast.success('บันทึก BOQ สำเร็จ');
    },
    onError: () => {
      toast.error('เกิดข้อผิดพลาดในการบันทึก BOQ');
    }
  });

  const subtotal = items.reduce((acc, item) => acc + (item.qty * item.unit_price), 0);
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

  const handleSave = () => {
    saveMutation.mutate({
      boq_items: items,
      discount,
      grand_total: grandTotal
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-black text-base">รายการประเมินราคา</h3>
        <Button variant="secondary" size="sm" onClick={handleAddItem} className="text-black font-medium">+ เพิ่มรายการ</Button>
      </div>
      
      <div className="flex-1 overflow-auto border border-soft rounded-md bg-white">
        <table className="w-full text-left text-sm border-collapse text-black">
          <thead className="bg-bg-subtle sticky top-0 z-10 text-black">
            <tr>
              <th className="p-2 border-b border-soft font-semibold text-black">รายการ</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-24">หน่วย</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-24">จำนวน</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-32">ราคา/หน่วย</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-32 text-right">รวม</th>
              <th className="p-2 border-b border-soft font-semibold text-black w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="text-black">
            {items.map((item, idx) => {
              const rowTotal = item.qty * item.unit_price;
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
                  <td className="p-2">
                    <Input type="number" value={item.unit_price} onChange={(e) => handleChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} min="0" className="text-black bg-white" />
                  </td>
                  <td className="p-2 text-right tabular-nums align-middle font-medium text-black">
                    {rowTotal.toLocaleString('th-TH')}
                  </td>
                  <td className="p-2 text-center align-middle">
                    <button onClick={() => handleRemoveItem(idx)} className="text-danger hover:text-danger/80 text-lg font-bold">×</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-black font-medium">ไม่มีข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-soft pt-4 flex flex-col items-end gap-2 text-sm text-black">
        <div className="flex justify-between w-64">
          <span className="text-black font-medium">รวมเป็นเงิน:</span>
          <span className="font-bold tabular-nums text-black">{subtotal.toLocaleString('th-TH')}</span>
        </div>
        <div className="flex justify-between w-64 items-center">
          <span className="text-black font-medium">ส่วนลด:</span>
          <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 h-8 text-right text-black bg-white font-mono" min="0" />
        </div>
        <div className="flex justify-between w-64 text-base font-bold mt-2 text-black">
          <span>ยอดสุทธิ:</span>
          <span className="tabular-nums text-black">{grandTotal.toLocaleString('th-TH')}</span>
        </div>
        <Button variant="primary" className="mt-4 w-64 text-black font-semibold" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล BOQ'}
        </Button>
      </div>
    </div>
  );
}

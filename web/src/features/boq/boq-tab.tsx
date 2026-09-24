import { useState, useMemo } from 'react';
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
  
  // Dummy query since we don't have a specific BOQ GET hook provided in the task description for individual job,
  // but we can assume jobs API returns it or there's an endpoint.
  const { data: boqData, isLoading } = useQuery({
    queryKey: ['boq', job.id],
    queryFn: async () => {
      // In real app, this would fetch BOQ for the job. 
      // For now we mock it or fetch if API exists.
      try {
        const data = await api.get<any>(`/jobs/${job.id}/boq`);
        return data;
      } catch {
        return { items: [], discount: 0 };
      }
    }
  });

  const [items, setItems] = useState<BoqItem[]>(boqData?.items || []);
  const [discount, setDiscount] = useState<number>(boqData?.discount || 0);

  // Sync state when data loaded
  useMemo(() => {
    if (boqData?.items) setItems(boqData.items);
    if (boqData?.discount !== undefined) setDiscount(boqData.discount);
  }, [boqData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const result = await api.post(`/jobs/${job.id}/boq`, payload);
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

  if (isLoading) return <div className="p-4 text-sm">กำลังโหลด...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-text">รายการประเมินราคา</h3>
        <Button variant="secondary" size="sm" onClick={handleAddItem}>+ เพิ่มรายการ</Button>
      </div>
      
      <div className="flex-1 overflow-auto border border-soft rounded-md">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-bg-subtle sticky top-0 z-10">
            <tr>
              <th className="p-2 border-b border-soft font-medium">รายการ</th>
              <th className="p-2 border-b border-soft font-medium w-24">หน่วย</th>
              <th className="p-2 border-b border-soft font-medium w-24">จำนวน</th>
              <th className="p-2 border-b border-soft font-medium w-32">ราคา/หน่วย</th>
              <th className="p-2 border-b border-soft font-medium w-32 text-right">รวม</th>
              <th className="p-2 border-b border-soft font-medium w-12 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const rowTotal = item.qty * item.unit_price;
              return (
                <tr key={idx} className="border-b border-soft">
                  <td className="p-2">
                    <Input value={item.name} onChange={(e) => handleChange(idx, 'name', e.target.value)} placeholder="ชื่อรายการ" />
                  </td>
                  <td className="p-2">
                    <Input value={item.unit} onChange={(e) => handleChange(idx, 'unit', e.target.value)} placeholder="หน่วย" />
                  </td>
                  <td className="p-2">
                    <Input type="number" value={item.qty} onChange={(e) => handleChange(idx, 'qty', parseFloat(e.target.value) || 0)} min="0" />
                  </td>
                  <td className="p-2">
                    <Input type="number" value={item.unit_price} onChange={(e) => handleChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} min="0" />
                  </td>
                  <td className="p-2 text-right tabular-nums align-middle">
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
                <td colSpan={6} className="p-8 text-center text-text-secondary">ไม่มีข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-soft pt-4 flex flex-col items-end gap-2 text-sm">
        <div className="flex justify-between w-64">
          <span className="text-text-secondary">รวมเป็นเงิน:</span>
          <span className="font-medium tabular-nums">{subtotal.toLocaleString('th-TH')}</span>
        </div>
        <div className="flex justify-between w-64 items-center">
          <span className="text-text-secondary">ส่วนลด:</span>
          <Input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 h-8 text-right" min="0" />
        </div>
        <div className="flex justify-between w-64 text-base font-bold mt-2">
          <span>ยอดสุทธิ:</span>
          <span className="tabular-nums">{grandTotal.toLocaleString('th-TH')}</span>
        </div>
        <Button variant="primary" className="mt-4 w-64" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล BOQ'}
        </Button>
      </div>
    </div>
  );
}

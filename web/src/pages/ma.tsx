import { useState, useMemo } from 'react';
import { useMAContracts, useCreateMAContract, MAContract } from '@/features/ma/api';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { formatDMY } from '@/lib/date';
import { DatePicker } from '@/components/ui/date-picker';

export default function MAPage() {
  const { data: rawContracts, isLoading } = useMAContracts();
  const createContract = useCreateMAContract();
  
  const contracts: MAContract[] = Array.isArray(rawContracts) ? rawContracts : ((rawContracts as any)?.data || []);
  const [selectedContract, setSelectedContract] = useState<MAContract | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<MAContract>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = async () => {
    await createContract.mutateAsync(formData);
    setIsCreateOpen(false);
    setFormData({});
  };

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const q = searchQuery.toLowerCase().trim();
    return contracts.filter((c: MAContract) => {
      const contractNo = String(c.contract_no || '').toLowerCase();
      const cust = String(c.customer_name || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return contractNo.includes(q) || cust.includes(q) || phone.includes(q);
    });
  }, [contracts, searchQuery]);

  const columns: ColumnDef<MAContract>[] = [
    { 
      id: 'contract_no', 
      header: 'เลขที่สัญญา', 
      width: 140,
      cell: ({ row }) => <span className="font-semibold text-primary">{row.contract_no}</span>
    },
    { id: 'customer_name', header: 'ลูกค้า', accessorKey: 'customer_name', width: 180 },
    { id: 'phone', header: 'เบอร์โทร', accessorKey: 'phone', width: 130 },
    { 
      id: 'period', 
      header: 'ระยะเวลาสัญญา', 
      width: 200,
      cell: ({ row }) => (
        <span className="text-black font-medium">
          {formatDMY(row.start_date)} - {formatDMY(row.end_date)}
        </span>
      )
    },
    { 
      id: 'contract_value', 
      header: 'มูลค่าสัญญา', 
      width: 140,
      cell: ({ row }) => (
        <span className="font-mono font-bold text-black">
          {row.contract_value?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
        </span>
      )
    },
    { 
      id: 'rounds_per_year', 
      header: 'รอบบริการ/ปี', 
      width: 110,
      cell: ({ row }) => (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 border border-blue-200 text-black">
          {row.rounds_per_year} รอบ
        </span>
      )
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 120,
      cell: ({ row }) => {
        const isAct = row.status === 'ACTIVE';
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isAct ? 'bg-emerald-50 border border-emerald-300 text-black' : 'bg-gray-100 border border-gray-300 text-black'}`}>
            {isAct ? 'ใช้งานอยู่ (ACTIVE)' : row.status}
          </span>
        );
      }
    }
  ];

  const actions = (
    <Button 
      variant="primary" 
      onClick={() => setIsCreateOpen(true)}
      className="text-black font-semibold flex items-center gap-1.5"
    >
      <Plus className="w-4 h-4" />
      <span>+ สร้างสัญญา MA</span>
    </Button>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="สัญญา MA (บริการหลังการขาย)" pageKey="ma" actions={actions} />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (เลขสัญญา, ลูกค้า, เบอร์โทร)..."
              className="pl-9 h-9 text-sm text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-9 text-xs text-black font-medium hover:bg-gray-100"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredContracts.length}</span> จากทั้งหมด <span className="font-bold text-black">{contracts.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="ma"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredContracts}
              isLoading={isLoading}
              onRowSelect={(row: any) => setSelectedContract(row)}
              getRowId={(row) => String(row.id || row.contract_no)}
              selectedRowId={selectedContract ? String(selectedContract.id || selectedContract.contract_no) : undefined}
            />
          }
          detailContent={
            selectedContract ? (
              <div className="flex flex-col h-full p-6 bg-card border border-soft rounded-xl shadow-card text-black space-y-4 overflow-y-auto">
                <div className="flex justify-between items-start border-b border-soft pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">{selectedContract.contract_no} • {selectedContract.customer_name}</h3>
                    <p className="text-xs text-black">เบอร์โทร: {selectedContract.phone} | ที่อยู่: {selectedContract.address}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedContract(null)} className="text-black">ปิด</Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">ระยะเวลาสัญญา</span>
                    <span className="font-bold text-black text-sm">{formatDMY(selectedContract.start_date)} ถึง {formatDMY(selectedContract.end_date)}</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">มูลค่าสัญญารวม</span>
                    <span className="font-bold text-black text-sm">{selectedContract.contract_value?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">ความถี่การบำรุงรักษา</span>
                    <span className="font-bold text-black text-sm">{selectedContract.rounds_per_year} รอบต่อปี</span>
                  </div>
                </div>

                <div className="p-4 bg-white border border-soft rounded-lg space-y-3">
                  <h4 className="font-semibold text-black text-sm">บริการในสัญญา MA</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(selectedContract.services) && selectedContract.services.map((s, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-black text-xs font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกสัญญา MA เพื่อดูรายละเอียดรอบบริการและการเข้าดูแล
              </div>
            )
          }
        />
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-black">สร้างสัญญา MA ใหม่</h2>
            <div className="space-y-3 text-sm">
              <input 
                placeholder="เลขสัญญา (เช่น MA-2026-001)" 
                className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                onChange={e => setFormData({ ...formData, contract_no: e.target.value })} 
              />
              <input 
                placeholder="ชื่อลูกค้า" 
                className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                onChange={e => setFormData({ ...formData, customer_name: e.target.value })} 
              />
              <input 
                placeholder="เบอร์โทรศัพท์" 
                className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                onChange={e => setFormData({ ...formData, phone: e.target.value })} 
              />
              <textarea 
                placeholder="ที่อยู่หน้างาน" 
                className="w-full border border-gray-300 p-2.5 rounded-lg text-black" 
                rows={2}
                onChange={e => setFormData({ ...formData, address: e.target.value })} 
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-black block mb-1">วันเริ่มสัญญา</label>
                  <DatePicker value={formData.start_date} onChange={(v) => setFormData({ ...formData, start_date: v })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-black block mb-1">วันสิ้นสุดสัญญา</label>
                  <DatePicker value={formData.end_date} onChange={(v) => setFormData({ ...formData, end_date: v })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-black block mb-1">มูลค่าสัญญา (บาท)</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full border border-gray-300 p-2 rounded-lg text-black font-mono" 
                    onChange={e => setFormData({ ...formData, contract_value: Number(e.target.value) })} 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-black block mb-1">จำนวนรอบ/ปี</label>
                  <input 
                    type="number" 
                    placeholder="4" 
                    className="w-full border border-gray-300 p-2 rounded-lg text-black font-mono" 
                    onChange={e => setFormData({ ...formData, rounds_per_year: Number(e.target.value) })} 
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200">
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-black">ยกเลิก</Button>
              <Button variant="primary" onClick={handleCreate} className="text-black font-semibold">บันทึกสัญญา</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

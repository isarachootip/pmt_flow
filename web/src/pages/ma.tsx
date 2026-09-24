import { useState } from 'react';
import { useMAContracts, useCreateMAContract, MAContract } from '@/features/ma/api';
import { format } from 'date-fns';

export default function MAPage() {
  const { data: contracts, isLoading } = useMAContracts();
  const createContract = useCreateMAContract();
  
  const [selectedContract, setSelectedContract] = useState<MAContract | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<MAContract>>({});

  const handleCreate = async () => {
    await createContract.mutateAsync(formData);
    setIsCreateOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'EXPIRED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 flex gap-6">
      {/* Master List */}
      <div className={`flex-1 space-y-4 ${selectedContract ? 'w-2/3 hidden md:block' : 'w-full'}`}>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">สัญญา MA</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md" onClick={() => setIsCreateOpen(true)}>สร้างสัญญา</button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">เลขสัญญา</th>
                <th className="px-4 py-3 font-semibold">ลูกค้า</th>
                <th className="px-4 py-3 font-semibold">เบอร์โทร</th>
                <th className="px-4 py-3 font-semibold">เริ่ม-สิ้นสุด</th>
                <th className="px-4 py-3 font-semibold text-right">มูลค่า</th>
                <th className="px-4 py-3 font-semibold text-center">รอบ/ปี</th>
                <th className="px-4 py-3 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((contract: MAContract) => (
                <tr 
                  key={contract.id} 
                  className={`cursor-pointer hover:bg-gray-50 ${selectedContract?.id === contract.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedContract(contract)}
                >
                  <td className="px-4 py-3 font-medium text-blue-600">{contract.contract_no}</td>
                  <td className="px-4 py-3">{contract.customer_name}</td>
                  <td className="px-4 py-3">{contract.phone}</td>
                  <td className="px-4 py-3 text-xs">
                    {format(new Date(contract.start_date), 'dd/MM/yyyy')} - {format(new Date(contract.end_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">{contract.contract_value.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">{contract.rounds_per_year}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${getStatusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    ไม่มีข้อมูลสัญญา MA
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail View */}
      {selectedContract && (
        <div className="w-1/3 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{selectedContract.contract_no}</h2>
              <p className="text-gray-500">{selectedContract.customer_name}</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedContract(null)}>✕</button>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold border-b pb-2">รายละเอียดสัญญา</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">ที่อยู่</span><span className="text-right w-2/3">{selectedContract.address}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">บริการ</span><span className="text-right">{selectedContract.services.join(', ')}</span></div>
            </div>
            
            <h3 className="font-semibold border-b pb-2 pt-4">รอบการเข้าบริการ (MA Rounds)</h3>
            <div className="text-sm text-gray-500 italic text-center py-4">
              [Placeholder for MA Rounds list]
            </div>
          </div>
        </div>
      )}

      {/* Create Drawer/Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] space-y-4">
            <h2 className="text-xl font-bold">สร้างสัญญา MA ใหม่</h2>
            <div className="space-y-3">
              <input placeholder="เลขสัญญา" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, contract_no: e.target.value })} />
              <input placeholder="ชื่อลูกค้า" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
              <input placeholder="เบอร์โทรศัพท์" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              <textarea placeholder="ที่อยู่" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, address: e.target.value })} />
              <div className="flex gap-2">
                <input type="date" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                <input type="date" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder="มูลค่าสัญญา" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, contract_value: Number(e.target.value) })} />
                <input type="number" placeholder="จำนวนรอบ/ปี" className="w-full border p-2 rounded-md" onChange={e => setFormData({ ...formData, rounds_per_year: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <button className="px-4 py-2 border rounded-md" onClick={() => setIsCreateOpen(false)}>ยกเลิก</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={handleCreate}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

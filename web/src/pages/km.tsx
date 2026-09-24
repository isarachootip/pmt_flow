import { useState } from 'react';

const KM_ARTICLES = [
  { id: 1, title: 'ขั้นตอนการใช้งานระบบ (สำหรับแอดมิน)', category: 'General' },
  { id: 2, title: 'การบันทึกงานช่าง (สำหรับ AE และช่าง)', category: 'Operation' },
  { id: 3, title: 'การตรวจ QC และการประเมิน', category: 'Quality' },
  { id: 4, title: 'การปิดงานและสรุปยอด', category: 'Finance' },
  { id: 5, title: 'สัญญา MA และการจัดการรอบบริการ', category: 'MA' },
];

export default function KMPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredArticles = KM_ARTICLES.filter(article => 
    article.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 overflow-auto h-full w-full">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-blue-600">คลังความรู้ (Knowledge Management)</h1>
        <p className="text-gray-500">รวบรวมคู่มือและขั้นตอนการทำงานต่างๆ ในระบบ PMT Flow</p>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="ค้นหาคู่มือที่ต้องการ..." 
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <svg className="absolute right-4 top-3.5 w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.map(article => (
          <div key={article.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">
                {article.category}
              </span>
              <h2 className="text-lg font-bold">{article.title}</h2>
            </div>
            <button className="text-blue-600 font-medium text-left hover:underline">
              อ่านเพิ่มเติม →
            </button>
          </div>
        ))}
        {filteredArticles.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-12 text-gray-500">
            ไม่พบข้อมูลที่ค้นหา
          </div>
        )}
      </div>
    </div>
  );
}

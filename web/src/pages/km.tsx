import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { KM_ARTICLES, KmArticle } from '@/features/km/km-articles-data';
import { KmDetailPane } from '@/features/km/km-detail-pane';

export default function KMPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<KmArticle | null>(KM_ARTICLES[0]);

  const filteredArticles = useMemo(() => {
    return KM_ARTICLES.filter((article) => {
      if (categoryFilter !== 'ALL' && article.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          article.title.toLowerCase().includes(q) ||
          article.code.toLowerCase().includes(q) ||
          article.summary.toLowerCase().includes(q) ||
          article.content.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchTerm, categoryFilter]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'General': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Operation': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Quality': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Finance': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MA': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const columns: ColumnDef<KmArticle>[] = [
    {
      id: 'code',
      header: 'รหัสคู่มือ',
      width: 120,
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-indigo-700">{row.code}</span>,
    },
    {
      id: 'title',
      header: 'ชื่อบทความ / คู่มือการปฏิบัติงาน',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-xs text-black block">{row.title}</span>
          <span className="text-[11px] text-slate-500 line-clamp-1">{row.summary}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'หมวดหมู่',
      width: 110,
      cell: ({ row }) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getCategoryBadge(row.category)}`}>
          {row.category}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'ปรับปรุงล่าสุด',
      width: 120,
      cell: ({ row }) => <span className="font-mono text-xs text-black">{row.updatedAt}</span>,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-2.5 overflow-hidden">
      <PageHeader 
        title="คลังความรู้ (Knowledge Management)" 
        pageKey="km" 
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              placeholder="ค้นหาคู่มือ, ขั้นตอนการทำงาน, รหัส KM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs text-black font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'ALL' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('General')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'General' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Operation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Operation' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Operation
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Quality')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Quality' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Quality
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('Finance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'Finance' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              Finance
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('MA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                categoryFilter === 'MA' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
              }`}
            >
              MA
            </button>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-600">
          พบ <span className="text-black font-bold font-mono">{filteredArticles.length}</span> บทความ
        </div>
      </div>

      {/* Top-Bottom Master Detail Layout */}
      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="km"
          masterContent={
            <DataGrid
              data={filteredArticles}
              columns={columns}
              getRowId={(row) => String(row.id)}
              selectedRowId={selectedArticle ? String(selectedArticle.id) : undefined}
              onRowSelect={setSelectedArticle}
            />
          }
          detailContent={
            selectedArticle ? (
              <KmDetailPane 
                article={selectedArticle} 
                getCategoryBadge={getCategoryBadge} 
              />
            ) : (
              <EmptyState />
            )
          }
        />
      </div>
    </div>
  );
}

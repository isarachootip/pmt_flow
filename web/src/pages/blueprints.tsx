import { useState, useMemo } from 'react';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useBlueprints, Blueprint } from '@/features/blueprints/api';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FileImage } from 'lucide-react';
import { formatDMY } from '@/lib/date';

export default function BlueprintsPage() {
  const { data: blueprintsData, isLoading } = useBlueprints();
  const { data: jobsData } = useJobs({});
  
  const blueprints: Blueprint[] = Array.isArray(blueprintsData) ? blueprintsData : (blueprintsData?.data || []);
  const allJobs: Job[] = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);

  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRowClick = (row: Blueprint) => {
    setSelectedBlueprint(row);
    const job = allJobs.find((j: Job) => j.id.toString() === row.job_id || j.job_no === row.job_no);
    if (job) setSelectedJob(job);
  };

  const filteredBlueprints = useMemo(() => {
    if (!searchQuery.trim()) return blueprints;
    const q = searchQuery.toLowerCase().trim();
    return blueprints.filter((b: Blueprint) => {
      const fileName = String(b.file_name || '').toLowerCase();
      const jobNo = String(b.job_no || '').toLowerCase();
      const creator = String(b.created_by || '').toLowerCase();
      return fileName.includes(q) || jobNo.includes(q) || creator.includes(q);
    });
  }, [blueprints, searchQuery]);

  const columns: ColumnDef<Blueprint>[] = [
    { 
      id: 'file_name', 
      header: 'ชื่อไฟล์แบบ', 
      width: 240,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FileImage className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-black truncate" title={row.file_name}>{row.file_name}</span>
        </div>
      )
    },
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      accessorKey: 'job_no', 
      width: 140,
      cell: ({ row }) => <span className="font-semibold text-black">{row.job_no}</span>
    },
    { 
      id: 'file_type', 
      header: 'ประเภทไฟล์', 
      width: 120,
      cell: ({ row }) => (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 border border-gray-300 text-black uppercase">
          {row.file_type || 'DWG/PDF'}
        </span>
      )
    },
    { 
      id: 'version', 
      header: 'เวอร์ชัน', 
      width: 100,
      cell: ({ row }) => (
        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 border border-blue-200 text-black">
          v{row.version || '1.0'}
        </span>
      )
    },
    { id: 'created_by', header: 'ผู้อัปโหลด', accessorKey: 'created_by', width: 160 },
    { 
      id: 'created_at', 
      header: 'วันที่อัปโหลด', 
      width: 140,
      cell: ({ row }) => {
        const val = row.created_at;
        return <span className="text-black font-medium">{val ? formatDMY(val) : '-'}</span>;
      }
    }
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="แบบติดตั้ง (Blueprints)" pageKey="blueprints" />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ชื่อแบบ, รหัสงาน, ผู้อัปโหลด)..."
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
          แสดง <span className="font-bold text-black">{filteredBlueprints.length}</span> จากทั้งหมด <span className="font-bold text-black">{blueprints.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="blueprints"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredBlueprints}
              isLoading={isLoading}
              onRowSelect={handleRowClick}
              getRowId={(row) => row.id.toString()}
              selectedRowId={selectedBlueprint?.id.toString()}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                defaultTab="task" 
                onClose={() => { setSelectedJob(null); setSelectedBlueprint(null); }} 
              />
            ) : selectedBlueprint ? (
              <div className="flex flex-col h-full p-6 bg-card border border-soft rounded-xl shadow-card text-black space-y-4">
                <div className="flex justify-between items-start border-b border-soft pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">{selectedBlueprint.file_name}</h3>
                    <p className="text-xs text-black">รหัสโครงการ: {selectedBlueprint.job_no} | ผู้อัปโหลด: {selectedBlueprint.created_by}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBlueprint(null)} className="text-black">ปิด</Button>
                </div>
                <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <div className="text-center p-6 space-y-2">
                    <FileImage className="w-12 h-12 text-gray-400 mx-auto" />
                    <p className="font-semibold text-black">แบบแปลนงานติดตั้ง ({selectedBlueprint.file_name})</p>
                    <p className="text-xs text-gray-500">เวอร์ชัน v{selectedBlueprint.version || '1.0'} • อัปโหลดเมื่อ {formatDMY(selectedBlueprint.created_at || new Date().toISOString())}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกแบบแปลนเพื่อดูตัวอย่างและรายละเอียด
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

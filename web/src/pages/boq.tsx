import { useState, useMemo } from 'react';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { formatDMY } from '@/lib/date';

export default function BoqPage() {
  const { data: jobsData, isLoading } = useJobs({});
  
  const allJobs: Job[] = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = useMemo(() => {
    let result = allJobs.filter((job: Job) => 
      ['BOQ', 'DESIGNING', 'SURVEYED', 'IN_PROGRESS', 'DRAFT'].includes(job.status?.toUpperCase())
    );
    if (result.length === 0) result = allJobs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(job => {
        const jobNo = String(job.job_no || job.id || '').toLowerCase();
        const custName = String(typeof job.customer === 'string' ? job.customer : job.customer?.name || '').toLowerCase();
        const bookingNo = String(job.booking_no || (job as any).bookingNo || '').toLowerCase();
        return jobNo.includes(q) || custName.includes(q) || bookingNo.includes(q);
      });
    }

    return result;
  }, [allJobs, searchQuery]);

  const handleRowClick = (row: Job) => {
    setSelectedJob(row);
  };

  const columns: ColumnDef<Job>[] = [
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      accessorKey: 'job_no', 
      width: 140,
      cell: ({ row }) => <span className="font-semibold text-black">{row.job_no}</span>
    },
    { 
      id: 'booking_no', 
      header: 'Booking No', 
      width: 140,
      cell: ({ row }) => {
        const val = row.booking_no || (row as any).bookingNo;
        return val ? (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-black font-medium">
            {val}
          </span>
        ) : <span className="text-black">-</span>;
      }
    },
    { 
      id: 'customer', 
      header: 'ลูกค้า', 
      width: 200,
      cell: ({ row }) => {
        const val = row.customer;
        const name = typeof val === 'string' ? val : (val as any)?.name || '-';
        return <span className="text-black font-medium">{name}</span>;
      }
    },
    { 
      id: 'services', 
      header: 'บริการ', 
      width: 220,
      cell: ({ row }) => {
        const text = Array.isArray(row.services) ? row.services.join(', ') : (row.services || '-');
        return <div className="truncate max-w-[210px] text-black" title={text}>{text}</div>;
      }
    },
    { 
      id: 'grand_total', 
      header: 'ยอดสุทธิ BOQ', 
      width: 150,
      cell: ({ row }) => {
        const total = Number(row.grand_total || (row as any).boq_grand_total || 0);
        return (
          <span className="font-mono font-bold text-black">
            {total ? `${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿` : '-'}
          </span>
        );
      }
    },
    { 
      id: 'plan_date', 
      header: 'วันนัด', 
      width: 140,
      cell: ({ row }) => {
        const d = row.plan_date || (row as any).appointment_date;
        return <span className="text-black font-medium">{d ? formatDMY(d) : '-'}</span>;
      }
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 130,
      cell: ({ row }) => <StatusBadge status={row.status as any} />
    }
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="คลัง BOQ กลาง" pageKey="boq" />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ลูกค้า, รหัสงาน, Booking)..."
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
          แสดง <span className="font-bold text-black">{filteredJobs.length}</span> จากทั้งหมด <span className="font-bold text-black">{allJobs.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="boq"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredJobs}
              isLoading={isLoading}
              onRowSelect={handleRowClick}
              getRowId={(row) => row.id.toString()}
              selectedRowId={selectedJob?.id.toString()}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                defaultTab="boq" 
                onClose={() => { setSelectedJob(null); }} 
              />
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกรายการเพื่อดูและแก้ไขรายการประเมินราคา BOQ
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

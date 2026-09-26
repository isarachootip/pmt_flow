import { useState, useMemo } from 'react';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useTickets, Ticket } from '@/features/tickets/api';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { TicketDrawer } from '@/features/tickets/ticket-drawer';
import { formatDMY } from '@/lib/date';

export default function TicketsPage() {
  const { data: ticketsData, isLoading } = useTickets();
  const { data: jobsData } = useJobs({});
  
  const tickets: Ticket[] = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.data || []);
  const allJobs: Job[] = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRowClick = (row: Ticket) => {
    setSelectedTicket(row);
    const job = allJobs.find((j: Job) => j.id.toString() === row.job_id || j.job_no === row.job_no);
    if (job) setSelectedJob(job);
  };

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter((t: Ticket) => {
      const ticketNo = String(t.ticket_no || '').toLowerCase();
      const jobNo = String(t.job_no || '').toLowerCase();
      const paymentMethod = String(t.payment_method || '').toLowerCase();
      return ticketNo.includes(q) || jobNo.includes(q) || paymentMethod.includes(q);
    });
  }, [tickets, searchQuery]);

  const columns: ColumnDef<Ticket>[] = [
    { 
      id: 'ticket_no', 
      header: 'เลขที่ Ticket', 
      width: 150,
      cell: ({ row }) => <span className="font-semibold text-primary">{row.ticket_no}</span> 
    },
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      width: 140,
      cell: ({ row }) => <span className="font-semibold text-black">{row.job_no}</span>
    },
    { 
      id: 'amount', 
      header: 'ยอดเงิน', 
      width: 140,
      cell: ({ row }) => (
        <span className="font-mono font-bold text-black">
          {row.amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
        </span>
      )
    },
    { id: 'payment_method', header: 'วิธีชำระเงิน', accessorKey: 'payment_method', width: 140 },
    { 
      id: 'payment_date', 
      header: 'วันที่ชำระเงิน', 
      width: 140,
      cell: ({ row }) => {
        const val = row.payment_date;
        return <span className="text-black font-medium">{val ? formatDMY(val) : '-'}</span>;
      }
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 130,
      cell: ({ row }) => <StatusBadge status={row.status as any} />
    }
  ];

  const actions = (
    <Button 
      variant="primary" 
      onClick={() => { setSelectedTicket(null); setDrawerOpen(true); }}
      className="text-black font-semibold flex items-center gap-1.5"
    >
      <Plus className="w-4 h-4" />
      <span>+ บันทึก Ticket & ใบเสร็จ</span>
    </Button>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="Ticket & ใบเสร็จ" pageKey="tickets" actions={actions} />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (เลข Ticket, รหัสงาน, วิธีชำระ)..."
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
          แสดง <span className="font-bold text-black">{filteredTickets.length}</span> จากทั้งหมด <span className="font-bold text-black">{tickets.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="tickets"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredTickets}
              isLoading={isLoading}
              onRowSelect={handleRowClick}
              getRowId={(row) => row.id.toString()}
              selectedRowId={selectedTicket?.id.toString()}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                defaultTab="task" 
                onClose={() => { setSelectedJob(null); setSelectedTicket(null); }} 
              />
            ) : selectedTicket ? (
              <div className="flex flex-col h-full p-6 bg-card border border-soft rounded-xl shadow-card text-black space-y-4">
                <div className="flex justify-between items-start border-b border-soft pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-black">Ticket: {selectedTicket.ticket_no}</h3>
                    <p className="text-xs text-black">รหัสโครงการ: {selectedTicket.job_no} | วิธีชำระ: {selectedTicket.payment_method}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)} className="text-black">ปิด</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">ยอดชำระ</span>
                    <span className="text-lg font-bold text-black">{selectedTicket.amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">วันที่ชำระ</span>
                    <span className="font-bold text-black text-sm">{formatDMY(selectedTicket.payment_date)}</span>
                  </div>
                  <div className="p-3 bg-white border border-soft rounded-lg shadow-sm">
                    <span className="text-xs text-black block">สถานะ Ticket</span>
                    <span className="font-bold text-black text-sm">{selectedTicket.status}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือก Ticket เพื่อดูรายละเอียดใบเสร็จและโครงการ
              </div>
            )
          }
        />
      </div>
      
      <TicketDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={selectedTicket || undefined}
      />
    </div>
  );
}

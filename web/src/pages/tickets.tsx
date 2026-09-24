import { useState } from 'react';
import { MasterDetailLayout } from '@/features/layout/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useTickets, Ticket } from '@/features/tickets/api';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { TicketDrawer } from '@/features/tickets/ticket-drawer';

export default function TicketsPage() {
  const { data: ticketsData, isLoading } = useTickets();
  const { data: jobsData } = useJobs({});
  
  const tickets: Ticket[] = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.data || []);
  const allJobs: Job[] = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (row: Ticket) => {
    setSelectedTicket(row);
    const job = allJobs.find((j: Job) => j.id.toString() === row.job_id || j.job_no === row.job_no);
    if (job) setSelectedJob(job);
  };

  const columns: ColumnDef<Ticket>[] = [
    { id: 'ticket_no', header: 'เลขที่', accessorKey: 'ticket_no', width: 120 },
    { id: 'job_no', header: 'งาน', accessorKey: 'job_no', width: 120 },
    { 
      id: 'amount', 
      header: 'ยอด', 
      accessorKey: 'amount', 
      width: 120,
      cell: ({ row }) => row.amount.toLocaleString('th-TH')
    },
    { id: 'payment_method', header: 'วิธีชำระ', accessorKey: 'payment_method', width: 120 },
    { 
      id: 'payment_date', 
      header: 'วันที่ชำระ', 
      accessorKey: 'payment_date', 
      width: 120,
      cell: ({ row }) => {
        const val = row.payment_date;
        if (!val) return '-';
        const d = new Date(val);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      accessorKey: 'status', 
      width: 120,
      cell: ({ row }) => <StatusBadge status={row.status as any} />
    }
  ];

  return (
    <>
      <MasterDetailLayout
        masterTitle="Tickets"
        masterActions={<Button variant="primary" onClick={() => { setSelectedTicket(null); setDrawerOpen(true); }}>+ เพิ่ม Ticket</Button>}
        hasDetail={!!selectedJob}
        master={
          <div className="h-full bg-card rounded-xl border border-soft shadow-card p-4 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <DataGrid
                columns={columns}
                data={tickets}
                isLoading={isLoading}
                onRowSelect={handleRowClick}
                getRowId={(row) => row.id.toString()}
                selectedRowId={selectedTicket?.id.toString()}
              />
            </div>
          </div>
        }
        detail={
          selectedJob ? (
            <JobDetailTabs 
              job={selectedJob} 
              defaultTab="finance" 
              onClose={() => { setSelectedJob(null); setSelectedTicket(null); }} 
            />
          ) : null
        }
      />
      
      <TicketDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={selectedTicket || undefined}
      />
    </>
  );
}

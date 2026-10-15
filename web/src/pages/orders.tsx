import * as React from 'react';
import { useJobs, Job } from '@/features/jobs/api';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid } from '@/components/ui/data-grid';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Download } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CreateJobDrawer } from '@/features/jobs/create-job-drawer';
import { useResponsive } from '@/lib/use-responsive';
import { Sheet, SheetContent } from '@/components/ui/sheet';

import { buildOrdersColumns } from '@/features/orders/orders-columns';
import {
  OrdersColumnVisibility,
  getInitialVisibleColumns,
  COLUMN_STORAGE_KEY
} from '@/features/orders/orders-column-visibility';
import { OrdersMobileCardList } from '@/features/orders/orders-mobile-card';
import { exportOrdersToCSV } from '@/features/orders/orders-export-csv';
import { useOrdersFilter } from '@/features/orders/use-orders-filter';

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobNo } = useParams<{ jobNo?: string }>();
  const [showCreateDrawer, setShowCreateDrawer] = React.useState(false);

  // Step 1: Active queue validation
  const isJobClosed = (j: any) =>
    j.status === 'COMPLETED' ||
    j.status === 'PASSED' ||
    j.status === 'QC_PASSED' ||
    j.status === 'QC_PASS' ||
    j.status === 'CLOSED' ||
    j.status === 'CLOSEJOB' ||
    (j as any).stk_status === 'DELIVERED';

  const isStep1Queue = (j: any) => {
    if ((j as any).pmt_accepted === true) return false;
    const st = String(j.status || '').toUpperCase();
    if (
      st === 'PLANNED' ||
      st === 'WAIT_QC' ||
      st === 'IN_PROGRESS' ||
      st === 'QC_PENDING' ||
      st === 'PASSED' ||
      st === 'ACCEPTED' ||
      isJobClosed(j)
    ) {
      return false;
    }
    return true;
  };

  const { data, isLoading } = useJobs({
    page: 1,
    limit: 100,
    sort_by: 'created_at',
    sort_order: 'desc',
    step: 'step1'
  });

  const rawJobs: Job[] = Array.isArray(data) ? data : (data?.data || []);
  const allJobs: Job[] = React.useMemo(() => {
    return rawJobs.filter(j => isStep1Queue(j));
  }, [rawJobs]);

  const hasAnyTicket = React.useMemo(() => {
    return allJobs.some(j => Boolean(j.ticket_no || (j as any).ticketNo || (j as any).ticket_number));
  }, [allJobs]);

  // Filters & Sorting state
  const {
    searchQuery,
    setSearchQuery,
    typeFilter,
    handleTypeFilterChange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortField,
    sortDirection,
    handleSort,
    resetFilters,
    isFilterActive,
    typeCounts,
    filteredAndSortedJobs
  } = useOrdersFilter(allJobs);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>(() =>
    getInitialVisibleColumns(hasAnyTicket)
  );

  const handleToggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  };

  const handleResetColumns = () => {
    const defaults = getInitialVisibleColumns(hasAnyTicket);
    setVisibleColumns(defaults);
    try {
      localStorage.removeItem(COLUMN_STORAGE_KEY);
    } catch {
      // Ignore localStorage error
    }
  };

  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Sync selectedJob when jobs load or jobNo changes in URL
  React.useEffect(() => {
    if (jobNo && allJobs.length > 0) {
      const found = allJobs.find(j => j.job_no === jobNo || String(j.id) === jobNo);
      if (found) {
        setSelectedJob(found);
      }
    } else if (!jobNo) {
      setSelectedJob(null);
    }
  }, [jobNo, allJobs]);

  const handleRowClick = (row: Job) => {
    if (isMobile) {
      navigate(`/jobs/${row.job_no}`);
      return;
    }
    setSelectedJob(row);
    if (row.job_no) {
      navigate(`/orders/${row.job_no}${location.search}`, { replace: true });
    }
  };

  const handleCloseDetail = () => {
    setSelectedJob(null);
    navigate(`/orders${location.search}`, { replace: true });
  };

  const columns = React.useMemo(() => {
    return buildOrdersColumns({ visibleColumns });
  }, [visibleColumns]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-text">
      {/* Page Header */}
      <PageHeader
        title="รับงาน & คิวงาน"
        pageKey="orders_v2"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportOrdersToCSV(filteredAndSortedJobs)}
              className="h-8 text-xs font-semibold text-black border-gray-300 hover:bg-gray-100 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-black" />
              <span>ส่งออก</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateDrawer(true)}
              className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>รับงานใหม่</span>
            </Button>
          </div>
        }
      >
        {/* Job Type Filter Chips */}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-xs font-bold text-black mr-1">ประเภท:</span>
          <button
            type="button"
            onClick={() => handleTypeFilterChange('all')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-black text-white shadow-xs font-bold'
                : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
            }`}
          >
            <span>ทั้งหมด</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                typeFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeFilterChange('Q')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'Q'
                ? 'bg-blue-600 text-white shadow-xs font-bold border border-blue-700'
                : 'bg-white text-black border border-gray-300 hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center px-1 py-0.2 rounded text-[9px] font-bold ${
                typeFilter === 'Q' ? 'bg-blue-800 text-white border border-blue-400' : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}
            >
              Q
            </span>
            <span>งาน Quick</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                typeFilter === 'Q' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.Q}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTypeFilterChange('R')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              typeFilter === 'R'
                ? 'bg-orange-600 text-white shadow-xs font-bold border border-orange-700'
                : 'bg-white text-black border border-gray-300 hover:bg-orange-50/70 hover:border-orange-300'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center px-1 py-0.2 rounded text-[9px] font-bold ${
                typeFilter === 'R' ? 'bg-orange-800 text-white border border-orange-400' : 'bg-orange-100 text-orange-900 border border-orange-300'
              }`}
            >
              R
            </span>
            <span>งาน Renovate</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                typeFilter === 'R' ? 'bg-orange-700 text-white' : 'bg-gray-200 text-black'
              }`}
            >
              {typeCounts.R}
            </span>
          </button>
        </div>
      </PageHeader>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-field search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ลูกค้า, เบอร์โทร, Booking, Ref ID)..."
              className="pl-8 h-8 text-xs text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-black whitespace-nowrap">ช่วงวันที่:</span>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              className="bg-white [&_input]:h-8 [&_input]:text-xs [&_button]:h-8"
            />
          </div>

          {/* Column Visibility Dropdown */}
          {!isMobile && (
            <OrdersColumnVisibility
              visibleColumns={visibleColumns}
              onToggleColumn={handleToggleColumn}
              onResetColumns={handleResetColumns}
            />
          )}

          {/* Reset button if filter is active */}
          {isFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs text-black font-medium hover:bg-gray-100 px-2"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        {/* Counter badge */}
        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredAndSortedJobs.length}</span> จากทั้งหมด <span className="font-bold text-black">{allJobs.length}</span> รายการ
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 mt-1">
        {isMobile ? (
          <OrdersMobileCardList
            jobs={filteredAndSortedJobs}
            isLoading={isLoading}
            onSelect={handleRowClick}
          />
        ) : isDesktop ? (
          <MasterDetailLayout
            pageKey="orders_v2"
            orientation="vertical"
            defaultSplitRatio={0.55}
            minMasterRatio={0.35}
            minDetailRatio={0.30}
            masterContent={
              <DataGrid
                columns={columns}
                data={filteredAndSortedJobs}
                isLoading={isLoading}
                showIndexColumn={false}
                stickyFirstColumn={true}
                sortColumn={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                getRowId={(row) => String(row.id || row.job_no)}
                onRowSelect={handleRowClick}
                selectedRowId={selectedJob ? String(selectedJob.id || selectedJob.job_no) : undefined}
              />
            }
            detailContent={
              selectedJob ? (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-1 min-h-0">
                    <JobDetailTabs
                      job={selectedJob}
                      onClose={handleCloseDetail}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium text-sm">
                  เลือกรายการเพื่อดูรายละเอียด
                </div>
              )
            }
          />
        ) : (
          <div className="h-full w-full">
            <DataGrid
              columns={columns}
              data={filteredAndSortedJobs}
              isLoading={isLoading}
              showIndexColumn={false}
              stickyFirstColumn={true}
              sortColumn={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              getRowId={(row) => String(row.id || row.job_no)}
              onRowSelect={handleRowClick}
              selectedRowId={selectedJob ? String(selectedJob.id || selectedJob.job_no) : undefined}
            />
          </div>
        )}
      </div>

      {/* Tablet Slide-Over Drawer (~70% width) */}
      {isTablet && (
        <Sheet open={Boolean(selectedJob)} onOpenChange={(open) => { if (!open) handleCloseDetail(); }}>
          <SheetContent
            side="right"
            hideCloseButton={true}
            className="w-full sm:w-[70vw] sm:max-w-[70vw] lg:max-w-[70vw] p-0 overflow-hidden flex flex-col bg-white border-l border-gray-300 shadow-2xl"
          >
            {selectedJob && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <JobDetailTabs
                  job={selectedJob}
                  onClose={handleCloseDetail}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Create Job Drawer */}
      <CreateJobDrawer
        open={showCreateDrawer}
        onOpenChange={setShowCreateDrawer}
      />
    </div>
  );
}

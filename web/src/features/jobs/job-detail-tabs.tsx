import { useNavigate, useSearchParams } from 'react-router-dom';
import { Job, useJobTasks } from '@/features/jobs/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { BoqTab } from '@/features/boq/boq-tab';

interface JobDetailTabsProps {
  job: Job;
  defaultTab?: string;
  onClose?: () => void;
}

export function JobDetailTabs({ job, defaultTab = 'task', onClose }: JobDetailTabsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;

  const { data: tasksData, isLoading: isLoadingTasks } = useJobTasks(job.id);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const taskCols: ColumnDef<any>[] = [
    { id: 'task_name', header: 'ชื่องาน', accessorKey: 'task_name' },
    { id: 'assigned_tech', header: 'ช่าง', accessorKey: 'assigned_tech', width: 150 },
    { id: 'plan_start_date', header: 'วันเริ่ม', accessorKey: 'plan_start_date', width: 120 },
    { id: 'plan_end_date', header: 'วันสิ้นสุด', accessorKey: 'plan_end_date', width: 120 },
  ];

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-soft overflow-hidden shadow-card">
      <div className="flex items-center justify-between p-4 border-b border-soft">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-text">{job.job_no}</span>
          <span className="text-text-secondary">·</span>
          <span className="text-sm text-text">{typeof job.customer === 'string' ? job.customer : job.customer?.name}</span>
          <span className="text-text-secondary">·</span>
          <StatusBadge status={job.status === 'QC_PENDING' ? 'PENDING' : job.status} />
        </div>
        <div className="flex items-center space-x-2">
          {onClose && (
            <Button variant="ghost" onClick={onClose} size="sm">ปิด</Button>
          )}
          <Button variant="secondary" onClick={() => navigate(`/jobs/${job.job_no}`)} size="sm">
            เปิดเต็มหน้า
          </Button>
          <Button variant="primary" size="sm">+ เพิ่มข้อมูล</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={tab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 border-b border-soft">
            <TabsList className="bg-transparent h-12">
              <TabsTrigger value="task" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                งาน/Task
              </TabsTrigger>
              <TabsTrigger value="boq" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                BOQ
              </TabsTrigger>
              <TabsTrigger value="log" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                บันทึกช่าง
              </TabsTrigger>
              <TabsTrigger value="qc" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                QC
              </TabsTrigger>
              <TabsTrigger value="finance" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                การเงิน
              </TabsTrigger>
              <TabsTrigger value="blueprint" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                แบบติดตั้ง
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                ประวัติ
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 p-4 overflow-auto">
            <TabsContent value="task" className="h-full m-0 data-[state=active]:flex flex-col">
              <DataGrid 
                columns={taskCols} 
                data={tasksData?.data || []} 
                isLoading={isLoadingTasks}
                getRowId={(row: any) => String(row.id)}
              />
            </TabsContent>
            <TabsContent value="boq" className="h-full m-0 data-[state=active]:flex flex-col">
              <BoqTab job={job} />
            </TabsContent>
            <TabsContent value="log" className="h-full m-0">
              <div className="text-sm text-text-secondary">ยังไม่มีข้อมูลบันทึกช่าง</div>
            </TabsContent>
            <TabsContent value="qc" className="h-full m-0">
              <div className="text-sm text-text-secondary">ยังไม่มีข้อมูล QC</div>
            </TabsContent>
            <TabsContent value="finance" className="h-full m-0">
              <div className="text-sm text-text-secondary">ยังไม่มีข้อมูลการเงิน</div>
            </TabsContent>
            <TabsContent value="blueprint" className="h-full m-0">
              <div className="text-sm text-text-secondary">ยังไม่มีข้อมูลแบบติดตั้ง</div>
            </TabsContent>
            <TabsContent value="history" className="h-full m-0">
              <div className="text-sm text-text-secondary">ยังไม่มีข้อมูลประวัติ</div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

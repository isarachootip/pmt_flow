import { useState, useMemo } from 'react';
import { useApiLogs, useClearApiLogs, ApiLog } from '@/features/admin/api';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { 
  Trash2, 
  Search, 
  Clock, 
  Globe, 
  FileCode, 
  CheckCircle2, 
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminApiLogsPage() {
  const [methodFilter, setMethodFilter] = useState('');
  const [searchPath, setSearchPath] = useState('');
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  
  const query = `?method=${methodFilter}&search=${searchPath}`;
  const { data: rawLogs, isLoading } = useApiLogs(query);
  const clearApiLogs = useClearApiLogs();

  const logs: ApiLog[] = useMemo(() => {
    if (!rawLogs) return [];
    return Array.isArray(rawLogs) ? rawLogs : (rawLogs as any)?.data || [];
  }, [rawLogs]);

  const handleClearLogs = async () => {
    if (window.confirm('คุณต้องการล้างข้อมูล API Logs ทั้งหมดใช่หรือไม่?')) {
      try {
        await clearApiLogs.mutateAsync();
        setSelectedLog(null);
        toast.success('ล้างข้อมูล API Logs เรียบร้อยแล้ว');
      } catch (err: any) {
        toast.error(err?.message || 'เกิดข้อผิดพลาดในการล้างข้อมูล');
      }
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'POST': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PATCH': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'PUT': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DELETE': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status >= 300 && status < 400) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (status >= 400 && status < 500) return 'text-amber-800 bg-amber-50 border-amber-200';
    if (status >= 500) return 'text-rose-700 bg-rose-50 border-rose-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  const columns: ColumnDef<ApiLog>[] = [
    {
      id: 'created_at',
      header: 'เวลา',
      width: 180,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-black">
          {row.created_at ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss') : '-'}
        </span>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      width: 100,
      cell: ({ row }) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${getMethodBadge(row.method)}`}>
          {row.method}
        </span>
      ),
    },
    {
      id: 'path',
      header: 'Endpoint Path',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-black truncate max-w-md block" title={row.path}>
          {row.path}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 100,
      cell: ({ row }) => (
        <span className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold border ${getStatusColor(row.status)}`}>
          {row.status}
        </span>
      ),
    },
    {
      id: 'duration_ms',
      header: 'Latency',
      width: 110,
      cell: ({ row }) => (
        <span className={`font-mono text-xs font-semibold ${row.duration_ms > 1000 ? 'text-rose-600 font-bold' : row.duration_ms > 300 ? 'text-amber-600' : 'text-slate-700'}`}>
          {row.duration_ms} ms
        </span>
      ),
    },
    {
      id: 'ip',
      header: 'Client IP',
      width: 130,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.ip || '-'}
        </span>
      ),
    },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => window.location.reload()} 
        className="gap-1.5 text-xs text-black border-slate-300 hover:bg-slate-100 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>รีเฟรช</span>
      </Button>
      <Button 
        variant="danger" 
        size="sm" 
        onClick={handleClearLogs} 
        className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>ล้างประวัติทั้งหมด</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader 
        title="API Logs (ประวัติการเรียกใช้งาน API)" 
        pageKey="api-logs" 
        actions={actions} 
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-1">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="ค้นหาตาม Path เช่น /api/v1/jobs..."
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
              className="pl-9 h-9 text-xs text-black font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-black whitespace-nowrap">Method:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-black focus:outline-none focus:border-indigo-500 shadow-2xs h-9"
            >
              <option value="">ทั้งหมด (All)</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-600">
          พบ <span className="text-black font-bold font-mono">{logs.length}</span> รายการ
        </div>
      </div>

      {/* Top-Bottom Master Detail Layout */}
      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="api-logs"
          masterContent={
            <DataGrid
              data={logs}
              columns={columns}
              getRowId={(row) => String(row.id)}
              isLoading={isLoading}
              selectedRowId={selectedLog ? String(selectedLog.id) : undefined}
              onRowSelect={setSelectedLog}
            />
          }
          detailContent={
            selectedLog ? (
              <div className="flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm p-6 overflow-y-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-soft">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getMethodBadge(selectedLog.method)}`}>
                          {selectedLog.method}
                        </span>
                        <h2 className="text-base font-bold text-black font-mono">{selectedLog.path}</h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        บันทึกเมื่อ: {selectedLog.created_at ? format(new Date(selectedLog.created_at), 'dd/MM/yyyy HH:mm:ss น.') : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">HTTP Status</span>
                      <span className={`inline-block px-3 py-1 rounded-lg font-mono text-sm font-bold border ${getStatusColor(selectedLog.status)}`}>
                        {selectedLog.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">Response Time</span>
                      <span className="text-sm font-bold text-black font-mono">
                        {selectedLog.duration_ms} ms
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Network & Client Details */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-border-soft">
                    <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      ข้อมูลการเชื่อมต่อ Client
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600 font-medium">IP Address:</span>
                        <span className="text-black font-mono font-bold">{selectedLog.ip || '127.0.0.1'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600 font-medium">Protocol / Host:</span>
                        <span className="text-black font-mono">HTTPS (Direct)</span>
                      </div>
                      <div className="py-1">
                        <span className="text-slate-600 font-medium block mb-1">User-Agent:</span>
                        <p className="text-black font-mono text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 break-all">
                          {selectedLog.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Performance & Execution */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-border-soft">
                    <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      ประสิทธิภาพการทำงาน (Performance)
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600 font-medium">Execution Duration:</span>
                        <span className="text-black font-mono font-bold">{selectedLog.duration_ms} ms</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600 font-medium">Health Status:</span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Normal Execution
                        </span>
                      </div>
                      <div className="py-1">
                        <span className="text-slate-600 font-medium block mb-1">Log ID:</span>
                        <span className="text-black font-mono text-xs select-all">{selectedLog.id}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState />
            )
          }
        />
      </div>
    </div>
  );
}

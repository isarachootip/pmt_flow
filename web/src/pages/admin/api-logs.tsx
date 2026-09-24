import { useState } from 'react';
import { useApiLogs, useClearApiLogs, ApiLog } from '@/features/admin/api';
import { format } from 'date-fns';

export default function AdminApiLogsPage() {
  const [methodFilter, setMethodFilter] = useState('');
  const [searchPath, setSearchPath] = useState('');
  
  // Construct query basic
  const query = `?method=${methodFilter}&search=${searchPath}`;
  const { data: logs, isLoading } = useApiLogs(query);
  const clearApiLogs = useClearApiLogs();

  const handleClearLogs = async () => {
    if (confirm('คุณต้องการล้างข้อมูล API Logs ทั้งหมดใช่หรือไม่?')) {
      await clearApiLogs.mutateAsync();
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-800';
      case 'POST': return 'bg-green-100 text-green-800';
      case 'PATCH': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">API Logs (Admin)</h1>
        <button onClick={handleClearLogs} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
          ล้างทั้งหมด
        </button>
      </div>

      <div className="flex gap-4">
        <select className="border border-gray-300 rounded-md p-2" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input 
          type="text" 
          placeholder="ค้นหา Path..." 
          className="border border-gray-300 rounded-md p-2 flex-1"
          value={searchPath}
          onChange={e => setSearchPath(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold">เวลา</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Path</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Duration (ms)</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log: ApiLog) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${getMethodColor(log.method)}`}>
                    {log.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={log.path}>
                  {log.path}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${getStatusColor(log.status)}`}>
                    {log.status}
                  </span>
                </td>
                <td className="px-4 py-3">{log.duration_ms} ms</td>
                <td className="px-4 py-3">{log.ip || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  ไม่มีข้อมูล API Logs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

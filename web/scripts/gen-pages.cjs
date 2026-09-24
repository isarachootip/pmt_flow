import fs from 'fs';
import path from 'path';

const pages = [
  { file: 'dashboard.tsx', title: 'แดชบอร์ด', key: 'dashboard' },
  { file: 'orders.tsx', title: 'รับงาน & คิวงาน', key: 'orders' },
  { file: 'tickets.tsx', title: 'Ticket & ใบเสร็จ', key: 'tickets' },
  { file: 'conversion.tsx', title: 'โปรเจกต์ & BOQ', key: 'conversion' },
  { file: 'gantt.tsx', title: 'แผนงาน Gantt', key: 'gantt' },
  { file: 'qc.tsx', title: 'ตรวจรับงาน QC', key: 'qc' },
  { file: 'completed.tsx', title: 'ปิดงาน & ส่ง STK', key: 'completed' },
  { file: 'blueprints.tsx', title: 'แบบติดตั้ง', key: 'blueprints' },
  { file: 'boq.tsx', title: 'คลัง BOQ กลาง', key: 'boq' },
  { file: 'ma.tsx', title: 'สัญญา MA', key: 'ma' },
  { file: 'reports.tsx', title: 'รายงาน', key: 'reports' },
  { file: 'admin/users.tsx', title: 'ผู้ใช้งาน', key: 'users' },
  { file: 'admin/api-logs.tsx', title: 'API Monitor', key: 'api-logs' },
  { file: 'admin/settings.tsx', title: 'ตั้งค่า', key: 'settings' },
  { file: 'km.tsx', title: 'KM คลังความรู้', key: 'km' },
];

const template = (title, key) => `import * as React from 'react';
import { Settings } from 'lucide-react';

export default function Page() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between border-b border-surface-border-soft pb-4">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface-card rounded-lg border border-surface-border shadow-card">
        <div className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center text-text-secondary mb-4">
          <Settings className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-medium text-text mb-2">อยู่ระหว่างพัฒนา</h2>
        <p className="text-sm text-text-secondary">โมดูล {title} จะเปิดให้ใช้งานในระยะถัดไป</p>
      </div>
    </div>
  );
}
`;

for (const p of pages) {
  const fullPath = path.join('c:\\atgv\\pmt_flow\\web\\src\\pages', p.file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, template(p.title, p.key));
}

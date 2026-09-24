import * as React from 'react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Checkbox,
  Switch,
  Skeleton,
  Badge,
  Card, CardHeader, CardTitle, CardContent,
  Separator,
  StatusBadge,
  KpiCard,
  EmptyState,
  PageHeader,
  KmLink,
  KpiChips,
  PipelineStepper,
} from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker24 } from '@/components/ui/time-picker-24';
import { Toolbar } from '@/components/ui/toolbar';
import { PhotoSlots5 } from '@/components/ui/photo-slots-5';
import { Toaster, toast } from 'sonner';
import { Search, Plus, Download, FileText } from 'lucide-react';

export function StyleguidePage() {
  const [dateVal, setDateVal] = React.useState<string>('');
  const [timeVal, setTimeVal] = React.useState('08:00');
  const [checked, setChecked] = React.useState(false);
  const [switchOn, setSwitchOn] = React.useState(false);
  const [activeChip, setActiveChip] = React.useState('all');

  return (
    <div className="min-h-screen bg-[var(--bg-subtle)] p-8">
      <Toaster position="top-right" richColors duration={4000} />
      <div className="mx-auto max-w-[1360px] space-y-12">

        <div>
          <h1 className="text-[32px] font-semibold leading-[40px] text-black">
            PMT Flow v2 — Styleguide
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Design System Components ทั้งหมดตาม 01_DESIGN_SYSTEM.md
          </p>
        </div>

        <Separator />

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="outline">Outline</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </Section>

        <Separator />

        <Section title="Input / Textarea / Label">
          <div className="grid max-w-md gap-4">
            <div>
              <Label htmlFor="demo-input">ชื่อลูกค้า</Label>
              <Input id="demo-input" placeholder="กรอกชื่อลูกค้า" />
            </div>
            <div>
              <Label htmlFor="demo-textarea">หมายเหตุ</Label>
              <Textarea id="demo-textarea" placeholder="หมายเหตุเพิ่มเติม" rows={3} />
            </div>
            <div>
              <Label>ค้นหา (พร้อมไอคอน)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-placeholder)]" />
                <Input className="pl-9" placeholder="ค้นหารหัสงาน / ลูกค้า" />
              </div>
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="Checkbox / Switch">
          <div className="flex items-center gap-8">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              ยืนยันข้อมูล
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
              เปิดใช้งาน
            </label>
          </div>
        </Section>

        <Separator />

        <Section title="Badge">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Separator />

        <Section title="StatusBadge (ตัวอักษรดำ + จุดสี)">
          <div className="flex flex-wrap gap-4">
            <StatusBadge status="PENDING" />
            <StatusBadge status="SURVEYED" />
            <StatusBadge status="IN_PROGRESS" />
            <StatusBadge status="DESIGNING" />
            <StatusBadge status="BOQ" />
            <StatusBadge status="DONE" />
            <StatusBadge status="QC_PASS" />
            <StatusBadge status="COMPLETED" />
            <StatusBadge status="OVERDUE" />
            <StatusBadge status="FAIL" />
            <StatusBadge status="REWORK" />
            <StatusBadge status="DRAFT" />
            <StatusBadge status="CANCELLED" />
            <StatusBadge status="CLOSED" />
          </div>
        </Section>

        <Separator />

        <Section title="KpiCard">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="งานใหม่" value={128} />
            <KpiCard label="ใหม่วันนี้" value={12} />
            <KpiCard label="รอนัด" value={7} />
            <KpiCard label="เลยกำหนด" value={3} onClick={() => toast.info('กรองงานเลยกำหนด')} />
          </div>
        </Section>

        <Separator />

        <Section title="KpiChips">
          <KpiChips
            chips={[
              { id: 'all', label: 'ทั้งหมด', count: 128 },
              { id: 'new', label: 'ใหม่วันนี้', count: 12 },
              { id: 'pending', label: 'รอนัด', count: 7 },
              { id: 'overdue', label: 'เลยกำหนด', count: 3 },
            ]}
            activeId={activeChip}
            onSelect={setActiveChip}
          />
        </Section>

        <Separator />

        <Section title="DatePicker (DD/MM/YYYY)">
          <div className="max-w-xs">
            <DatePicker value={dateVal} onChange={setDateVal} placeholder="DD/MM/YYYY" />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              ISO value: {dateVal || '(ว่าง)'}
            </p>
          </div>
        </Section>

        <Separator />

        <Section title="TimePicker24 (24 ชั่วโมง, ไม่มี AM/PM)">
          <div className="max-w-xs">
            <TimePicker24 value={timeVal} onChange={setTimeVal} />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Value: {timeVal}
            </p>
          </div>
        </Section>

        <Separator />

        <Section title="PageHeader (Hero Gradient)">
          <PageHeader
            title="รับงาน & คิวงาน"
            pageKey="orders"
            actions={
              <>
                <Button variant="secondary"><Download className="mr-2 h-4 w-4" />ส่งออก</Button>
                <Button><Plus className="mr-2 h-4 w-4" />สร้างงาน</Button>
              </>
            }
          />
        </Section>

        <Separator />

        <Section title="PipelineStepper">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Renovate (ขั้นที่ 3):</p>
              <PipelineStepper currentStep={3} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Quick Service (ขั้นที่ 5, ข้าม 2-4):</p>
              <PipelineStepper currentStep={5} quickService />
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="Toolbar">
          <Toolbar
            searchPlaceholder="ค้นหารหัสงาน / ลูกค้า / เบอร์โทร"
            filters={
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Renovate</Button>
                <Button variant="outline" size="sm">Quick</Button>
              </div>
            }
            actions={
              <Button variant="secondary" size="sm">
                <Download className="mr-1 h-3.5 w-3.5" />Export
              </Button>
            }
          />
        </Section>

        <Separator />

        <Section title="Card">
          <div className="grid max-w-lg gap-4">
            <Card>
              <CardHeader>
                <CardTitle>ข้อมูลลูกค้า</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">สมชาย ใจดี — 081-234-5678</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Separator />

        <Section title="PhotoSlots5 (5 ช่องรูปถ่าย)">
          <PhotoSlots5 />
        </Section>

        <Separator />

        <Section title="Skeleton">
          <div className="max-w-md space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-24 w-24 rounded-lg" />
              <Skeleton className="h-24 w-24 rounded-lg" />
              <Skeleton className="h-24 w-24 rounded-lg" />
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="EmptyState">
          <EmptyState
            icon={FileText}
            action={<Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />เพิ่มรายการ</Button>}
          />
        </Section>

        <Separator />

        <Section title="Toast (Sonner)">
          <div className="flex gap-3">
            <Button size="sm" onClick={() => toast.success('บันทึกสำเร็จ')}>Success</Button>
            <Button size="sm" variant="danger" onClick={() => toast.error('เกิดข้อผิดพลาด')}>Error</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.info('ข้อมูลอัปเดตแล้ว')}>Info</Button>
          </div>
        </Section>

        <Separator />

        <Section title="KmLink">
          <div className="flex items-center gap-4">
            <KmLink pageKey="orders" />
            <span className="text-sm text-[var(--text-secondary)]">คลิกเพื่อเปิด KM คลังความรู้</span>
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-[20px] font-semibold leading-7 text-black">{title}</h2>
      {children}
    </section>
  );
}

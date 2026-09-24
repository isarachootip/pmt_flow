import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckCircle2, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatDateTimeDMY } from './lib/date';
import { StyleguidePage } from './pages/styleguide';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function HomePage() {
  const currentTime = new Date();

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col font-sans">
      {/* Topbar */}
      <header className="h-[64px] border-b border-surface-border px-8 flex items-center justify-between bg-surface-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-semibold text-base shadow-sm">
            P
          </div>
          <span className="font-semibold text-lg text-text tracking-tight">PMT Flow v2</span>
          <span className="text-xs px-2 py-0.5 rounded-pill bg-primary-soft text-primary font-medium">
            Foundation Phase 1
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-text">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <Clock className="w-3.5 h-3.5 text-primary" />
            เวลาปัจจุบัน (24 ชม.): <strong className="text-text tabular-nums">{formatDateTimeDMY(currentTime)} น.</strong>
          </span>
          <div className="h-4 w-px bg-surface-border" />
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-st-done"></span>
            สถานะระบบ: <span className="font-semibold">พร้อมใช้งาน (Online)</span>
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 bg-hero-gradient p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl bg-surface-card p-10 rounded-lg shadow-card border border-surface-border-soft flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary-soft flex items-center justify-center text-primary mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h1 className="text-3xl font-semibold text-text mb-3 tracking-tight">
            PMT Flow v2
          </h1>

          <p className="text-base text-text-secondary mb-8 max-w-lg leading-relaxed">
            ระบบบริหารจัดการโครงการร้านค้าเวอร์ชันใหม่ (Next-Generation SPMT) สถาปัตยกรรม React 18, TypeScript, Tailwind CSS, และ TanStack Query
          </p>

          {/* Tokens & Standards Verification Grid */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
            <div className="p-4 rounded-md border border-surface-border bg-surface-subtle">
              <span className="text-xs text-text-secondary font-medium block mb-1">มาตรฐานวันที่ & เวลา</span>
              <p className="text-sm font-semibold text-text">DD/MM/YYYY (24h)</p>
              <p className="text-xs text-text-secondary mt-1">ไม่มี AM/PM 100%</p>
            </div>

            <div className="p-4 rounded-md border border-surface-border bg-surface-subtle">
              <span className="text-xs text-text-secondary font-medium block mb-1">ธีมการแสดงผล</span>
              <p className="text-sm font-semibold text-text">Pure Light Theme</p>
              <p className="text-xs text-text-secondary mt-1">ตัวหนังสือสีดำ #000000</p>
            </div>

            <div className="p-4 rounded-md border border-surface-border bg-surface-subtle">
              <span className="text-xs text-text-secondary font-medium block mb-1">สถานะระบบ Backend</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-st-done"></span>
                <span className="text-sm font-semibold text-text">Connected</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">API /api/v1/*</p>
            </div>
          </div>

          {/* Status Dot Samples */}
          <div className="w-full p-4 rounded-md border border-surface-border-soft mb-8 bg-surface-card">
            <span className="text-xs text-text-secondary block mb-3 font-medium text-left">
              ตัวอย่างจุดสีสถานะตาม Design System (ตัวอักษรสีดำ + จุดสีเล็ก 8px)
            </span>
            <div className="flex flex-wrap gap-4 items-center">
              <span className="flex items-center gap-2 text-xs font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-st-pending"></span>
                รอดำเนินการ
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-st-progress"></span>
                กำลังดำเนินการ
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-st-done"></span>
                ผ่านการตรวจ QC
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-st-rework"></span>
                ต้องแก้ไขงาน
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-text">
                <span className="w-2 h-2 rounded-full bg-st-overdue"></span>
                ล่าช้ากว่ากำหนด
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="px-5 py-2.5 rounded-sm border border-surface-border bg-surface-card hover:bg-surface-subtle text-text font-medium text-sm transition flex items-center gap-2"
            >
              กลับสู่ระบบเดิม (v1)
            </a>
            <Link
              to="/test-route"
              className="px-5 py-2.5 rounded-sm bg-primary hover:bg-primary-hover text-text-on-primary font-medium text-sm transition shadow-sm flex items-center gap-2"
            >
              ทดสอบ SPA Route <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-surface-border px-8 flex items-center justify-between text-xs text-text-secondary bg-surface-card">
        <span>Store Project Management Tool (SPMT) — PMT Flow v2.0</span>
        <span className="tabular-nums">Phase 1 Foundation · Build Verified</span>
      </footer>
    </div>
  );
}

function TestRoutePage() {
  return (
    <div className="min-h-screen bg-surface-bg p-12 font-sans flex flex-col items-center justify-center">
      <div className="max-w-md bg-surface-card p-8 rounded-lg border border-surface-border shadow-card text-center">
        <div className="w-12 h-12 rounded-full bg-primary-soft text-primary mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-text mb-2">ทดสอบ SPA Routing สำเร็จ</h2>
        <p className="text-sm text-text-secondary mb-6">
          เส้นทางนี้พิสูจน์ว่า Client-side routing และ Express SPA fallback ทำงานถูกต้อง ไม่เกิด 404 เมื่อรีเฟรชหน้าจอ
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-text-on-primary text-sm font-medium hover:bg-primary-hover transition"
        >
          กลับหน้าหลัก v2
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/v2">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/styleguide" element={<StyleguidePage />} />
          <Route path="/test-route" element={<TestRoutePage />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

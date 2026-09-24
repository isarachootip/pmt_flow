import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-surface-bg font-sans flex-1">
      <div className="w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center text-text-secondary mb-6">
        <Lock className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-semibold text-text mb-6">ไม่มีสิทธิ์เข้าถึง</h1>
      <Button variant="secondary" onClick={() => navigate('/dashboard')}>
        กลับหน้าหลัก
      </Button>
    </div>
  );
}

import { getBangkokTodayISO } from './orders-overdue';

export type DatePreset = 'today' | '7d' | 'this_month' | 'custom' | 'all';

export function getPresetDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  const today = getBangkokTodayISO();
  const [y, m, d] = today.split('-').map(Number);

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case '7d': {
      const dPast = new Date(Date.UTC(y, m - 1, d - 6));
      const startISO = `${dPast.getUTCFullYear()}-${String(dPast.getUTCMonth() + 1).padStart(2, '0')}-${String(dPast.getUTCDate()).padStart(2, '0')}`;
      return { startDate: startISO, endDate: today };
    }
    case 'this_month': {
      const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
      // Last day of month
      const lastDate = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
      return { startDate: firstDay, endDate: lastDay };
    }
    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
  }
}

export interface OrdersDatePresetsProps {
  currentPreset: DatePreset;
  onSelectPreset: (preset: DatePreset) => void;
}

export function OrdersDatePresets({ currentPreset, onSelectPreset }: OrdersDatePresetsProps) {
  const presets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'วันนี้' },
    { id: '7d', label: '7 วัน' },
    { id: 'this_month', label: 'เดือนนี้' }
  ];

  return (
    <div className="flex items-center gap-1">
      {presets.map(p => {
        const isActive = currentPreset === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPreset(isActive ? 'all' : p.id)}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-all cursor-pointer ${
              isActive
                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                : 'bg-gray-100 text-black border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

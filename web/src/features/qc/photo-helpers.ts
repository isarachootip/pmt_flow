import { PhotoSlot } from './qc-inspection-form';

export interface AggregatePhotoOptions {
  isQuick: boolean;
  initialPhotos?: any[];
  dailyLogs?: any[];
  selectedLogId?: string | number | null;
}

export interface AggregatedEvidenceResult {
  photoSlots: PhotoSlot[];
  source: string;
  sourceType: 'daily_log' | 'intake' | 'empty';
  logInfo?: {
    logId: string | number;
    dayNumber: number;
    logDate?: string;
    techName?: string;
  };
  totalAvailableLogs: number;
}

export const STANDARD_SLOT_DEFINITIONS: { id: string; label: string }[] = [
  { id: 'before', label: '1. ก่อนเริ่ม (Before)' },
  { id: 'progress1', label: '2. ระหว่างทำ #1' },
  { id: 'progress2', label: '3. ระหว่างทำ #2' },
  { id: 'test', label: '4. ทดสอบความปลอดภัย' },
  { id: 'after', label: '5. งานเสร็จสมบูรณ์' },
];

/**
 * Aggregates and consolidates evidence photos from either Quick job intake photos
 * or Renovate daily technician logs into standard 5 slots for QC inspection.
 */
export function aggregateQcEvidencePhotos(options: AggregatePhotoOptions): AggregatedEvidenceResult {
  const { isQuick, initialPhotos = [], dailyLogs = [], selectedLogId } = options;

  const baseSlots: PhotoSlot[] = STANDARD_SLOT_DEFINITIONS.map(def => ({
    id: def.id,
    label: def.label,
    url: undefined,
  }));

  // 1. Quick Services: Source from initialPhotos (Job photos submitted via Active Workspace)
  if (isQuick) {
    let populatedCount = 0;
    if (Array.isArray(initialPhotos) && initialPhotos.length > 0) {
      initialPhotos.forEach((p: any, idx: number) => {
        const url = typeof p === 'string' ? p : (p?.url || p?.dataUrl);
        if (!url) return;
        const targetId = p?.slot_id || p?.tag || baseSlots[idx]?.id;
        const targetSlot = baseSlots.find(s => s.id === targetId);
        if (targetSlot) {
          targetSlot.url = url;
          populatedCount++;
        } else if (baseSlots[idx]) {
          baseSlots[idx].url = url;
          populatedCount++;
        }
      });
    }

    return {
      photoSlots: baseSlots,
      source: populatedCount > 0 ? 'รูปถ่ายจากหน้างาน Quick Service (Active Workspace)' : 'รอช่างอัปโหลดภาพ',
      sourceType: populatedCount > 0 ? 'intake' : 'empty',
      totalAvailableLogs: 0,
    };
  }

  // 2. Renovate Projects: Source from Daily Technician Work Logs
  const logsWithPhotos = Array.isArray(dailyLogs)
    ? dailyLogs.filter(l => Array.isArray(l.photos) && l.photos.length > 0)
    : [];

  if (logsWithPhotos.length > 0) {
    let chosenLog = logsWithPhotos[0];
    if (selectedLogId !== undefined && selectedLogId !== null) {
      const found = logsWithPhotos.find(l => String(l.id) === String(selectedLogId));
      if (found) chosenLog = found;
    } else {
      // Prioritize completed log or latest day number
      const sorted = [...logsWithPhotos].sort((a, b) => {
        if (a.is_completed && !b.is_completed) return -1;
        if (!a.is_completed && b.is_completed) return 1;
        const dayDiff = (Number(b.day_number) || 0) - (Number(a.day_number) || 0);
        if (dayDiff !== 0) return dayDiff;
        return new Date(b.log_date || 0).getTime() - new Date(a.log_date || 0).getTime();
      });
      chosenLog = sorted[0];
    }

    if (Array.isArray(chosenLog.photos)) {
      chosenLog.photos.forEach((p: any, idx: number) => {
        const url = typeof p === 'string' ? p : (p?.url || p?.dataUrl);
        if (!url) return;
        const targetId = p?.slot_id || p?.tag || baseSlots[idx]?.id;
        const targetSlot = baseSlots.find(s => s.id === targetId);
        if (targetSlot) {
          targetSlot.url = url;
        } else if (baseSlots[idx]) {
          baseSlots[idx].url = url;
        }
      });
    }

    return {
      photoSlots: baseSlots,
      source: `บันทึกงานช่างประจำวัน (วันที่ ${chosenLog.day_number || 1}) - ${chosenLog.technician_name || 'ช่างหน้างาน'}`,
      sourceType: 'daily_log',
      logInfo: {
        logId: chosenLog.id,
        dayNumber: Number(chosenLog.day_number) || 1,
        logDate: chosenLog.log_date,
        techName: chosenLog.technician_name,
      },
      totalAvailableLogs: logsWithPhotos.length,
    };
  }

  // Fallback: If Renovate job has no daily logs yet, check initialPhotos
  let fallbackCount = 0;
  if (Array.isArray(initialPhotos) && initialPhotos.length > 0) {
    initialPhotos.forEach((p: any, idx: number) => {
      const url = typeof p === 'string' ? p : (p?.url || p?.dataUrl);
      if (!url) return;
      const targetId = p?.slot_id || p?.tag || baseSlots[idx]?.id;
      const targetSlot = baseSlots.find(s => s.id === targetId);
      if (targetSlot) {
        targetSlot.url = url;
        fallbackCount++;
      } else if (baseSlots[idx]) {
        baseSlots[idx].url = url;
        fallbackCount++;
      }
    });
  }

  return {
    photoSlots: baseSlots,
    source: fallbackCount > 0 ? 'รูปถ่ายเริ่มต้นโครงการ (Intake Photos)' : 'ยังไม่มีบันทึกรูปภาพจากหน้างาน',
    sourceType: fallbackCount > 0 ? 'intake' : 'empty',
    totalAvailableLogs: 0,
  };
}

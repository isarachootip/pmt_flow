# 🚨 PMT Flow Issue & Troubleshooting Skill Manual (`pmt_flow_issue_skill.md`)
> **คู่มือบันทึกปัญหา การวิเคราะห์สาเหตุ และแนวทางแก้ไขเชิงระบบ (PMT Flow Issue & Diagnostic Skill Guide)**  
> เอกสารนี้รวบรวมปัญหาสำคัญที่เกิดขึ้นจริงในระบบ PMT Flow พร้อม Root Cause Analysis, โค้ดที่เกี่ยวข้อง และแนวทางแก้ไขเพื่อเป็นมาตรฐานการพัฒนาและการทำงานร่วมกัน

---

## 📋 สารบัญปัญหาสำคัญ (Issue Index)

1. [Issue #1: Fatal Syntax Error ใน `public/js/app.js` (หน้าจอค้าง / แดชบอร์ดเป็น 0)](#issue-1-fatal-syntax-error-ใน-publicjsappjs)
2. [Issue #2: Authentication Session & Password Hash Mismatch (401 Unauthorized)](#issue-2-authentication-session--password-hash-mismatch)
3. [Issue #3: Stale Browser Cache (ผู้ใช้ยังโหลดสคริปต์เก่าค้างในแคช)](#issue-3-stale-browser-cache)
4. [Issue #4: ปุ่ม QC (ตรวจประเมิน QC) ไม่ตอบสนองเมื่อกด](#issue-4-ปุ่ม-qc-ตรวจประเมิน-qc-ไม่ตอบสนองเมื่อกด)
5. [Issue #5: บันทึกปิดงาน QC / บันทึกแบบร่างไม่ได้ ขึ้นแจ้งเตือน "คงเหลือ 1 ข้อ" ทั้งที่หน้าจอติ๊ก Yes 100% แล้ว](#issue-5-บันทึกปิดงาน-qc--บันทึกแบบร่างไม่ได้-ขึ้นแจ้งเตือน-คงเหลือ-1-ข้อ-ทั้งที่หน้าจอติ๊ก-yes-100-แล้ว)

---

## 🔴 Issue #5: บันทึกปิดงาน QC / บันทึกแบบร่างไม่ได้ ขึ้นแจ้งเตือน "คงเหลือ 1 ข้อ" ทั้งที่หน้าจอติ๊ก Yes 100% แล้ว
**วันที่พบ:** 23/09/2026  
**ขอบเขต:** Step 5 การตรวจรับรองคุณภาพ QC (`modal-qc-job-detail` & `approveCurrentJobToSTK`)

### 1. อาการที่พบ (Symptoms)
- ผู้ใช้เปิดแบบฟอร์มตรวจรับรองมาตรฐาน QC ของงาน Quick Service (เช่น งานติดตั้งเครื่องทำน้ำอุ่น/น้ำร้อน)
- ผู้ใช้คลิกปุ่ม **"✓ Yes — ผ่านเกณฑ์ (5.0 คะแนนเต็ม)"**
- หน้าจอแสดงผลว่าทำแบบประเมินครบถ้วน:
  - ความคืบหน้า: **100%** (แถบสีเขียวเต็ม)
  - ป้ายสถานะ: `✓ ประเมินครบ 1 ข้อ (ผ่านเกณฑ์ 100%)`
  - คะแนนเฉลี่ยรวม: `5.0 / 5.0 คะแนน`
  - รายการคำถาม: แสดงป้ายสีเขียว `ผ่านเกณฑ์มาตรฐานรอบแรก (ได้ 5.0 คะแนนเต็ม)`
  - ปุ่มส่งผลตรวจด้านล่างขวาเปลี่ยนสถานะเป็นเปิดใช้งาน: `✓ บันทึกปิดงาน & อนุมัติผ่านเกณฑ์ QC (5.0 คะแนน) & ส่งข้อมูลไป STK`
- **ปัญหา:** เมื่อคลิกปุ่ม "✓ บันทึกปิดงาน & อนุมัติผ่านเกณฑ์ QC" หน้าจอกลับแสดงกล่องข้อความเตือนสีส้มที่มุมขวาล่าง:
  > `⚠️ ไม่สามารถส่งผลตรวจไป STK ได้: กรุณาประเมินและให้คะแนนงานย่อยให้ครบทุกข้อก่อน (คงเหลือ 1 ข้อ)`
- ทำให้ระบบบล็อกการอนุมัติปิดงาน และไม่สามารถส่งผลตรวจไปยังระบบ STK ได้

---

### 2. การวิเคราะห์สาเหตุที่แท้จริง (Root Cause Analysis)

#### 2.1 ขาดการ Auto-save (PATCH) ลงฐานข้อมูลเซิร์ฟเวอร์
- เมื่อผู้ใช้คลิกเลือกปุ่ม **"Yes"** ในฟังก์ชัน `setQCSubtaskAnswer(jobId, subtaskId, answer)` ระบบทำการบันทึกข้อมูลเฉพาะในตัวแปรหน่วยความจำเบราว์เซอร์ (`DB.jobs`) และเรียก `this.persistJobs()`
- **จุดบกพร่อง:** ไม่มีการเรียกคำสั่ง `fetch('/api/v1/jobs/' + job.id, { method: 'PATCH', ... })` เพื่อส่งข้อมูลผลการตรวจ `qc_subtasks` ไปบันทึกลงฐานข้อมูล PostgreSQL
- ทำให้ในตาราง `core_jobs` บนฐานข้อมูลจริง คอลัมน์ `qc_subtasks` ยังคงเป็น `[]` (ว่างเปล่า) ตลอดเวลา

#### 2.2 Background Polling ล้างทับข้อมูลในหน่วยความจำกลางอากาศ (Race Condition)
- ระบบ PMT Flow มีกลไก Real-time Sync ดึงข้อมูลล่าสุดผ่าน `setInterval` ทุก 15 วินาที และบน Event `visibilitychange` (เมื่อผู้ใช้สลับหน้าต่างหรือสลับแท็บเบราว์เซอร์กลับมา) ผ่านฟังก์ชัน `fetchJobsFromApi()`
- ในฟังก์ชัน `fetchJobsFromApi()` มีการรวมข้อมูล (Merge) ระหว่างข้อมูลเดิมในเครื่อง (`existing`) กับข้อมูลสดจากเซิร์ฟเวอร์ (`incoming`)
- **จุดบกพร่อง:** ฟังก์ชัน Merge มีการป้องกันเฉพาะ `boq_items`, `photos`, และ `tasks` **แต่ไม่มีการป้องกันฟิลด์ `qc_subtasks`, `qc_remarks`, `qc_inspector`, `qc_history`**
- เมื่อเซิร์ฟเวอร์ส่ง `incoming` ที่มี `qc_subtasks: []` กลับมา ตัวแปร `merged` จึงนำค่าว่างมาเขียนทับข้อมูลผลการตรวจใน `DB.jobs`
- แต่เนื่องจากโมดอลไม่ได้ถูกสั่ง Re-render ผู้ใช้จึงยังมองเห็นหน้าจอเป็นสีเขียว 100% ตามเดิม

#### 2.3 ตรวจสอบความถูกต้องล้มเหลวใน `approveCurrentJobToSTK()`
- เมื่อผู้ใช้กดปุ่ม "บันทึกปิดงาน" ฟังก์ชัน `approveCurrentJobToSTK()` จะดึงงานจากหน่วยความจำ: `const job = this.getJob(jobId)`
- ซึ่ง `job.qc_subtasks` ในหน่วยความจำเพิ่งถูก Background Sync ล้างเป็น `[]` ไปเรียบร้อยแล้ว
- เมื่อส่งเข้า `calculateJobQCProgress(job)` ระบบพบว่าไม่มีข้อที่ประเมิน (`completed: 0`, `total: 1`) จึงเข้าเงื่อนไข:
  ```javascript
  if (!progress.isAllComplete) {
      this.showToast(`⚠️ ไม่สามารถส่งผลตรวจไป STK ได้: กรุณาประเมินและให้คะแนนงานย่อยให้ครบทุกข้อก่อน (คงเหลือ ${progress.total - progress.completed} ข้อ)`);
      return;
  }
  ```
- ผลคือ `progress.total - progress.completed` เท่ากับ `1 - 0 = 1 ข้อ` ทำให้แสดงข้อความแจ้งเตือนบล็อกผู้ใช้ตามภาพ

---

### 3. แนวทางการแก้ไขอย่างสมบูรณ์ (Implemented Fixes)

#### 1) เพิ่มตัวล็อกป้องกัน (Preserve QC State) ใน `fetchJobsFromApi()`
ใน [`public/js/app.js`](file:///c:/atgv/pmt_flow/public/js/app.js) ป้องกันไม่ให้ Background Polling นำค่าว่างมาทับข้อมูลผลตรวจเดิม:
```javascript
const preservedQcSubtasks = (existing.qc_subtasks && existing.qc_subtasks.length > 0 && (!incoming.qc_subtasks || incoming.qc_subtasks.length === 0 || !incoming.qc_subtasks.some(s => s.answer)))
    ? existing.qc_subtasks
    : (incoming.qc_subtasks && incoming.qc_subtasks.length > 0 ? incoming.qc_subtasks : (existing.qc_subtasks || []));

const preservedQcHistory = (existing.qc_history && existing.qc_history.length > 0 && (!incoming.qc_history || incoming.qc_history.length === 0))
    ? existing.qc_history
    : (incoming.qc_history || existing.qc_history || []);

const preservedQcRemarks = existing.qc_remarks || incoming.qc_remarks || '';
const preservedQcInspector = existing.qc_inspector || incoming.qc_inspector || '';

// ล็อกป้องกันเป็นพิเศษสำหรับใบงานที่กำลังเปิดหน้าฟอร์ม QC Modal อยู่ในขณะนั้น
const activeQCModalId = this.state.currentQCModalJobId;
if (activeQCModalId && (String(activeQCModalId) === key || String(activeQCModalId) === String(existing.job_no))) {
    merged.qc_subtasks = existing.qc_subtasks || preservedQcSubtasks;
    merged.qc_remarks = existing.qc_remarks !== undefined ? existing.qc_remarks : preservedQcRemarks;
    merged.qc_inspector = existing.qc_inspector !== undefined ? existing.qc_inspector : preservedQcInspector;
    merged.qc_history = existing.qc_history || preservedQcHistory;
}
```

#### 2) เพิ่ม Auto-save (PATCH) ทันทีที่เลือกคำตอบ
ใน `setQCSubtaskAnswer`, `setAllQCSubtasksYes`, และ `saveCurrentQCSubtasksDraft` ให้ยิง PATCH ไปยังเซิร์ฟเวอร์ทันที:
```javascript
fetch(`/api/v1/jobs/${job.id}`, {
    method: 'PATCH',
    headers: this.getAuthHeaders(),
    body: JSON.stringify({ qc_subtasks: job.qc_subtasks })
}).catch(err => console.warn('PATCH qc_subtasks error:', err));
```

#### 3) ระบบกู้คืนสำรองจากหน้าจอ (Defensive DOM Fallback)
ใน `approveCurrentJobToSTK()` ก่อนเรียก `calculateJobQCProgress(job)` หากพบว่าในหน่วยความจำคำตอบหลุดหายไป แต่บนหน้าจอผู้ใช้เลือก Yes/No ไว้อยู่แล้ว ให้ดึงค่าจาก DOM มาซิงค์กลับเข้าหน่วยความจำอัตโนมัติ:
```javascript
if (isQuick && subtasks.length > 0 && !subtasks[0].answer) {
    const btnYes = document.querySelector('#qc-subtasks-list button[onclick*="YES"]');
    const btnNo = document.querySelector('#qc-subtasks-list button[onclick*="NO"]');
    if (btnYes && (btnYes.classList.contains('bg-emerald-600') || btnYes.classList.contains('bg-amber-600'))) {
        subtasks[0].answer = 'YES';
        subtasks[0].status = 'PASSED';
        subtasks[0].score = 5;
    } else if (btnNo && btnNo.classList.contains('bg-rose-600')) {
        subtasks[0].answer = 'NO';
        subtasks[0].status = 'DEFECT';
        subtasks[0].score = 1;
    }
}
```

#### 4) บันทึกฟิลด์ QC ลง `localStorage` ใน `persistJobs()`
เพิ่ม `qc_subtasks`, `qc_remarks`, `qc_inspector`, และ `qc_history` ในโครงสร้าง `safeRecent` ของ `persistJobs()` เพื่อให้มีข้อมูลสำรองออฟไลน์และทนทานต่อการรีโหลด

---

## 🔍 Issue #1: Fatal Syntax Error ใน `public/js/app.js` (พบบ่อยที่สุด ⭐⭐⭐)
- **สาเหตุ:** มีการประกาศตัวแปร `const` หรือ `let` ชื่อซ้ำกันใน Scope เดียวกัน หรือปิด `.map()` / Template Literal ไม่สมบูรณ์
- **ผลกระทบ:** V8 Engine ปฏิเสธการ Parse ไฟล์ `app.js` ทั้งหมด หน้าเว็บหยุดทำงาน โค้ด HTML แสดงผลแต่ดึงข้อมูลไม่ได้ แดชบอร์ดเป็น 0
- **การตรวจสอบ:** รัน `npm run check:syntax` หรือ `npm run build` เสมอก่อน Commit & Push

---

## 🔐 Issue #2: Authentication Session & Password Hash Mismatch (401 Unauthorized ⭐⭐)
- **สาเหตุ:** `password_hash` ในฐานข้อมูล `sys_users` ไม่ตรงกับ Hash มาตรฐาน หรือ Client ใช้ Demo Token ยิงเข้า Backend ที่มี Session Strict Guard
- **การตรวจสอบ:** ตรวจสอบตาราง `sys_users` ว่ารหัสผ่าน `Admin@1234` มี Hash ถูกต้อง: `$2a$12$demo_c59a12a1ba0eac0b1d6a778ce4c8eb76a6d3b8a983bb938407813f9c87fe7191`

---

## ⚡ Issue #3: Stale Browser Cache (เบราว์เซอร์แคชไฟล์เก่า ⭐)
- **สาเหตุ:** เซิร์ฟเวอร์อัปเดตไฟล์แล้ว แต่เบราว์เซอร์ผู้ใช้ยังคงรันไฟล์ JavaScript หรือ CSS จากแคชเดิม
- **การแก้ไข:** แนะนำให้กด `Ctrl + F5` (Windows) หรือ `Cmd + Shift + R` (Mac) และขยับเลขเวอร์ชัน `?v=x.x.x` ใน `index.html`

---

## 🟣 Issue #4: ปุ่ม QC (ตรวจประเมิน QC) ไม่ตอบสนองเมื่อกด (2026-09-22)
- **สาเหตุ:** `fetchQCJobsFromApi()` ส่งพารามิเตอร์ `status=qc` แทนที่จะเป็น `step=qc`, และฟังก์ชัน `renderQCHistorySection` ขาดตัวแปร `currentRound`, `isRound2Plus`
- **การแก้ไข:** ปรับพารามิเตอร์เป็น `step=qc` และประกาศตัวแปรให้ครบถ้วนใน helper function

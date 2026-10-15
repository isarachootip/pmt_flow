import{j as e,aQ as m,B as b,r as l,P as g,S as h,v as y,M as S,aI as f}from"./index-BODYMb1C.js";import{D as j}from"./data-grid-ChXokGYY.js";import{P as v}from"./printer-D2J_WF_F.js";const C=[{id:1,code:"KM-GEN-001",title:"คู่มือขั้นตอนการใช้งานระบบ PMT Flow v2 (สำหรับแอดมินและผู้จัดการ)",category:"General",updatedAt:"26/09/2026",summary:"ภาพรวมระบบ Pipeline 4 ขั้นตอน, การจัดการผู้ใช้, การกำหนดสิทธิ์ และการตรวจสอบ Logs",content:`
### 1. ภาพรวมของระบบ (System Overview)
ระบบ PMT Flow v2 ทำงานในรูปแบบ 4-Step Pipeline มาตรฐาน:
- **Step 1: รับงาน (Orders)** — รับคำสั่งซื้อใหม่และคิวงาน Active Queue (ทั้ง Quick Service และ Renovate)
- **Step 2: Project & Gantt** — แผนงานโครงการ Renovate (งาน R) พร้อมผัง Gantt Chart อัตโนมัติและบันทึกงานช่าง 24 ชม.
- **Step 3: ตรวจรับงาน QC (Quality Control)** — ตรวจรับงาน Online (งาน Q ประเมิน 1 ข้อจบกระบวนการ) และจองตรวจ On-site (งาน R)
- **Step 4: ปิดงาน (Job Completed)** — สรุปงานสำเร็จ ตรวจสอบภาพถ่าย 5 ขั้นตอน (Readonly) และส่งออก STK Outbound API

### 2. การจัดการสิทธิ์ผู้ใช้งาน (RBAC)
- **ADMIN**: สิทธิ์สูงสุด ดูแลผู้ใช้, ระบบ, และเข้าถึงทุกเมนู
- **AE (Account Executive)**: รับออเดอร์, จัดสรรงาน, ติดตามช่าง
- **QC**: ตรวจสอบคุณภาพงาน, อนุมัติ/ส่งแก้งาน
- **CONTACT_CENTER**: ดูแลข้อมูลลูกค้าและการรับเรื่องเบื้องต้น
    `},{id:2,code:"KM-OPS-002",title:"มาตรฐานการบันทึกงานช่างประจำวัน (Daily Technician Work Logs)",category:"Operation",updatedAt:"26/09/2026",summary:"กฎเกณฑ์การบันทึกเวลา 24 ชั่วโมง (00:00 - 23:59), การแนบรูปถ่าย 5 สล็อต และการสรุปผลงาน",content:`
### 1. กฎการบันทึกเวลาแบบ 24 ชั่วโมง (24-Hour Format Standard)
- ทุกการบันทึกเวลาปฏิบัติงานต้องใช้ระบบ **24 ชั่วโมง (00:00 - 23:59 น.)** เช่น \`08:30\`, \`13:00\`, \`17:45\`
- **ห้ามใช้ระบบ AM/PM โดยเด็ดขาด**

### 2. มาตรฐานการแนบรูปถ่าย 5 สล็อต (5-Photo Standard)
1. **รูปที่ 1 (ก่อนเริ่มงาน)**: สภาพพื้นที่เดิมก่อนลงมือปฏิบัติงาน
2. **รูปที่ 2 (ระหว่างปฏิบัติงาน 1)**: ขั้นตอนการรื้อถอนหรือติดตั้งท่อน้ำยา/ระบบไฟ
3. **รูปที่ 3 (ระหว่างปฏิบัติงาน 2)**: การล้าง/ติดตั้งคอยล์เย็นหรือแผงคอนเดนเซอร์
4. **รูปที่ 4 (หลังเสร็จสิ้น)**: สภาพงานที่ติดตั้งเรียบร้อยและทำความสะอาดพื้นที่
5. **รูปที่ 5 (ผลทดสอบระบบ)**: รูปวัดแรงดันน้ำยา (PSI) หรืออุณหภูมิหน้าช่องลม
    `},{id:3,code:"KM-QC-003",title:"เกณฑ์การตรวจประเมินคุณภาพงาน (QC Online & On-site Inspection)",category:"Quality",updatedAt:"26/09/2026",summary:"ขั้นตอนการตรวจแบบ 3 ระดับ (Project -> Area -> Task) และเงื่อนไขการอนุมัติ Pass/Rework",content:`
### 1. โครงสร้างการตรวจ QC 3 ระดับ
- **ระดับโครงการ (Project)**: ตรวจสอบความเรียบร้อยโดยรวมและการส่งมอบ
- **ระดับพื้นที่ (Area / Floor)**: ตรวจสอบตามห้องหรือโซนการทำงาน
- **ระดับงานย่อย (Task)**: ช่างต้องส่งรายงานและรูปถ่ายครบถ้วนก่อนส่งตรวจ QC

### 2. การตัดสินผลตรวจ
- **PASSED (ผ่าน)**: งานถูกต้องตามแบบแปลนและมาตรฐาน ไม่มีตำหนิ
- **NEEDS_REWORK (ต้องแก้ไข)**: พบข้อบกพร่อง ต้องระบุหมายเหตุและรูปภาพจุดที่ต้องแก้ไขอย่างชัดเจน เพื่อส่งกลับให้ช่างปรับปรุง

### 3. มาตรฐานแหล่งที่มาของรูปถ่ายตรวจ QC (Photo Sourcing Standard)
- **⚡ งานบริการด่วน (Quick Service - Online QC)**: ตรวจงานด่วนออนไลน์ ประเมินเกณฑ์มาตรฐาน 1 ข้อ โดยใช้รูปถ่ายที่แนบมากับใบงาน/รายงานปิดงานด่วน
- **🔨 งานโครงการปรับปรุง (Renovate - On-site QC)**: **รูปถ่ายตรวจส่งมอบงานหน้างาน (5 รูป) ต้องดึงมาจาก "บันทึกงานช่างประจำวัน (Daily Technician Work Logs)" ของช่างโดยตรง**
  - **รูปเดิมตอนรับงาน (Intake Photos — จาก Step 1)**: คงไว้เฉพาะในกล่องอ้างอิงสภาพพื้นที่เดิมเพื่อใช้เปรียบเทียบก่อน-หลัง (Before vs Handover) เท่านั้น
  - **รูปตรวจส่งมอบงานจริง (5 รูป)**: ดึงมาจากบันทึกประจำวันของช่างหน้างานผ่านปุ่ม \`⚡ ดึงรูปจากบันทึกงานช่าง\` หรือโหลดอัตโนมัติจากรอบบันทึกล่าสุด
  - ช่วยป้องกันการนำรูปรับงานเดิมมาแสดงซ้ำซ้อน และสะท้อนผลงานจริงที่ช่างส่งมอบ 100%
    `}],w=[{id:4,code:"KM-FIN-004",title:"ขั้นตอนการตัดสต็อกสินค้า (STK Export) และการปิดงานงวดบัญชี",category:"Finance",updatedAt:"26/09/2026",summary:"การตัดยอดวัสดุสิ้นเปลือง อะไหล่ และการส่งออกข้อมูลเข้าสู่ระบบบัญชี STK",content:`
### 1. การตรวจสอบรายการวัสดุและอุปกรณ์
- ตรวจสอบรายการของที่เบิกใช้จริงเทียบกับใบเสนอราคา (BOQ)
- ตรวจสอบความถูกต้องของรหัสสินค้า (SKU) และหน่วยนับ

### 2. การส่งออกไฟล์ STK (Export)
- เมื่อสถานะงานเป็น \`PASSED\` และได้รับการปิดงานใน Step 4
- กดปุ่ม **"ส่งออก STK"** เพื่อนำไฟล์เข้าสู่ระบบ ERP/บัญชีหลักของบริษัท
    `},{id:5,code:"KM-MA-005",title:"การบริหารจัดการสัญญาบริการบำรุงรักษา (MA Contracts & Service Cycles)",category:"MA",updatedAt:"26/09/2026",summary:"การสร้างสัญญารายปี, การกำหนดรอบบริการอัตโนมัติ (เช่น ทุก 3 เดือน) และการแจ้งเตือนงานล่วงหน้า",content:`
### 1. การจัดทำสัญญา MA
- บันทึกข้อมูลลูกค้า, หมายเลขสัญญา, วันที่เริ่มต้น - วันที่สิ้นสุด
- กำหนดความถี่การเข้าบริการ: ทุกเดือน, ทุก 2 เดือน, ทุก 3 เดือน หรือรายไตรมาส

### 2. การสร้างรอบบริการ (Service Cycles)
- ระบบจะ Generate รอบงานบำรุงรักษาล่วงหน้าให้อัตโนมัติ
- เมื่อถึงกำหนด ระบบจะแจ้งเตือนให้แปลงเป็นใบงานใน Step 2 จัดสรรงานทันที
    `},{id:6,code:"KM-OPS-006",title:"พื้นที่บันทึกข้อมูลหน้างาน (Active Input Workspace) และการส่งต่ออัตโนมัติ (Automated Routing)",category:"Operation",updatedAt:"26/09/2026",summary:"คู่มือการใช้งาน Active Input Workspace, แกลเลอรี PhotoSlots 5 สล็อตพร้อม Lightbox และกฎการเปลี่ยนสถานะอัตโนมัติ Quick -> QC / Renovate -> Gantt",content:`
### 1. ภาพรวมข้อมูลรายละเอียดงาน (Clean Grid View & Detail List)
- **Detail List ด้านบน**: ข้อมูลคำสั่งซื้อ ลูกค้า สถานที่ติดตั้ง และบริการ แสดงผลเป็นแถบตารางรายการกะทัดรัด ตัวหนังสือสีดำ 100% (#000000)
- **ตารางรายการย่อย (Grid View)**: แท็บ "งาน/Task" แสดงผลเป็นตาราง DataGrid โดยตรงทันที แสดงชื่องาน จำนวน ช่าง วันเริ่ม วันสิ้นสุด และหมายเหตุ

### 2. รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5)
- จัดวางอยู่ด้านล่างตารางรายการย่อย (Grid View) อย่างเป็นระเบียบ 5 สล็อตมาตรฐาน: ก่อนเริ่มงาน, ระหว่างทำ 1, ระหว่างทำ 2, ทดสอบระบบ, หลังเสร็จสิ้น
- **คลิกเพื่อขยายดูรูปขนาดเต็ม (Click-to-Expand)**: เมื่อคลิกที่รูปภาพ ระบบจะเปิด Lightbox Modal ขยายภาพคมชัดขนาดเต็มทันที

### 3. กฎการส่งต่องานอัตโนมัติตามประเภทงาน (Automated Workflow Routing)
- **⚡ งานด่วน (Quick Service)**: ปรับสถานะเป็น \`QC_PENDING\`, นำทางไปยังแท็บ QC (Step 3) ทันที
- **🏗️ งานรีโนเวท (Renovate)**: ตรวจสอบและเชื่อมโยงข้อมูล BOQ, นำทางไปยังผังโครงการ Gantt (Step 2) ทันที
    `},{id:7,code:"KM-TRANS-007",title:"สถาปัตยกรรม PMT Flow v2 ต่อเนื่องสมบูรณ์ (End-to-End Continuous V2) และแผนยุติ /legacy",category:"General",updatedAt:"01/10/2026",summary:"คู่มือกระบวนการทำงานไร้รอยต่อบน V2 ครบ 4 ขั้นตอน, ระบบ Deep-Linking ข้ามหน้าจอ, การรวบรวมรูปภาพอัตโนมัติ และแผนการปลดระวาง /legacy สู่ V2 ถาวร",content:`
### 1. เป้าหมายการเปลี่ยนผ่านสู่ V2 (V2 Continuity & Transition)
ระบบ PMT Flow v2 (React 18 + Vite + Tailwind CSS) พัฒนาขึ้นเพื่อทำงานต่อเนื่องครบทุกกระบวนการ โดยไม่ต้องสลับกลับไประบบเดิม:
- **Step 1: รับงาน (Orders)**: คิวงานใหม่ ตรวจสอบประเภทงาน Q/R และจัดช่าง
- **Step 2: Project & Gantt**: แผนผังงานโครงการ Renovate บันทึกงานช่าง 24 ชม. และตรวจสอบความคืบหน้า
- **Step 3: ตรวจรับงาน QC**: ตรวจ Online งานด่วน (1 ข้อจบ) และบันทึกผลตรวจ On-site
- **Step 4: ปิดงาน (Closed)**: สรุปผลงาน, ล็อกข้อมูล Readonly และตัดสต็อก STK Outbound

### 2. ระบบเชื่อมโยงข้ามขั้นตอนแบบไร้รอยต่อ (Seamless Deep-Linking & Auto-Selection)
- **URL Parameters**: ทุกหน้าจอรองรับการส่งพารามิเตอร์ \`?jobNo=...\` และ \`?jobId=...\`
- **ปุ่ม Quick Accept ➔ QC Jump**: เมื่อกดยอมรับงานด่วนใน Step 1 ระบบนำทางไปยัง \`/qc?type=quick&jobId=...&jobNo=...\` พร้อมเลือกใบงานให้อัตโนมัติทันที
- **ปุ่ม Renovate Plan ➔ Gantt Jump**: เมื่อคลิกดูแผนงาน ระบบนำทางไปยัง \`/gantt?jobNo=...&jobId=...&tab=tasks\` และดึงโครงการขึ้นมาในตารางและผัง Gantt ทันที แม้จะมีการกรองช่วงเวลาอยู่

### 3. มาตรฐานการรวมศูนย์รูปถ่าย 5 ขั้นตอน (Unified Photo Pipeline)
- **Quick Service (งานด่วน)**: รวมรูปถ่าย 5 สล็อตจาก Intake Photos ในการรับงาน เพื่อให้ QC ตรวจประเมินได้ทันที
- **Renovate (งานโครงการ)**: รวบรวมรูปถ่าย 5 สล็อตจากบันทึกงานช่างประจำวัน (Daily Technician Work Logs) รอบล่าสุด ป้องกันรูปรับงานเดิมปะปนกับรูปงานจริงที่ส่งมอบ
- **Lightbox Zoom**: ขยายดูรูปขนาดเต็มได้ทุกช่องเพื่อความชัดเจนสูงสุด

### 4. การปิดงานและตัดสต็อก (STK Outbound & Readonly Lock)
- เมื่อตรวจ QC ผ่านและปิดงานใน Step 4 ระบบจะส่งข้อมูลผ่าน STK Outbound API ไปยังคลังสินค้า
- ใบงานที่สถานะเป็น \`CLOSED\`, \`CLOSEJOB\` หรือ STK ตัดจ่ายแล้ว (\`DELIVERED\`) จะถูกล็อกเป็น Readonly อัตโนมัติ ป้องกันการแก้ไขรูปถ่ายหรือข้อมูลย้อนหลัง

### 5. แผนการปลดระวางระบบเดิม (/legacy Decommissioning Roadmap)
1. **ระยะทดสอบคู่ขนาน (Dual-Track Validation)**: ปัจจุบัน V2 เป็นระบบหลักที่เส้นทาง \`/\` โดยคง \`/legacy\` ไว้ชั่วคราวเพื่อเทียบเคียงข้อมูล
2. **ความสมบูรณ์ 100% บน V2**: เมื่อฟังก์ชันการทำงานทุกขั้นตอนใน V2 มีความต่อเนื่อง สมบูรณ์ และผ่านการทดสอบครอบคลุม 100%
3. **การปิดเส้นทาง /legacy**: ทำการ Redirect เส้นทาง \`/legacy\` และ \`/v1\` ทั้งหมดเข้าสู่ V2 เพื่อรวมศูนย์เป็นแพลตฟอร์มเดียวถาวร
    `}],x=[...C,...w];function N({article:a,getCategoryBadge:i}){return e.jsxs("div",{className:"flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm p-6 overflow-y-auto",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-soft",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold",children:e.jsx(m,{className:"w-5 h-5"})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`px-2.5 py-0.5 rounded-md text-xs font-bold border ${i(a.category)}`,children:a.category}),e.jsx("span",{className:"font-mono text-xs font-bold text-indigo-700",children:a.code})]}),e.jsx("h2",{className:"text-lg font-bold text-black mt-0.5",children:a.title})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-xs text-slate-500 font-mono",children:["ปรับปรุงเมื่อ: ",a.updatedAt]}),e.jsxs(b,{variant:"outline",size:"sm",onClick:()=>window.print(),className:"gap-1.5 text-xs text-black border-slate-300 cursor-pointer",children:[e.jsx(v,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"พิมพ์คู่มือ"})]})]})]}),e.jsxs("div",{className:"py-4 space-y-4 max-w-4xl",children:[e.jsxs("div",{className:"bg-slate-50 p-3.5 rounded-xl border border-slate-200",children:[e.jsx("span",{className:"text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1",children:"สรุปใจความสำคัญ (Summary)"}),e.jsx("p",{className:"text-xs font-semibold text-black leading-relaxed",children:a.summary})]}),e.jsx("div",{className:"prose prose-sm text-black space-y-3 leading-relaxed whitespace-pre-line text-xs font-medium",children:a.content})]})]})}function R(){const[a,i]=l.useState(""),[s,o]=l.useState("ALL"),[n,p]=l.useState(x[0]),d=l.useMemo(()=>x.filter(t=>{if(s!=="ALL"&&t.category!==s)return!1;if(a.trim()){const r=a.toLowerCase();return t.title.toLowerCase().includes(r)||t.code.toLowerCase().includes(r)||t.summary.toLowerCase().includes(r)||t.content.toLowerCase().includes(r)}return!0}),[a,s]),c=t=>{switch(t){case"General":return"bg-blue-100 text-blue-800 border-blue-200";case"Operation":return"bg-emerald-100 text-emerald-800 border-emerald-200";case"Quality":return"bg-purple-100 text-purple-800 border-purple-200";case"Finance":return"bg-amber-100 text-amber-800 border-amber-200";case"MA":return"bg-cyan-100 text-cyan-800 border-cyan-200";default:return"bg-slate-100 text-slate-800 border-slate-200"}},u=[{id:"code",header:"รหัสคู่มือ",width:120,cell:({row:t})=>e.jsx("span",{className:"font-mono text-xs font-bold text-indigo-700",children:t.code})},{id:"title",header:"ชื่อบทความ / คู่มือการปฏิบัติงาน",cell:({row:t})=>e.jsxs("div",{children:[e.jsx("span",{className:"font-bold text-xs text-black block",children:t.title}),e.jsx("span",{className:"text-[11px] text-slate-500 line-clamp-1",children:t.summary})]})},{id:"category",header:"หมวดหมู่",width:110,cell:({row:t})=>e.jsx("span",{className:`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${c(t.category)}`,children:t.category})},{id:"updatedAt",header:"ปรับปรุงล่าสุด",width:120,cell:({row:t})=>e.jsx("span",{className:"font-mono text-xs text-black",children:t.updatedAt})}];return e.jsxs("div",{className:"flex flex-col h-full bg-subtle p-2.5 overflow-hidden",children:[e.jsx(g,{title:"คลังความรู้ (Knowledge Management)",pageKey:"km"}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-1 min-w-[300px]",children:[e.jsxs("div",{className:"relative flex-1 max-w-md",children:[e.jsx(h,{className:"absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"}),e.jsx(y,{placeholder:"ค้นหาคู่มือ, ขั้นตอนการทำงาน, รหัส KM...",value:a,onChange:t=>i(t.target.value),className:"pl-9 h-9 text-xs text-black font-medium"})]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("button",{type:"button",onClick:()=>o("ALL"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="ALL"?"bg-black text-white shadow-xs":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,children:"ทั้งหมด"}),e.jsx("button",{type:"button",onClick:()=>o("General"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="General"?"bg-blue-600 text-white shadow-xs":"bg-blue-50 text-blue-700 hover:bg-blue-100"}`,children:"General"}),e.jsx("button",{type:"button",onClick:()=>o("Operation"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Operation"?"bg-emerald-600 text-white shadow-xs":"bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`,children:"Operation"}),e.jsx("button",{type:"button",onClick:()=>o("Quality"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Quality"?"bg-purple-600 text-white shadow-xs":"bg-purple-50 text-purple-800 hover:bg-purple-100"}`,children:"Quality"}),e.jsx("button",{type:"button",onClick:()=>o("Finance"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Finance"?"bg-amber-600 text-white shadow-xs":"bg-amber-50 text-amber-900 hover:bg-amber-100"}`,children:"Finance"}),e.jsx("button",{type:"button",onClick:()=>o("MA"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="MA"?"bg-cyan-600 text-white shadow-xs":"bg-cyan-50 text-cyan-800 hover:bg-cyan-100"}`,children:"MA"})]})]}),e.jsxs("div",{className:"text-xs font-semibold text-slate-600",children:["พบ ",e.jsx("span",{className:"text-black font-bold font-mono",children:d.length})," บทความ"]})]}),e.jsx("div",{className:"flex-1 min-h-0 mt-2",children:e.jsx(S,{pageKey:"km",masterContent:e.jsx(j,{data:d,columns:u,getRowId:t=>String(t.id),selectedRowId:n?String(n.id):void 0,onRowSelect:p}),detailContent:n?e.jsx(N,{article:n,getCategoryBadge:c}):e.jsx(f,{})})})]})}export{R as default};

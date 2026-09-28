import{r as l,j as e,P as u,S as b,I as h,M as g,aB as y,B as f,at as j}from"./index-Chx4zTr0.js";import{D as S}from"./data-grid-BmAV4uvV.js";import{P as v}from"./printer-DI-rutoI.js";const d=[{id:1,code:"KM-GEN-001",title:"คู่มือขั้นตอนการใช้งานระบบ PMT Flow v2 (สำหรับแอดมินและผู้จัดการ)",category:"General",updatedAt:"26/09/2026",summary:"ภาพรวมระบบ Pipeline 5 ขั้นตอน, การจัดการผู้ใช้, การกำหนดสิทธิ์ และการตรวจสอบ Logs",content:`
### 1. ภาพรวมของระบบ (System Overview)
ระบบ PMT Flow v2 ทำงานในรูปแบบ 4-Step Pipeline มาตรฐาน:
- **Step 1: รับงาน (Orders)** — รับคำสั่งซื้อใหม่และคิวงาน Active Queue (ทั้ง Quick Service และ Renovate)
- **Step 2: Project & Gantt** — แผนงานโครงการ Renovate (งาน R) โดยแสดงเฉพาะงาน R พร้อมผัง Gantt Chart อัตโนมัติและบันทึกงานช่าง 24 ชม.
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
    `},{id:4,code:"KM-FIN-004",title:"ขั้นตอนการตัดสต็อกสินค้า (STK Export) และการปิดงานงวดบัญชี",category:"Finance",updatedAt:"26/09/2026",summary:"การตัดยอดวัสดุสิ้นเปลือง อะไหล่ และการส่งออกข้อมูลเข้าสู่ระบบบัญชี STK",content:`
### 1. การตรวจสอบรายการวัสดุและอุปกรณ์
- ตรวจสอบรายการของที่เบิกใช้จริงเทียบกับใบเสนอราคา (BOQ)
- ตรวจสอบความถูกต้องของรหัสสินค้า (SKU) และหน่วยนับ

### 2. การส่งออกไฟล์ STK (Export)
- เมื่อสถานะงานเป็น \`PASSED\` และได้รับการปิดงานใน Step 5
- กดปุ่ม **"ส่งออก STK"** เพื่อนำไฟล์เข้าสู่ระบบ ERP/บัญชีหลักของบริษัท
    `},{id:5,code:"KM-MA-005",title:"การบริหารจัดการสัญญาบริการบำรุงรักษา (MA Contracts & Service Cycles)",category:"MA",updatedAt:"26/09/2026",summary:"การสร้างสัญญารายปี, การกำหนดรอบบริการอัตโนมัติ (เช่น ทุก 3 เดือน) และการแจ้งเตือนงานล่วงหน้า",content:`
### 1. การจัดทำสัญญา MA
- บันทึกข้อมูลลูกค้า, หมายเลขสัญญา, วันที่เริ่มต้น - วันที่สิ้นสุด
- กำหนดความถี่การเข้าบริการ: ทุกเดือน, ทุก 2 เดือน, ทุก 3 เดือน หรือรายไตรมาส

### 2. การสร้างรอบบริการ (Service Cycles)
- ระบบจะ Generate รอบงานบำรุงรักษาล่วงหน้าให้อัตโนมัติ
- เมื่อถึงกำหนด ระบบจะแจ้งเตือนให้แปลงเป็นใบงานใน Step 2 จัดสรรงานทันที
    `},{id:6,code:"KM-OPS-006",title:"พื้นที่บันทึกข้อมูลหน้างาน (Active Input Workspace) และการส่งต่ออัตโนมัติ (Automated Routing)",category:"Operation",updatedAt:"26/09/2026",summary:"คู่มือการใช้งาน Active Input Workspace, แกลเลอรี PhotoSlots 5 สล็อตพร้อม Lightbox, 7 Quick Tags, Activity Timeline และกฎการเปลี่ยนสถานะอัตโนมัติ Quick -> QC / Renovate -> BOQ",content:`
### 1. ภาพรวมข้อมูลรายละเอียดงาน (Clean Grid View & Detail List)
- **Detail List ด้านบน**: ข้อมูลคำสั่งซื้อ ลูกค้า สถานที่ติดตั้ง และบริการ แสดงผลเป็นแถบตารางรายการกะทัดรัด (Clean Minimal Detail List) พื้นหลังสีขาว ตัวหนังสือสีดำ 100% (#000000) ในหน้าต่างรับงาน, QC, ปิดงาน ฯลฯ (โดยเฉพาะหน้า Project & Gantt จะซ่อนแถบสถานที่ติดตั้งและหมายเหตุ เพื่อคืนพื้นที่แนวตั้งให้ผัง Gantt Chart และรายการงานย่อยแสดงผลได้เต็มตาและชัดเจนสูงสุด)
- **ตารางรายการย่อย (Grid View)**: แท็บ "งาน/Task" แสดงผลเป็นตาราง DataGrid โดยตรงทันที แสดงชื่องาน จำนวน ช่าง วันเริ่ม วันสิ้นสุด และหมายเหตุ เพื่อให้เจ้าหน้าที่และช่างสแกนรายการได้อย่างรวดเร็ว
- **ไม่ต้องมี Quick Tags**: ตัดปุ่ม Quick Tags ออกทั้งหมด เพื่อให้หน้าจอสะอาด คมชัด และตรงตามกระบวนการทำงานจริง

### 2. รูปถ่ายการปฏิบัติงาน 5 ขั้นตอน (PhotoSlots 5) จัดวางด้านล่างตาราง
- จัดวางอยู่ด้านล่างตารางรายการย่อย (Grid View) โดยตรงอย่างเป็นระเบียบ
- ประกอบด้วย 5 สล็อตมาตรฐาน: ก่อนเริ่มงาน, ระหว่างทำ 1, ระหว่างทำ 2, ทดสอบระบบ, หลังเสร็จสิ้น
- รองรับการอัปโหลดไฟล์ พรีวิวภาพย่อ และคลิกดูรูปขยายผ่าน Lightbox Dialog ได้ทันที พร้อมปุ่มบันทึกรูปถ่าย และระบบ Modal แจ้งเตือนยืนยันบันทึกสำเร็จ (พร้อมปุ่มนำทางสู่การตรวจ QC Online ทันทีสำหรับงานประเภท Q - Quick Service)

### 3. ประวัติกิจกรรม (Activity Timeline Stream)
- แสดงประวัติกิจกรรมตามลำดับเวลา (Chronological Stream)
- ระบุชื่อผู้บันทึก (Author), วันที่ในรูปแบบ DD/MM/YYYY, และเวลามาตรฐาน 24 ชั่วโมง (00:00 - 23:59 น. Strictly NO AM/PM)
- แสดงภาพถ่าย Thumbnail ที่แนบในแต่ละบันทึก พร้อมปุ่มคลิกขยายดูผ่าน Lightbox

### 4. ระบบรูปถ่าย 5 ขั้นตอน (PhotoSlots 5) จัดวางด้านล่างสุด
ระบบช่องแนบภาพถ่ายหน้างานมาตรฐาน 5 สล็อตจัดวางอยู่ที่ส่วนล่างสุดของพื้นที่ทำงาน:
1. **ก่อนเริ่มงาน (before)**: ภาพถ่ายสภาพพื้นที่หน้างานจริงก่อนเริ่มลงมือ
2. **ระหว่างทำ 1 (progress1)**: งานโครงสร้าง/รื้อถอน/เดินท่อ-สายไฟ
3. **ระหว่างทำ 2 (progress2)**: งานติดตั้งอุปกรณ์หลักหรือชิ้นงานสำคัญ
4. **ทดสอบระบบ (test)**: การทดสอบความปลอดภัย วัดแรงดัน/กระแสไฟ หรือตรวจรอยรั่ว
5. **หลังเสร็จสิ้น (after)**: งานเสร็จสมบูรณ์ 100% และทำความสะอาดพื้นที่เรียบร้อย
- รองรับการอัปโหลดไฟล์จริง พรีวิว Thumbnail และคลิกเพื่อขยายดูรูปเต็มผ่าน Lightbox Modal Dialog

### 5. แถบปฏิบัติการล่างสุด (Sticky Bottom Action Bar) & Hybrid Actions
- **Sticky Footer**: แถบเครื่องมือติดตรึงที่ขอบล่างเสมอ มองเห็นและกดได้สะดวกโดยไม่ต้อง Scroll
- **ส่งคอมเมนต์ด่วน**: บันทึกโน้ตและรูปภาพระหว่างทางลงใน Activity Timeline โดยไม่เปลี่ยนขั้นตอนงาน
- **อัปเดตและบันทึกข้อมูล**: บันทึกข้อมูลและส่งต่องานตามเงื่อนไขอัตโนมัติ

### 6. กฎการส่งต่องานอัตโนมัติตามประเภทงาน (Automated Workflow Routing)
- **⚡ งานด่วน (Quick Service)**:
  - เมื่อกดอัปเดต ระบบจะปรับสถานะเป็น \`QC_PENDING\` (รอตรวจ QC Online), ความคืบหน้าอย่างน้อย 85%, บันทึกเวลา \`step_timestamps.qc_pending_at\`
  - ย้ายและนำทางไปยังขั้นตอน QC (Tab \`qc\` / Step 6) ทันที
  - แสดง Toast: "⚡ งานด่วน (Quick Service) อัปเดตข้อมูลและส่งต่อไปยังขั้นตอนตรวจ QC เรียบร้อยแล้ว"
- **🏗️ งานรีโนเวท (Renovate)**:
  - เมื่อกดอัปเดต ระบบจะตรวจสอบและเชื่อมโยงข้อมูล BOQ, บันทึกเวลา \`step_timestamps.step3_boq_at\`
  - ย้ายและนำทางไปยังขั้นตอน Project & BOQ (Tab \`boq\` / Step 3 & Step 5 Gantt) ทันที
  - แสดง Toast: "🏗️ งานรีโนเวท (Renovate) อัปเดตข้อมูลและย้ายไปยังขั้นตอน Project & BOQ เรียบร้อยแล้ว"
    `}];function C(){const[o,x]=l.useState(""),[s,r]=l.useState("ALL"),[a,m]=l.useState(d[0]),i=l.useMemo(()=>d.filter(t=>{if(s!=="ALL"&&t.category!==s)return!1;if(o.trim()){const n=o.toLowerCase();return t.title.toLowerCase().includes(n)||t.code.toLowerCase().includes(n)||t.summary.toLowerCase().includes(n)||t.content.toLowerCase().includes(n)}return!0}),[o,s]),c=t=>{switch(t){case"General":return"bg-blue-100 text-blue-800 border-blue-200";case"Operation":return"bg-emerald-100 text-emerald-800 border-emerald-200";case"Quality":return"bg-purple-100 text-purple-800 border-purple-200";case"Finance":return"bg-amber-100 text-amber-800 border-amber-200";case"MA":return"bg-cyan-100 text-cyan-800 border-cyan-200";default:return"bg-slate-100 text-slate-800 border-slate-200"}},p=[{id:"code",header:"รหัสคู่มือ",width:120,cell:({row:t})=>e.jsx("span",{className:"font-mono text-xs font-bold text-indigo-700",children:t.code})},{id:"title",header:"ชื่อบทความ / คู่มือการปฏิบัติงาน",cell:({row:t})=>e.jsxs("div",{children:[e.jsx("span",{className:"font-bold text-xs text-black block",children:t.title}),e.jsx("span",{className:"text-[11px] text-slate-500 line-clamp-1",children:t.summary})]})},{id:"category",header:"หมวดหมู่",width:110,cell:({row:t})=>e.jsx("span",{className:`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold border ${c(t.category)}`,children:t.category})},{id:"updatedAt",header:"ปรับปรุงล่าสุด",width:120,cell:({row:t})=>e.jsx("span",{className:"font-mono text-xs text-black",children:t.updatedAt})}];return e.jsxs("div",{className:"flex flex-col h-full bg-subtle p-2.5 overflow-hidden",children:[e.jsx(u,{title:"คลังความรู้ (Knowledge Management)",pageKey:"km"}),e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2 py-1 px-1 shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-1 min-w-[300px]",children:[e.jsxs("div",{className:"relative flex-1 max-w-md",children:[e.jsx(b,{className:"absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"}),e.jsx(h,{placeholder:"ค้นหาคู่มือ, ขั้นตอนการทำงาน, รหัส KM...",value:o,onChange:t=>x(t.target.value),className:"pl-9 h-9 text-xs text-black font-medium"})]}),e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("button",{type:"button",onClick:()=>r("ALL"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="ALL"?"bg-black text-white shadow-xs":"bg-slate-100 text-slate-700 hover:bg-slate-200"}`,children:"ทั้งหมด"}),e.jsx("button",{type:"button",onClick:()=>r("General"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="General"?"bg-blue-600 text-white shadow-xs":"bg-blue-50 text-blue-700 hover:bg-blue-100"}`,children:"General"}),e.jsx("button",{type:"button",onClick:()=>r("Operation"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Operation"?"bg-emerald-600 text-white shadow-xs":"bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`,children:"Operation"}),e.jsx("button",{type:"button",onClick:()=>r("Quality"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Quality"?"bg-purple-600 text-white shadow-xs":"bg-purple-50 text-purple-800 hover:bg-purple-100"}`,children:"Quality"}),e.jsx("button",{type:"button",onClick:()=>r("Finance"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="Finance"?"bg-amber-600 text-white shadow-xs":"bg-amber-50 text-amber-900 hover:bg-amber-100"}`,children:"Finance"}),e.jsx("button",{type:"button",onClick:()=>r("MA"),className:`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${s==="MA"?"bg-cyan-600 text-white shadow-xs":"bg-cyan-50 text-cyan-800 hover:bg-cyan-100"}`,children:"MA"})]})]}),e.jsxs("div",{className:"text-xs font-semibold text-slate-600",children:["พบ ",e.jsx("span",{className:"text-black font-bold font-mono",children:i.length})," บทความ"]})]}),e.jsx("div",{className:"flex-1 min-h-0 mt-2",children:e.jsx(g,{pageKey:"km",masterContent:e.jsx(S,{data:i,columns:p,getRowId:t=>String(t.id),selectedRowId:a?String(a.id):void 0,onRowSelect:m}),detailContent:a?e.jsxs("div",{className:"flex flex-col h-full bg-white border border-border-soft rounded-2xl shadow-sm p-6 overflow-y-auto",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border-soft",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold",children:e.jsx(y,{className:"w-5 h-5"})}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{className:`px-2.5 py-0.5 rounded-md text-xs font-bold border ${c(a.category)}`,children:a.category}),e.jsx("span",{className:"font-mono text-xs font-bold text-indigo-700",children:a.code})]}),e.jsx("h2",{className:"text-lg font-bold text-black mt-0.5",children:a.title})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-xs text-slate-500 font-mono",children:["ปรับปรุงเมื่อ: ",a.updatedAt]}),e.jsxs(f,{variant:"outline",size:"sm",onClick:()=>window.print(),className:"gap-1.5 text-xs text-black border-slate-300 cursor-pointer",children:[e.jsx(v,{className:"w-3.5 h-3.5"}),e.jsx("span",{children:"พิมพ์คู่มือ"})]})]})]}),e.jsxs("div",{className:"py-4 space-y-4 max-w-4xl",children:[e.jsxs("div",{className:"bg-slate-50 p-3.5 rounded-xl border border-slate-200",children:[e.jsx("span",{className:"text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1",children:"สรุปใจความสำคัญ (Summary)"}),e.jsx("p",{className:"text-xs font-semibold text-black leading-relaxed",children:a.summary})]}),e.jsx("div",{className:"prose prose-sm text-black space-y-3 leading-relaxed whitespace-pre-line text-xs font-medium",children:a.content})]})]}):e.jsx(j,{})})})]})}export{C as default};

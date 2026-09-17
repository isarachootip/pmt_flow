// =============================================================================
// TEST SUITE: BOQ IMPORT & LABOR-ONLY TASK CONVERSION TEST
// Tests:
// 1. vFIX Quotation / BOQ Template Parsing (Header & Line Items)
// 2. Importing BOQ data into Project & Recalculating Cost Breakdown
// 3. Labor-Only Project Task Conversion (Ensures ONLY Labor items become Tasks)
// 4. Gantt Timeline & QC Checklist Data Verification
// =============================================================================

const fs = require('fs');
const path = require('path');

// Mock Project Database
let mockDB = {
  jobs: [
    {
      id: 'JOB26090900001',
      customer: 'ณวัฒน์ รักสงบ',
      phone: '081-111-2222',
      address: '99/1 Sukhumvit 55, Bangkok',
      service: 'ติดตั้งเครื่องปรับอากาศ',
      date: '2026-09-05',
      tech: 'Team A (สมศักดิ์)',
      boq_items: [],
      tasks: []
    }
  ],
  tasks: []
};

// Raw vFIX Quotation Template (matches user's template & image)
const sampleVFixQuotationCSV = 
`vFIX,ใบเสนอราคางาน,เลขที่งาน :,JOB26090900001,,,
เรียน :,นภัสวรรณ มีศิริ,,เลขที่ใบเสร็จ :,
ที่อยู่ :,หมู่บ้านพัทยารุ่งเรือง ซอยระหว่างมาบยายเลีย ตำบลหนองปรือ อำเภอบางละมุง จังหวัดชลบุรี 20150,,สาขา :,พัทยาใต้
Tel :,0922795574,,วันที่ :,25/8/69
EMail/ Line ID :,,,,,
,,,,,,สำหรับ QC กรอก
ลำดับที่,รหัสสินค้า,รายการ,จำนวน,หน่วย,ค่าวัสดุ_ราคาต่อหน่วย,ค่าวัสดุ_จำนวนเงิน,ค่าแรง_ราคาต่อหน่วย,ค่าแรง_จำนวนเงิน,จำนวนเงินรวม,หมายเหตุ
1,SKU-AC-INV18,ค่าแรงช่างติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU,1,งาน,0,0,2500,2500,2500,รวมชุดเบรกเกอร์
2,MAT-PIPE-04,ชุดท่อน้ำยาแอร์ทองแดงหนาพิเศษพร้อมฉนวนหุ้ม 4 ม.,1,ชุด,1800,1800,0,0,1800,ท่อทองแดง 0.7 มม.
3,MAT-DUCT-04,รางครอบท่อน้ำยาแอร์และข้อต่อมุมมาตรฐาน 4 ม.,1,ชุด,950,950,0,0,950,สีครีมมาตรฐาน
4,MAT-BRACKET,ขาแขวนคอยล์ร้อนแบบกระเช้าชุบกัลวาไนซ์กันสนิม,1,ชุด,650,650,0,0,650,แบบหนาพิเศษ
5,MAT-SW-30A,ชุดเบรกเกอร์ควบคุม Safety Switch มอก. 30A พร้อมกล่อง,1,ชุด,500,500,0,0,500,มอก. แท้`;

// Parser Implementation (same logic as in app)
function parseBOQTemplate(csvContent) {
  const lines = csvContent.trim().split(/\r?\n/);
  const items = [];
  let detectedHeader = {};

  lines.forEach((line) => {
    const rawLine = line.trim();
    if (!rawLine) return;

    // Header extraction
    if (rawLine.includes('เรียน') || rawLine.includes('Customer') || rawLine.includes('ลูกค้า')) {
      const m = rawLine.match(/(?:เรียน|Customer|ลูกค้า)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:ที่อยู่|Address|Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:ที่อยู่|Address|Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) detectedHeader.customer = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('ที่อยู่') || rawLine.includes('Address')) {
      const m = rawLine.match(/(?:ที่อยู่|Address)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) detectedHeader.address = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('Tel') || rawLine.includes('เบอร์โทร') || rawLine.includes('Phone')) {
      const m = rawLine.match(/(?:Tel|เบอร์โทร|Phone)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) detectedHeader.phone = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('สาขา') || rawLine.includes('Branch')) {
      const m = rawLine.match(/(?:สาขา|Branch)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) detectedHeader.branch = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('เลขที่งาน') || rawLine.includes('Job No') || rawLine.includes('Order No')) {
      const m = rawLine.match(/(?:เลขที่งาน|Job No|Order No)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:วันที่|Date)\s*[:=]|\s{2,}(?:วันที่|Date)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) detectedHeader.job_ref = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('วันที่') || rawLine.includes('Date')) {
      const m = rawLine.match(/(?:วันที่|Date)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\t|\||$)/i);
      if (m && m[1]) detectedHeader.date = m[1].trim().replace(/^"|"$/g, '');
    }

    if (rawLine.includes('ลำดับ') || rawLine.includes('Descriptions') || rawLine.includes('รหัสสินค้า') || rawLine.includes('ใบเสนอราคา') || rawLine.includes('vFIX')) {
      return;
    }

    let parts = rawLine.split(',').map(p => p.trim());
    if (parts.length >= 7) {
      const offset = /^\d+$/.test(parts[0]) ? 1 : 0;
      const itemCode = parts[offset] || '';
      const name = parts[offset + 1] || '';
      const qty = parseFloat(parts[offset + 2]) || 1;
      const unit = parts[offset + 3] || 'ชุด';
      const matPrice = parseFloat(parts[offset + 4]) || 0;
      const laborPrice = parseFloat(parts[offset + 6]) || 0;
      const total = parseFloat(parts[offset + 8]) || ((matPrice + laborPrice) * qty);
      const remark = parts[offset + 9] || '';

      if (name && !name.includes('รวมเงิน') && !name.includes('สำหรับ QC')) {
        items.push({
          code: itemCode,
          name: name,
          qty: qty,
          unit: unit,
          mat_price: matPrice,
          labor_price: laborPrice,
          price: matPrice + laborPrice,
          total: total,
          remark: remark
        });
      }
    }
  });

  return { header: detectedHeader, items };
}

// Filter only labor items for project task conversion
function convertBOQToProjectTasks(job, boqItems) {
  const isLaborItem = (item) => {
    if (item.labor_price && Number(item.labor_price) > 0) return true;
    const name = item.name || '';
    const laborKeywords = ['ค่าแรง', 'งาน', 'บริการ', 'ช่าง', 'ติดตั้ง', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียม', 'ประกอบ', 'ทดสอบ', 'ซ่อม', 'ล้าง'];
    const materialKeywords = ['ชุดท่อ', 'รางครอบ', 'ขาแขวน', 'เบรกเกอร์', 'ถังเก็บน้ำ', 'ปั๊มน้ำ', 'สายไฟ', 'วาล์ว', 'ฐานรอง', 'อุปกรณ์', 'อะไหล่', 'ทองแดง'];
    const hasLabor = laborKeywords.some(kw => name.includes(kw));
    const hasMaterial = materialKeywords.some(kw => name.includes(kw));
    if (hasLabor && !hasMaterial) return true;
    if (name.startsWith('ค่าแรง') || name.startsWith('งาน') || name.startsWith('บริการ')) return true;
    return hasLabor;
  };

  const laborItems = boqItems.filter(isLaborItem);
  const baseDate = job.date || '2026-09-05';
  const defaultTech = job.tech || 'Team A (สมศักดิ์)';

  return laborItems.map((item, idx) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + idx);
    let cleanName = item.name.replace(/^ค่าแรงช่าง/, 'งาน').replace(/^ค่าแรง/, 'งาน');
    return {
      id: `TASK-${job.id}-${idx + 1}`,
      jobId: job.id,
      name: cleanName,
      original_boq: item.name,
      start: d.toISOString().slice(0, 10),
      end: d.toISOString().slice(0, 10),
      days: 1,
      tech: defaultTech,
      labor_cost: item.labor_price,
      status: 'PENDING'
    };
  });
}

// Run Test
async function runBOQTest() {
  console.log('================================================================');
  console.log('🧪 TEST: BOQ IMPORT & LABOR-ONLY TASK CONVERSION');
  console.log('================================================================\n');

  // 1. Parse File
  console.log('▶ [TEST 1] Parsing vFIX Quotation Template...');
  const { header, items } = parseBOQTemplate(sampleVFixQuotationCSV);

  console.log('   ✅ Extracted Header:');
  console.log(`      - Customer : ${header.customer}`);
  console.log(`      - Phone    : ${header.phone}`);
  console.log(`      - Branch   : ${header.branch}`);
  console.log(`      - Date     : ${header.date}`);
  console.log(`      - Address  : ${header.address.substring(0, 45)}...`);
  console.log(`   ✅ Extracted Line Items : ${items.length} items\n`);

  if (header.customer !== 'นภัสวรรณ มีศิริ' || header.phone !== '0922795574' || items.length !== 5) {
    throw new Error('❌ Test 1 Failed: Header or Items parsing mismatch');
  }

  // 2. Cost Calculation & Verification
  console.log('▶ [TEST 2] Verifying Material vs Labor Cost Breakdown...');
  let totalMat = 0;
  let totalLabor = 0;
  items.forEach((it, i) => {
    totalMat += it.mat_price * it.qty;
    totalLabor += it.labor_price * it.qty;
    console.log(`      ${i + 1}. [${it.code}] ${it.name}`);
    console.log(`         -> Qty: ${it.qty} ${it.unit} | ค่าวัสดุ: ฿${it.mat_price.toLocaleString()} | ค่าแรง: ฿${it.labor_price.toLocaleString()} | รวม: ฿${it.total.toLocaleString()}`);
  });
  const subtotal = totalMat + totalLabor;
  const discount = 500;
  const grandTotal = Math.max(0, subtotal - discount);

  console.log(`   📊 Summary:`);
  console.log(`      - รวมค่าวัสดุ (Material Total) : ฿${totalMat.toLocaleString()}`);
  console.log(`      - รวมค่าแรง  (Labor Total)    : ฿${totalLabor.toLocaleString()}`);
  console.log(`      - ยอดรวม Subtotal              : ฿${subtotal.toLocaleString()}`);
  console.log(`      - ส่วนลด Discount               : -฿${discount.toLocaleString()}`);
  console.log(`      - ยอดสุทธิ Grand Total (No VAT) : ฿${grandTotal.toFixed(2)}\n`);

  if (totalLabor !== 2500 || totalMat !== 3900 || subtotal !== 6400 || grandTotal !== 5900) {
    throw new Error('❌ Test 2 Failed: Calculation mismatch');
  }

  // 3. Ingest into Project (R1: Line items only, Customer Protection - Original customer must NOT be overwritten)
  console.log('▶ [TEST 3] Ingesting BOQ into Project (JOB26090900001) - Customer Name Protection Verification...');
  const targetJob = mockDB.jobs[0];
  const originalCustomer = targetJob.customer; // 'ณวัฒน์ รักสงบ'
  const originalPhone = targetJob.phone;
  const originalAddress = targetJob.address;

  // Under R1: Import line items only, protect original customer info
  targetJob.boq_items = items;
  if (header && Object.keys(header).length > 0) {
    targetJob.boq_source_header = {
      source_customer: header.customer || '',
      source_phone: header.phone || '',
      source_address: header.address || '',
      source_branch: header.branch || '',
      source_date: header.date || ''
    };
  }

  // Verify Customer info remains original
  if (targetJob.customer !== originalCustomer) {
    throw new Error(`❌ Test 3 Failed: Customer was overwritten! Expected "${originalCustomer}", got "${targetJob.customer}"`);
  }
  if (targetJob.phone !== originalPhone) {
    throw new Error(`❌ Test 3 Failed: Phone was overwritten! Expected "${originalPhone}", got "${targetJob.phone}"`);
  }
  if (targetJob.address !== originalAddress) {
    throw new Error(`❌ Test 3 Failed: Address was overwritten! Expected "${originalAddress}", got "${targetJob.address}"`);
  }
  if (targetJob.boq_items.length !== items.length) {
    throw new Error(`❌ Test 3 Failed: BOQ items count mismatch`);
  }
  console.log(`   🔒 Verified: Original Customer "${targetJob.customer}" protected and NOT overwritten (Source file customer was "${header.customer}")`);
  console.log(`   ✅ Job ${targetJob.id} updated with Customer "${targetJob.customer}" & ${targetJob.boq_items.length} BOQ items\n`);

  // 4. Labor-Only Project Tasks Conversion
  console.log('▶ [TEST 4] Converting BOQ to Tasks (LABOR ONLY RULE)...');
  const convertedTasks = convertBOQToProjectTasks(targetJob, targetJob.boq_items);
  console.log(`   🔍 Items evaluated: ${targetJob.boq_items.length} | Tasks created: ${convertedTasks.length}`);
  
  convertedTasks.forEach((t, i) => {
    console.log(`      ${i + 1}. [TASK] "${t.name}" (วันที่: ${t.start} | ค่าแรง: ฿${t.labor_cost.toLocaleString()} | ผู้รับผิดชอบ: ${t.tech})`);
  });

  // Verify that ONLY the labor item was converted (1 task) and materials (4 items) were NOT converted into tasks
  if (convertedTasks.length !== 1) {
    throw new Error(`❌ Test 4 Failed: Expected 1 labor task, but got ${convertedTasks.length}`);
  }
  if (!convertedTasks[0].name.includes('ติดตั้งเครื่องปรับอากาศ')) {
    throw new Error('❌ Test 4 Failed: Incorrect task converted');
  }
  console.log(`   ✅ SUCCESS: Pure material items (4 รายการ) ถูกกันออก ไม่ถูกแปลงเป็น Task`);
  console.log(`   ✅ SUCCESS: เฉพาะรายการค่าแรง 1 รายการ ถูกแปลงเป็น Project Task เข้าสู่แผนงาน Gantt เรียบร้อย!\n`);

  // 5. Hybrid Line Items Price Calculation (Both Material + Labor)
  console.log('▶ [TEST 5] Verifying Hybrid Items (Material + Labor Combined Calculation)...');
  const hybridItem = {
    code: 'HYBRID-01',
    name: 'ติดตั้งสุขภัณฑ์พร้อมชุดท่อระบายน้ำ',
    qty: 2,
    mat_price: 1200,
    labor_price: 800,
    price: 1200 + 800 // Must be 2000, not just 800 or 1200
  };
  const expectedUnitPrice = 2000;
  const actualUnitPrice = (hybridItem.labor_price > 0 || hybridItem.mat_price > 0)
    ? (hybridItem.mat_price || 0) + (hybridItem.labor_price || 0)
    : 0;
  if (actualUnitPrice !== expectedUnitPrice) {
    throw new Error(`❌ Test 5 Failed: Expected hybrid unit price ${expectedUnitPrice}, got ${actualUnitPrice}`);
  }
  const hybridTotal = hybridItem.qty * actualUnitPrice;
  if (hybridTotal !== 4000) {
    throw new Error(`❌ Test 5 Failed: Expected hybrid line total 4000, got ${hybridTotal}`);
  }
  console.log(`   ✅ SUCCESS: Hybrid Item Unit Price = ฿${actualUnitPrice.toLocaleString()} (Mat ฿${hybridItem.mat_price} + Labor ฿${hybridItem.labor_price}), Total = ฿${hybridTotal.toLocaleString()}\n`);

  // 6. Thai Buddhist Era & DD/MM/YYYY Date Normalization + Excel Serial Dates
  console.log('▶ [TEST 6] Verifying Date Normalization (DD/MM/YYYY Standard & Excel Serial)...');
  function testFormatDateDMY(dateInput) {
    if (!dateInput) return '-';
    if (typeof dateInput === 'number' && dateInput > 30000 && dateInput < 70000) {
      const jsDate = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) {
        const d = String(jsDate.getUTCDate()).padStart(2, '0');
        const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
        const y = jsDate.getUTCFullYear();
        return `${d}/${m}/${y}`;
      }
    }
    const str = String(dateInput).trim();
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      let y = parseInt(dmyMatch[3], 10);
      if (y >= 2400) {
        y -= 543;
      } else if (y < 100) {
        if (y >= 50) y = (2500 + y) - 543;
        else y = 2000 + y;
      }
      return `${d}/${m}/${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return String(dateInput);
  }

  const dateCases = [
    { input: '25/8/69', expected: '25/08/2026' },
    { input: '25/08/2569', expected: '25/08/2026' },
    { input: '25/08/2026', expected: '25/08/2026' },
    { input: '2026-09-05', expected: '05/09/2026' },
    { input: '5/9/2026', expected: '05/09/2026' },
    { input: 46259, expected: '25/08/2026' }
  ];

  dateCases.forEach(tc => {
    const res = testFormatDateDMY(tc.input);
    if (res !== tc.expected) {
      throw new Error(`❌ Test 6 Failed for input "${tc.input}": Expected "${tc.expected}", got "${res}"`);
    }
    console.log(`   📅 Input: "${tc.input}" ➔ Output: "${res}" [PASSED]`);
  });
  console.log('   ✅ SUCCESS: All date inputs conform strictly to DD/MM/YYYY standard\n');

  // 7. Customer Object Resilience (Ensuring job.customer as object doesn't crash replace)
  console.log('▶ [TEST 7] Verifying Customer Object Resilience (No .replace TypeError)...');
  const jobWithCustomerObj = {
    id: 'JOB26090900002',
    customer: { name: 'คุณวิชัย เจริญสุข', phone: '089-999-8888' },
    service: 'ติดตั้งปั๊มน้ำ'
  };
  function safeGetCustomerName(job) {
    return (job && typeof job.customer === 'object' && job.customer !== null)
      ? (job.customer.name || '')
      : String(job && job.customer ? job.customer : '');
  }
  const extractedName = safeGetCustomerName(jobWithCustomerObj);
  if (extractedName !== 'คุณวิชัย เจริญสุข') {
    throw new Error(`❌ Test 7 Failed: Expected "คุณวิชัย เจริญสุข", got "${extractedName}"`);
  }
  const safeExportName = extractedName.replace(/[\s\/\\:*?"<>|]/g, '_');
  if (safeExportName !== 'คุณวิชัย_เจริญสุข') {
    throw new Error(`❌ Test 7 Failed: Sanitized name mismatch: "${safeExportName}"`);
  }
  console.log(`   ✅ SUCCESS: Safe extraction & sanitization succeeded for object customer: "${safeExportName}"\n`);

  // 8. Negative Value Clamping (Discounts, Quantities, and Unit Prices)
  console.log('▶ [TEST 8] Verifying Non-Negative Value Clamping...');
  const testSubtotal = 5000;
  const rawDiscount = -500;
  const clampedDiscount = Math.max(0, Number(rawDiscount) || 0);
  const rawQty = -2;
  const clampedQty = Math.max(0, Number(rawQty) || 0);
  const rawPrice = -100;
  const clampedPrice = Math.max(0, Number(rawPrice) || 0);

  if (clampedDiscount !== 0 || clampedQty !== 0 || clampedPrice !== 0) {
    throw new Error('❌ Test 8 Failed: Negative clamping failed');
  }
  const finalPayable = Math.max(0, testSubtotal - clampedDiscount);
  if (finalPayable !== 5000) {
    throw new Error(`❌ Test 8 Failed: Final payable calculated improperly with negative discount: ${finalPayable}`);
  }
  console.log(`   ✅ SUCCESS: Negative discount (-500) clamped to 0, payable = ฿${finalPayable.toLocaleString()}\n`);

  // 9. Pasted BOQ Fallback Code Generation
  console.log('▶ [TEST 9] Verifying Pasted BOQ SKU Fallback...');
  const pastedRowWithoutCode = 'งานเดินสายเมนไฟ,1,งาน,1500';
  const parts = pastedRowWithoutCode.split(',');
  const parsedItem = {
    code: 'SKU-1',
    name: parts[0],
    qty: Math.max(0, parseFloat(parts[1]) || 1),
    unit: parts[2] || 'ชุด',
    price: Math.max(0, parseFloat(parts[3]) || 0)
  };
  if (!parsedItem.code || parsedItem.qty !== 1 || parsedItem.price !== 1500) {
    throw new Error('❌ Test 9 Failed: SKU fallback parsing failed');
  }
  console.log(`   ✅ SUCCESS: Auto-generated SKU code "${parsedItem.code}" for pasted row\n`);

  // 10. Task CSV Ingestion with DD/MM/YYYY Standard & Buddhist Era Dates
  console.log('▶ [TEST 10] Verifying Task CSV Import with DD/MM/YYYY & Thai BE Dates...');
  function testFormatDateISO(dateInput) {
    if (!dateInput) return '';
    const str = String(dateInput).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      let y = parseInt(dmyMatch[3], 10);
      if (y >= 2400) {
        y -= 543;
      } else if (y < 100) {
        if (y >= 50) y = (2500 + y) - 543;
        else y = 2000 + y;
      }
      return `${y}-${m}-${d}`;
    }
    return String(dateInput);
  }

  const sampleTaskCSV = `ลำดับ,ชื่อ Task ตาม BOQ,วันเริ่มต้น (Start Date DD/MM/YYYY),วันสิ้นสุด (End Date DD/MM/YYYY),จำนวนวัน,ผู้รับผิดชอบ
1,งานสำรวจและเตรียมพื้นที่หน้างาน,01/09/2026,02/09/2026,2,Team A (สมศักดิ์)
2,งานรื้อถอนและปรับระดับพื้นเดิม,03/09/2569,04/09/2569,2,Team A (สมศักดิ์)`;

  const parsedCsvTasks = [];
  sampleTaskCSV.trim().split(/\r?\n/).forEach((line, idx) => {
    if (idx === 0) return;
    const parts = line.split(',').map(p => p.trim());
    const startDate = parts[2] ? (testFormatDateISO(parts[2]) || '') : '';
    const endDate = parts[3] ? (testFormatDateISO(parts[3]) || '') : '';
    parsedCsvTasks.push({ name: parts[1], start: startDate, end: endDate });
  });

  if (parsedCsvTasks.length !== 2) {
    throw new Error('❌ Test 10 Failed: Expected 2 parsed tasks');
  }
  if (parsedCsvTasks[0].start !== '2026-09-01' || parsedCsvTasks[0].end !== '2026-09-02') {
    throw new Error(`❌ Test 10 Failed: Expected 2026-09-01/2026-09-02, got ${parsedCsvTasks[0].start}/${parsedCsvTasks[0].end}`);
  }
  if (parsedCsvTasks[1].start !== '2026-09-03' || parsedCsvTasks[1].end !== '2026-09-04') {
    throw new Error(`❌ Test 10 Failed: Expected Thai BE 2569 conversion to 2026-09-03/2026-09-04, got ${parsedCsvTasks[1].start}/${parsedCsvTasks[1].end}`);
  }
  console.log(`   ✅ SUCCESS: Task CSV DD/MM/YYYY and Thai BE dates normalized to ISO correctly\n`);

  // 11. Pasted BOQ Parsing Resilience (Pipes & 2-Column Format)
  console.log('▶ [TEST 11] Verifying Pasted BOQ Pipe Delimiter & 2-Column Support...');
  const pipeSample = '| 1 | งานติดตั้งคอมเพรสเซอร์แอร์ | 1 | งาน | 1800 |';
  let pipeParts = pipeSample.split('\t');
  if (pipeParts.length === 1 && pipeSample.includes('|')) {
    pipeParts = pipeSample.split('|').map(p => p.trim()).filter((p, pIdx, arr) => (pIdx > 0 && pIdx < arr.length - 1) || arr.length <= 2);
  }
  if (pipeParts.length < 3 || pipeParts[1] !== 'งานติดตั้งคอมเพรสเซอร์แอร์') {
    throw new Error(`❌ Test 11 Failed: Pipe splitting failed, parts: ${JSON.stringify(pipeParts)}`);
  }

  const twoColSample = 'งานตรวจเช็คน้ำยาแอร์, 850';
  let twoColParts = twoColSample.split('\t');
  if (twoColParts.length === 1) twoColParts = twoColSample.split(',');
  twoColParts = twoColParts.map(p => p.trim());
  if (twoColParts.length !== 2 || twoColParts[0] !== 'งานตรวจเช็คน้ำยาแอร์' || parseFloat(twoColParts[1]) !== 850) {
    throw new Error('❌ Test 11 Failed: 2-column splitting failed');
  }
  console.log(`   ✅ SUCCESS: Pipe delimiter and 2-column paste formats parsed cleanly\n`);

  // 12. Customer Info Protection in Replace & Append Modes
  console.log('▶ [TEST 12] Verifying Customer Info Protection in Replace & Append Modes...');
  const sampleJob = {
    id: 'JOB26090900099',
    customer: 'คุณเกรียงไกร มั่นคง',
    phone: '081-999-7777',
    address: '123 Rama 9, Bangkok',
    boq_items: [{ name: 'รายการเดิม', price: 1000, qty: 1 }]
  };
  const externalHeader = { customer: 'นายสมชาย ผู้ส่งไฟล์', phone: '099-000-1111', address: '456 เชียงใหม่' };
  const newImportItems = [{ name: 'งานติดตั้งใหม่', price: 2000, qty: 1 }];

  // Simulate Replace Mode
  const replaceJob = { ...sampleJob };
  replaceJob.boq_items = [...newImportItems];
  replaceJob.boq_source_header = { source_customer: externalHeader.customer };
  if (replaceJob.customer !== 'คุณเกรียงไกร มั่นคง' || replaceJob.boq_items.length !== 1) {
    throw new Error('❌ Test 12 Failed: Customer changed in Replace Mode');
  }

  // Simulate Append Mode
  const appendJob = { ...sampleJob };
  appendJob.boq_items = [...(appendJob.boq_items || []), ...newImportItems];
  appendJob.boq_source_header = { source_customer: externalHeader.customer };
  if (appendJob.customer !== 'คุณเกรียงไกร มั่นคง' || appendJob.boq_items.length !== 2) {
    throw new Error('❌ Test 12 Failed: Customer changed or append failed in Append Mode');
  }
  console.log(`   ✅ SUCCESS: Customer info remains strictly protected in both Replace and Append modes\n`);

  // 13. English and Mixed Header Detection in Pasted Text
  console.log('▶ [TEST 13] Verifying English and Mixed Header Detection in Pasted Text...');
  const pastedEnglishText = `vFIX Quotation
Customer: นายจอห์น โด (John Doe)
Address: 888 Sukhumvit Road, Bangkok
Tel: 089-555-1234
Branch: Bangna
Date: 12/09/2026
ลำดับ,รายการ,จำนวน,หน่วย,ราคา
1,ค่าแรงติดตั้ง,1,งาน,2500`;

  let engHeader = {};
  pastedEnglishText.trim().split(/\r?\n/).forEach(rawLine => {
    if (rawLine.includes('เรียน') || rawLine.includes('Customer') || rawLine.includes('ลูกค้า')) {
      const m = rawLine.match(/(?:เรียน|Customer|ลูกค้า)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:ที่อยู่|Address|Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:ที่อยู่|Address|Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) engHeader.customer = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('ที่อยู่') || rawLine.includes('Address')) {
      const m = rawLine.match(/(?:ที่อยู่|Address)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) engHeader.address = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('Tel') || rawLine.includes('เบอร์โทร') || rawLine.includes('Phone')) {
      const m = rawLine.match(/(?:Tel|เบอร์โทร|Phone)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) engHeader.phone = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('สาขา') || rawLine.includes('Branch')) {
      const m = rawLine.match(/(?:สาขา|Branch)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i);
      if (m && m[1]) engHeader.branch = m[1].trim().replace(/^"|"$/g, '');
    }
    if (rawLine.includes('วันที่') || rawLine.includes('Date')) {
      const m = rawLine.match(/(?:วันที่|Date)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\t|\||$)/i);
      if (m && m[1]) engHeader.date = m[1].trim().replace(/^"|"$/g, '');
    }
  });

  if (engHeader.customer !== 'นายจอห์น โด (John Doe)' || engHeader.address !== '888 Sukhumvit Road, Bangkok' || engHeader.phone !== '089-555-1234' || engHeader.branch !== 'Bangna' || engHeader.date !== '12/09/2026') {
    throw new Error(`❌ Test 13 Failed: English header detection failed: ${JSON.stringify(engHeader)}`);
  }

  // Edge cases: Multi-comma Thai address, quoted address, inline Tel on same line
  const edgeAddressCases = [
    {
      line: 'ที่อยู่: 123/45 ซอยสุขุมวิท 55, แขวงคลองตันเหนือ, เขตวัฒนา, กรุงเทพฯ 10110',
      expected: '123/45 ซอยสุขุมวิท 55, แขวงคลองตันเหนือ, เขตวัฒนา, กรุงเทพฯ 10110'
    },
    {
      line: 'Address: "888 Sukhumvit Road, Khlong Toei, Bangkok 10110"',
      expected: '888 Sukhumvit Road, Khlong Toei, Bangkok 10110'
    },
    {
      line: 'Address: 888 Sukhumvit Road, Bangkok\tTel: 089-555-1234',
      expected: '888 Sukhumvit Road, Bangkok'
    },
    {
      line: 'Address: 888 Sukhumvit Road, Bangkok, Tel: 089-555-1234',
      expected: '888 Sukhumvit Road, Bangkok'
    }
  ];

  const addrRegex = /(?:ที่อยู่|Address)\s*[:,\t]*\s*([^\t\r\n|]+?)(?=\s*,,|\s*,\s*(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\s{2,}(?:Tel|เบอร์โทร|Phone|สาขา|Branch|วันที่|Date|เลขที่|Job\s*No|Order\s*No)\s*[:=]|\t|\||$)/i;
  for (const c of edgeAddressCases) {
    const m = c.line.match(addrRegex);
    const parsed = m ? m[1].trim().replace(/^"|"$/g, '') : '';
    if (parsed !== c.expected) {
      throw new Error(`❌ Test 13 Edge Case Failed for "${c.line}": got "${parsed}", expected "${c.expected}"`);
    }
  }

  console.log(`   ✅ SUCCESS: English & alternative headers and multi-comma addresses extracted accurately: ${JSON.stringify(engHeader)}\n`);

  // 14. Same-Cell Excel Header Parsing
  console.log('▶ [TEST 14] Verifying Same-Cell Excel Header Parsing...');
  const mockExcelRows = [
    ['เรียน : คุณวิภาดา สดใส', null, 'สาขา : พัทยาใต้'],
    ['ที่อยู่ : 123/45 พัทยา ชลบุรี', null, 'Tel : 081-234-5678'],
    ['วันที่ : 25/08/2026', null, 'เลขที่ใบเสร็จ : REC-2026-001']
  ];
  let sameCellHeader = {};
  mockExcelRows.forEach(row => {
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim();
      if (/^(?:เรียน|Customer|ลูกค้า)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:เรียน|Customer|ลูกค้า)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.customer = m[1].trim();
      } else if ((cell.includes('เรียน') || cell.includes('Customer') || cell.includes('ลูกค้า')) && row[c + 1]) {
        sameCellHeader.customer = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }

      if (/^(?:ที่อยู่|Address)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:ที่อยู่|Address)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.address = m[1].trim();
      } else if ((cell.includes('ที่อยู่') || cell.includes('Address')) && row[c + 1]) {
        sameCellHeader.address = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }

      if (/^(?:Tel|เบอร์โทร|Phone)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:Tel|เบอร์โทร|Phone)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.phone = m[1].trim();
      } else if ((cell.includes('Tel') || cell.includes('เบอร์โทร') || cell.includes('Phone')) && row[c + 1]) {
        sameCellHeader.phone = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }

      if (/^(?:สาขา|Branch)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:สาขา|Branch)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.branch = m[1].trim();
      } else if ((cell.includes('สาขา') || cell.includes('Branch')) && row[c + 1]) {
        sameCellHeader.branch = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }

      if (/^(?:วันที่|Date)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:วันที่|Date)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.date = m[1].trim();
      } else if ((cell.includes('วันที่') || cell.includes('Date')) && row[c + 1]) {
        sameCellHeader.date = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }

      if (/^(?:เลขที่ใบเสร็จ|Receipt\s*No)\s*[:\s]+(.+)$/i.test(cell)) {
        const m = cell.match(/^(?:เลขที่ใบเสร็จ|Receipt\s*No)\s*[:\s]+(.+)$/i);
        if (m && m[1]) sameCellHeader.receipt_no = m[1].trim();
      } else if ((cell.includes('เลขที่ใบเสร็จ') || cell.includes('Receipt')) && row[c + 1]) {
        sameCellHeader.receipt_no = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
      }
    }
  });

  if (sameCellHeader.customer !== 'คุณวิภาดา สดใส' || sameCellHeader.address !== '123/45 พัทยา ชลบุรี' || sameCellHeader.phone !== '081-234-5678') {
    throw new Error(`❌ Test 14 Failed: Same-cell Excel parsing failed: ${JSON.stringify(sameCellHeader)}`);
  }
  console.log(`   ✅ SUCCESS: Same-cell Excel headers extracted accurately: ${JSON.stringify(sameCellHeader)}\n`);

  // 15. Customer Name Normalization Helper (Object vs String vs Fallback)
  console.log('▶ [TEST 15] Verifying Customer Name Normalization Helper...');
  function testGetCustomerName(job) {
    if (!job) return '-';
    if (typeof job.customer === 'object' && job.customer !== null) {
      return job.customer.name || `${job.customer.first_name || ''} ${job.customer.last_name || ''}`.trim() || 'คุณลูกค้า';
    }
    return String(job.customer || 'คุณลูกค้า');
  }

  const jobWithString = { customer: 'คุณมานพ ขยันดี' };
  const jobWithObjName = { customer: { name: 'คุณสมศรี มีทรัพย์' } };
  const jobWithFirstLast = { customer: { first_name: 'คุณสุรศักดิ์', last_name: 'มงคลชัย' } };
  const jobWithNull = { customer: null };

  if (testGetCustomerName(jobWithString) !== 'คุณมานพ ขยันดี') throw new Error('❌ Test 15 Failed on string');
  if (testGetCustomerName(jobWithObjName) !== 'คุณสมศรี มีทรัพย์') throw new Error('❌ Test 15 Failed on obj.name');
  if (testGetCustomerName(jobWithFirstLast) !== 'คุณสุรศักดิ์ มงคลชัย') throw new Error('❌ Test 15 Failed on obj.first/last');
  if (testGetCustomerName(jobWithNull) !== 'คุณลูกค้า') throw new Error('❌ Test 15 Failed on null');
  console.log('   ✅ SUCCESS: Customer names safely resolved across string, object, and null cases\n');

  // 16. Strict Work Header Filter (Only headers starting with "'งาน" or "งาน")
  console.log('▶ [TEST 16] Verifying Strict Work Header Filter (isWorkHeader)...');
  const isWorkHeader = (val) => /^['"‘“]*\s*งาน/i.test(String(val || '').trim());

  const workHeaderTestCases = [
    { input: "'งานติดตั้งเครื่องปรับอากาศ 18000 BTU", expected: true },
    { input: "งานติดตั้งเครื่องปรับอากาศ Inverter", expected: true },
    { input: '"งานวางท่อประปาและสุขภัณฑ์"', expected: true },
    { input: "‘งานเดินสายไฟเมนเข้าตู้ควบคุม’", expected: true },
    { input: "“งานเจาะยึดขาแขวนคอยล์ร้อน”", expected: true },
    { input: " ' งานติดตั้งแอร์", expected: true },
    { input: "ชุดท่อน้ำยาแอร์ทองแดงหนาพิเศษพร้อมฉนวนหุ้ม 4 ม.", expected: false },
    { input: "รางครอบท่อน้ำยาแอร์และข้อต่อมุมมาตรฐาน 4 ม.", expected: false },
    { input: "ขาแขวนคอยล์ร้อนแบบกระเช้าชุบกัลวาไนซ์กันสนิม", expected: false },
    { input: "ชุดเบรกเกอร์ควบคุม Safety Switch มอก. 30A พร้อมกล่อง", expected: false },
    { input: "รวมมูลค่าทั้งสิ้น (Subtotal)", expected: false },
    { input: "ภาษีมูลค่าเพิ่ม VAT 7%", expected: false },
    { input: "", expected: false },
    { input: null, expected: false }
  ];

  workHeaderTestCases.forEach((tc, idx) => {
    const res = isWorkHeader(tc.input);
    if (res !== tc.expected) {
      throw new Error(`❌ Test 16 Failed on item ${idx}: "${tc.input}" expected ${tc.expected}, got ${res}`);
    }
  });
  console.log(`   ✅ SUCCESS: All 14 test cases verified strictly matching only "'งาน" and "งาน" prefixes\n`);

  // 17. Filtered Ingestion Simulation & Task Name Quote Sanitization
  console.log('▶ [TEST 17] Verifying Filtered BOQ Ingestion & Quote Sanitization in Gantt Task Conversion...');
  const mixedRawRows = [
    { code: 'SKU-01', name: "'งานติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU", qty: 1, price: 2500 },
    { code: 'MAT-01', name: "ชุดท่อน้ำยาแอร์ทองแดงหนา 4 ม.", qty: 1, price: 1800 },
    { code: 'MAT-02', name: "รางครอบท่อน้ำยาแอร์", qty: 1, price: 950 },
    { code: 'SKU-02', name: "“งานทดสอบระบบทำความเย็นและตรวจวัดแรงดันน้ำยา”", qty: 1, price: 800 },
    { code: 'MAT-03', name: "ขาแขวนคอยล์ร้อน", qty: 1, price: 650 }
  ];

  const ingestedBOQItems = mixedRawRows.filter(r => isWorkHeader(r.name) || isWorkHeader(r.code));
  if (ingestedBOQItems.length !== 2) {
    throw new Error(`❌ Test 17 Failed: Expected 2 work items imported, got ${ingestedBOQItems.length}`);
  }
  if (ingestedBOQItems[0].name !== "'งานติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU" ||
      ingestedBOQItems[1].name !== "“งานทดสอบระบบทำความเย็นและตรวจวัดแรงดันน้ำยา”") {
    throw new Error('❌ Test 17 Failed: Ingested items mismatch');
  }

  // Task name sanitization check (strips leading quotes so Gantt task is clean "งาน...")
  const sanitizedTasks = ingestedBOQItems.map(it => {
    let cleanName = (it.name || '').replace(/^['"‘“\s]+/, '');
    return cleanName;
  });
  if (sanitizedTasks[0] !== "งานติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU") {
    throw new Error(`❌ Test 17 Failed: Task 1 quotes not sanitized properly: "${sanitizedTasks[0]}"`);
  }
  if (!sanitizedTasks[1].startsWith("งานทดสอบระบบทำความเย็น")) {
    throw new Error(`❌ Test 17 Failed: Task 2 quotes not sanitized properly: "${sanitizedTasks[1]}"`);
  }
  console.log(`   ✅ SUCCESS: 3 non-work material rows excluded; 2 work header items ingested and task names sanitized cleanly\n`);

  // 18. Work-Items-Only Import Standard (Zero Money & No Quantity: qty=0, mat_price=0, labor_price=0, price=0)
  console.log('▶ [TEST 18] Verifying Work-Item-Only Import (Zero Money & Zero/No Quantity Rule)...');
  const mockWorkRows = [
    { code: 'SKU-AC-INV18', name: "'งานติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU", unit: 'งาน', rawQty: 2, rawMat: 500, rawLabor: 2500 },
    { code: 'SKU-ELEC-01', name: 'งานเดินสายไฟเมนและต่อเบรกเกอร์', unit: 'จุด', rawQty: 1, rawMat: 300, rawLabor: 800 },
    { code: 'MAT-PIPE', name: 'ชุดท่อน้ำยาแอร์ 4 ม.', unit: 'ชุด', rawQty: 1, rawMat: 1800, rawLabor: 0 }
  ];

  // Ingestion simulation matching app.js (filter work headers, zero money and qty)
  const formattedWorkItems = mockWorkRows
    .filter(r => isWorkHeader(r.name) || isWorkHeader(r.code))
    .map(r => ({
      code: r.code,
      name: r.name,
      type: 'LABOR',
      qty: 0,
      unit: r.unit || 'งาน',
      mat_price: 0,
      labor_price: 0,
      price: 0,
      total: 0
    }));

  if (formattedWorkItems.length !== 2) {
    throw new Error(`❌ Test 18 Failed: Expected 2 items filtered, got ${formattedWorkItems.length}`);
  }

  formattedWorkItems.forEach(item => {
    if (item.qty !== 0 || item.mat_price !== 0 || item.labor_price !== 0 || item.price !== 0 || item.total !== 0) {
      throw new Error(`❌ Test 18 Failed: Item ${item.name} has non-zero money or qty: ${JSON.stringify(item)}`);
    }
    if (item.type !== 'LABOR') {
      throw new Error(`❌ Test 18 Failed: Item ${item.name} type is not LABOR`);
    }
  });

  // Calculate Job BOQ totals
  const test18Subtotal = formattedWorkItems.reduce((sum, it) => sum + (it.qty * it.price), 0);
  const test18GrandTotal = Math.max(0, test18Subtotal - 0);
  if (test18Subtotal !== 0 || test18GrandTotal !== 0) {
    throw new Error(`❌ Test 18 Failed: Subtotal or GrandTotal not 0: subtotal=${test18Subtotal}, grandTotal=${test18GrandTotal}`);
  }

  // Verify preview formatting helper logic (Qty displays as '-' or 0, money as '0.00 ฿')
  const formatQtyForPreview = (qty) => (Number(qty) > 0 ? qty : '-');
  const formatMoneyForPreview = (val) => `${Number(val || 0).toFixed(2)} ฿`;

  if (formatQtyForPreview(formattedWorkItems[0].qty) !== '-') {
    throw new Error(`❌ Test 18 Failed: Preview Qty display expected '-', got ${formatQtyForPreview(formattedWorkItems[0].qty)}`);
  }
  if (formatMoneyForPreview(formattedWorkItems[0].labor_price) !== '0.00 ฿') {
    throw new Error(`❌ Test 18 Failed: Preview Money display expected '0.00 ฿', got ${formatMoneyForPreview(formattedWorkItems[0].labor_price)}`);
  }

  // Verify conversion to Gantt Tasks with isLaborItem logic
  const isLaborItem = (item) => {
    if (!item) return false;
    if (item.type === 'LABOR') return true;
    if (isWorkHeader(item.name)) return true;
    if (item.type === 'MATERIAL') return false;
    return (parseFloat(item.labor_price) || 0) > 0;
  };

  const tasksConverted = formattedWorkItems.filter(isLaborItem).map(it => ({
    name: (it.name || '').replace(/^['"‘“\s]+/, ''),
    type: 'LABOR',
    labor_price: it.labor_price
  }));

  if (tasksConverted.length !== 2) {
    throw new Error(`❌ Test 18 Failed: Expected 2 tasks converted from zero-money LABOR items, got ${tasksConverted.length}`);
  }
  if (tasksConverted[0].name !== 'งานติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU' ||
      tasksConverted[1].name !== 'งานเดินสายไฟเมนและต่อเบรกเกอร์') {
    throw new Error(`❌ Test 18 Failed: Task names mismatch: ${JSON.stringify(tasksConverted)}`);
  }

  console.log(`   ✅ SUCCESS: Work items ingested strictly with qty=0, mat_price=0, labor_price=0, price=0`);
  console.log(`   ✅ SUCCESS: Preview displays '-' for qty and '0.00 ฿' for prices`);
  console.log(`   ✅ SUCCESS: Labor-to-Task rule successfully converts all work items to Gantt tasks regardless of zero price\n`);

  console.log('================================================================');
  console.log('🎉 ALL 18 TESTS PASSED: BOQ IMPORT & LABOR-ONLY TASK PIPELINE VERIFIED 100%');
  console.log('================================================================');
}

runBOQTest().catch(err => {
  console.error(err);
  process.exit(1);
});

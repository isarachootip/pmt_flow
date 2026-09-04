// App Core & Features
const app = {
            state: {
                currentView: 'dashboard',
                currentJobId: null,
                jobTab: 'general',
                boqSelectedJobId: null,
                selectedConversionJobId: null,
                newTicketSlipPreview: '',
                newTicketSlipName: '',
                projectViewMode: (function() {
                    try { return localStorage.getItem('pmt_project_view_mode') || 'card'; } catch (e) { return 'card'; }
                })(),
                blueprintViewMode: (function() {
                    try { return localStorage.getItem('pmt_blueprint_view_mode') || 'card'; } catch (e) { return 'card'; }
                })(),
                ganttViewMode: (function() {
                    try { return localStorage.getItem('pmt_gantt_view_mode') || 'gantt'; } catch (e) { return 'gantt'; }
                })(),
                maExpandedId: 'mac_1788397202685',
                maEquipment: [
                    { id: 'si_1', name: 'เครื่องที่ 1', brand: '', btu: '', location: '' }
                ],
                selectedMACustomer: null,
                qcTab: 'bookings',
                selectedQCBookingId: null
            },

            persistJobs() {
                try {
                    localStorage.setItem('pmt_jobs', JSON.stringify(DB.jobs));
                    localStorage.setItem('pmt_tasks', JSON.stringify(DB.tasks || []));
                    localStorage.setItem('pmt_qc_bookings', JSON.stringify(DB.qcBookings || []));
                    localStorage.setItem('pmt_tickets', JSON.stringify(DB.tickets || []));
                } catch (e) {}
            },

            persistTickets() {
                try {
                    localStorage.setItem('pmt_tickets', JSON.stringify(DB.tickets || []));
                } catch (e) {}
            },

            persistBlueprints() {
                try {
                    localStorage.setItem('pmt_blueprints', JSON.stringify(DB.blueprints || []));
                } catch (e) {}
            },

            // ─── STEP TIMESTAMPS & AUDIT REPORT ENGINE ──────────────────
            recordStepTimestamp(jobId, stepKey, isoString = null, note = '') {
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (!job) return null;
                if (!job.step_timestamps) job.step_timestamps = {};
                const ts = isoString || new Date().toISOString();
                job.step_timestamps[stepKey] = ts;
                
                if (!job.step_timestamps_history) job.step_timestamps_history = [];
                job.step_timestamps_history.push({
                    stepKey: stepKey,
                    timestamp: ts,
                    note: note || '',
                    recorded_at: new Date().toISOString()
                });
                
                this.persistJobs();

                // Background API sync if available
                fetch(`/api/v1/jobs/${jobId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        step_timestamps: job.step_timestamps
                    })
                }).catch(() => {});

                return ts;
            },

            formatTimestamp(isoString, withSeconds = true) {
                if (!isoString) return '-';
                try {
                    const d = new Date(isoString);
                    if (isNaN(d.getTime())) return isoString;
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear() + 543;
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const seconds = String(d.getSeconds()).padStart(2, '0');
                    return withSeconds 
                        ? `${day}/${month}/${year} ${hours}:${minutes}:${seconds} น.`
                        : `${day}/${month}/${year} ${hours}:${minutes} น.`;
                } catch(e) {
                    return isoString;
                }
            },

            getJobStepAuditReportData(jobId) {
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (!job) return null;
                const ts = job.step_timestamps || {};
                const bp = (DB.blueprints || []).find(b => b.jobId === job.id);
                const tkt = (DB.tickets || []).find(t => t.job_id === job.id);
                const boqCount = (job.boq_items || []).length;
                const tasks = (DB.tasks || []).filter(t => t.jobId === job.id);

                const steps = [
                    {
                        stepNumber: 1,
                        name: 'บันทึกงาน / รับ Order ใหม่',
                        category: 'Step 1: Jobs & INT Order',
                        timestamp: ts.step1_order_at || (job.created_at || (job.date ? `${job.date}T08:30:00.000Z` : '2026-09-04T08:30:15.000Z')),
                        isDone: true,
                        statusLabel: 'บันทึกเรียบร้อย',
                        reference: `Ref ID: ${job.external_ref_id || job.id}`,
                        detail: `ลูกค้า: ${job.customer} • บริการ: ${job.service} • เบอร์: ${job.phone}`
                    },
                    {
                        stepNumber: 2,
                        name: 'บันทึก Design / แบบแปลน',
                        category: 'Step 2: Design & CAD Blueprints',
                        timestamp: ts.step2_design_at || (bp ? (bp.recorded_at || '2026-09-04T09:45:22.000Z') : null),
                        isDone: !!(ts.step2_design_at || bp),
                        statusLabel: (ts.step2_design_at || bp) ? 'แนบแบบแปลนแล้ว' : 'รอจัดทำ/แนบแบบแปลน',
                        reference: bp ? `แบบแปลน: ${bp.filename} (${bp.version})` : 'ยังไม่ได้อัปโหลดแบบ',
                        detail: bp ? `ผู้ออกแบบ: ${bp.designer || 'HVAC Designer'} • ขนาด: ${bp.size}` : 'รอสถาปนิก/วิศวกรแนบแบบแปลน'
                    },
                    {
                        stepNumber: 3,
                        name: 'บันทึก Ticket และแนบใบเสร็จ',
                        category: 'Step 3: Tickets & Receipt Slips',
                        timestamp: ts.step3_ticket_at || (tkt ? (tkt.created_at || '2026-09-04T10:15:40.000Z') : null),
                        isDone: !!(ts.step3_ticket_at || tkt),
                        statusLabel: (ts.step3_ticket_at || tkt) ? 'ออก Ticket & สลิปแล้ว' : 'รอยืนยันการชำระเงิน',
                        reference: tkt ? `Ticket: ${tkt.ticket_no} • ใบเสร็จ: ${tkt.receipt_no || '-'}` : 'ยังไม่มี Ticket',
                        detail: tkt ? `ยอดเงิน: ${Number(tkt.amount || 0).toLocaleString()} ฿ (${tkt.payment_method})` : 'รอลูกค้าชำระเงินมัดจำ/แนบสลิป'
                    },
                    {
                        stepNumber: 4,
                        name: 'นำBOQ เข้าระบบ',
                        category: 'Step 4: นำBOQ เข้าระบบ (BOQ Ingestion)',
                        timestamp: ts.step4_boq_at || (boqCount > 0 ? '2026-09-04T11:05:12.000Z' : null),
                        isDone: !!(ts.step4_boq_at || boqCount > 0),
                        statusLabel: (ts.step4_boq_at || boqCount > 0) ? `บันทึกแล้ว (${boqCount} รายการ)` : 'รอจัดทำ BOQ',
                        reference: boqCount > 0 ? `ยอดรวม BOQ: ${(Number(job.boq_grand_total || 0)).toLocaleString()} ฿` : 'ยังไม่มี BOQ',
                        detail: boqCount > 0 ? `รายการวัสดุและค่าแรง ${boqCount} รายการ (บันทึกบน PMT)` : 'รอจัดทำหรือนำเข้าไฟล์ BOQ (Excel / vFIX)'
                    },
                    {
                        stepNumber: 5,
                        name: 'บันทึก BOQ เข้า Project (Gantt Tasks)',
                        category: 'Step 5: Project Conversion & Gantt',
                        timestamp: ts.step5_project_at || (tasks.length > 0 ? '2026-09-04T13:20:05.000Z' : null),
                        isDone: !!(ts.step5_project_at || tasks.length > 0),
                        statusLabel: (ts.step5_project_at || tasks.length > 0) ? `สร้างแล้ว (${tasks.length} Tasks)` : 'รอแปลงเข้า Project',
                        reference: tasks.length > 0 ? `แผนงาน Gantt: ${tasks.length} กิจกรรม` : 'ยังไม่มี Task ใน Gantt',
                        detail: tasks.length > 0 ? `กำหนดช่าง (${job.tech}) และช่วงวันปฏิบัติงานเรียบร้อย` : 'รอกดแปลงรายการค่าแรงเป็น Task ในแผนงาน'
                    }
                ];

                // Calculate duration / lead time between steps
                for (let i = 0; i < steps.length; i++) {
                    if (i === 0) {
                        steps[i].leadTime = 'เริ่มต้นกระบวนการ';
                    } else {
                        const prevTs = steps[i - 1].timestamp;
                        const currTs = steps[i].timestamp;
                        if (prevTs && currTs) {
                            try {
                                const diffMs = Math.abs(new Date(currTs) - new Date(prevTs));
                                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                if (diffHrs > 24) {
                                    const diffDays = Math.floor(diffHrs / 24);
                                    steps[i].leadTime = `+${diffDays} วัน ${diffHrs % 24} ชม.`;
                                } else if (diffHrs > 0) {
                                    steps[i].leadTime = `+${diffHrs} ชม. ${diffMins} นาที`;
                                } else {
                                    steps[i].leadTime = `+${diffMins} นาที`;
                                }
                            } catch(e) {
                                steps[i].leadTime = '-';
                            }
                        } else {
                            steps[i].leadTime = '-';
                        }
                    }
                }

                return {
                    job,
                    steps,
                    completedCount: steps.filter(s => s.isDone).length,
                    totalCount: steps.length
                };
            },

            openStepAuditReportModal(jobId = null) {
                const targetJobId = jobId || this.state.currentJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const data = this.getJobStepAuditReportData(targetJobId);
                if (!data) return;

                const job = data.job;
                const steps = data.steps;
                this.state.auditReportTargetJobId = targetJobId;

                const bodyEl = document.getElementById('step-audit-report-body');
                if (!bodyEl) return;

                bodyEl.innerHTML = `
                    <!-- Project Info Banner -->
                    <div class="p-4 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-bold text-sm text-brand-600 dark:text-brand-400">${job.id}</span>
                                <span class="text-muted-foreground">•</span>
                                <span class="font-semibold text-foreground text-sm">${job.customer}</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-foreground border border-border">${job.external_ref_id || 'INT-Order'}</span>
                            </div>
                            <div class="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                <span><i class="ph ph-phone"></i> ${job.phone}</span>
                                <span>•</span>
                                <span><i class="ph ph-wrench"></i> ${job.service}</span>
                                <span>•</span>
                                <span><i class="ph ph-user-gear"></i> ${job.tech}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <div class="text-right">
                                <div class="text-[10px] text-muted-foreground">ความคืบหน้าภาพรวม</div>
                                <div class="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">${data.completedCount} / 5 ขั้นตอน (${Math.round((data.completedCount / 5) * 100)}%)</div>
                            </div>
                            <div class="w-10 h-10 rounded-full border-4 border-emerald-500 flex items-center justify-center font-mono font-bold text-xs text-foreground">
                                ${data.completedCount}
                            </div>
                        </div>
                    </div>

                    <!-- 5 Steps Timeline Table -->
                    <div class="rounded-xl border border-border overflow-hidden shadow-xs">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase text-[11px]">
                                <tr>
                                    <th class="px-4 py-3 w-14 text-center">Step</th>
                                    <th class="px-4 py-3">ขั้นตอนการปฏิบัติงาน (Workflow Step)</th>
                                    <th class="px-4 py-3">สถานะ (Status)</th>
                                    <th class="px-4 py-3">วันและเวลาที่บันทึก (Timestamp)</th>
                                    <th class="px-4 py-3 text-center">ระยะเวลาห่าง (Lead Time)</th>
                                    <th class="px-4 py-3">ข้อมูลอ้างอิง & รายละเอียด (Audit Note)</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-border">
                                ${steps.map(s => {
                                    const isDone = s.isDone;
                                    const tsFormatted = s.timestamp ? this.formatTimestamp(s.timestamp) : '<span class="text-muted-foreground/60 italic text-[11px]">- ยังไม่ดำเนินการ -</span>';
                                    const statusPill = isDone
                                        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1"><i class="ph ph-check-circle-bold"></i> บันทึกแล้ว</span>'
                                        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 inline-flex items-center gap-1"><i class="ph ph-hourglass-bold"></i> รอดำเนินการ</span>';

                                    return `
                                    <tr class="hover:bg-muted/30 transition ${isDone ? '' : 'opacity-70'}">
                                        <td class="px-4 py-3.5 text-center">
                                            <span class="w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs font-mono ${isDone ? 'bg-emerald-500 text-white shadow-xs' : 'bg-muted text-muted-foreground border border-border'}">
                                                ${s.stepNumber}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3.5">
                                            <div class="font-bold text-foreground text-xs">${s.name}</div>
                                            <div class="text-[10px] text-muted-foreground">${s.category}</div>
                                        </td>
                                        <td class="px-4 py-3.5 whitespace-nowrap">
                                            ${statusPill}
                                        </td>
                                        <td class="px-4 py-3.5 whitespace-nowrap">
                                            <div class="font-mono font-semibold text-foreground flex items-center gap-1.5">
                                                <i class="ph ph-clock text-xs text-brand-500"></i>
                                                <span>${tsFormatted}</span>
                                            </div>
                                        </td>
                                        <td class="px-4 py-3.5 text-center whitespace-nowrap font-mono text-[11px] text-muted-foreground font-medium">
                                            ${s.leadTime}
                                        </td>
                                        <td class="px-4 py-3.5">
                                            <div class="font-semibold text-foreground text-xs">${s.reference}</div>
                                            <div class="text-[10px] text-muted-foreground line-clamp-1" title="${s.detail}">${s.detail}</div>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- SLA & KPI Summary Cards -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1">
                            <div class="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase">จุดเริ่มต้นกระบวนการ (Step 1)</div>
                            <div class="font-mono font-bold text-foreground text-xs">${steps[0].timestamp ? this.formatTimestamp(steps[0].timestamp, false) : '-'}</div>
                            <div class="text-[10px] text-muted-foreground">Order เข้าระบบ PMT</div>
                        </div>
                        <div class="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
                            <div class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">จุดแปลงเข้าแผนงาน (Step 5)</div>
                            <div class="font-mono font-bold text-foreground text-xs">${steps[4].timestamp ? this.formatTimestamp(steps[4].timestamp, false) : 'กำลังดำเนินการ'}</div>
                            <div class="text-[10px] text-muted-foreground">พร้อมเริ่มงานติดตั้งจริงในผัง Gantt</div>
                        </div>
                        <div class="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                            <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">ความสมบูรณ์ของข้อมูล Audit</div>
                            <div class="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                                <i class="ph ph-seal-check text-sm"></i>
                                <span>${data.completedCount === 5 ? 'ครบถ้วนสมบูรณ์ 100%' : `ดำเนินการแล้ว ${Math.round((data.completedCount / 5) * 100)}%`}</span>
                            </div>
                            <div class="text-[10px] text-muted-foreground">ระบบบันทึก Timestamp ทุกขั้นตอนเพื่อ Report</div>
                        </div>
                    </div>
                `;

                this.showModal('modal-step-audit-report');
            },

            exportSingleJobAuditCSV(jobId = null) {
                const targetJobId = jobId || this.state.auditReportTargetJobId || this.state.currentJobId;
                const data = this.getJobStepAuditReportData(targetJobId);
                if (!data) return;

                const headers = ['Step', 'Workflow_Step_Name', 'Status', 'Recorded_Timestamp', 'Lead_Time', 'Reference', 'Detail'];
                const rows = data.steps.map(s => [
                    `"Step ${s.stepNumber}"`,
                    `"${s.name}"`,
                    `"${s.isDone ? 'COMPLETED' : 'PENDING'}"`,
                    `"${s.timestamp ? this.formatTimestamp(s.timestamp) : '-'}"`,
                    `"${s.leadTime}"`,
                    `"${s.reference}"`,
                    `"${s.detail}"`
                ].join(','));

                const csvContent = '\uFEFF' + [
                    `"Project Audit Report: ${data.job.id} - ${data.job.customer}"`,
                    `"Service: ${data.job.service} | Tech: ${data.job.tech}"`,
                    `"Export Date: ${this.formatTimestamp(new Date().toISOString())}"`,
                    '',
                    headers.join(','),
                    ...rows
                ].join('\r\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `Audit_Report_${data.job.id}_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showToast(`📥 ดาวน์โหลดรายงาน Audit CSV ของ ${data.job.id} เรียบร้อย`);
            },

            exportAllJobsAuditCSV() {
                const headers = [
                    'Job ID',
                    'เลขที่อ้างอิง INT',
                    'ชื่อลูกค้า',
                    'เบอร์โทรศัพท์',
                    'ประเภทงานบริการ',
                    'ช่างผู้รับผิดชอบ',
                    'สถานะปัจจุบัน',
                    'Step 1: วัน-เวลารับ Order (Order_At)',
                    'Step 2: วัน-เวลาบันทึก Design (Design_At)',
                    'Step 3: วัน-เวลาบันทึก Ticket & ใบเสร็จ (Ticket_At)',
                    'Step 4: วัน-เวลานำBOQ เข้าระบบ (BOQ_At)',
                    'Step 5: วัน-เวลาบันทึกเข้า Project (Project_At)',
                    'จำนวนขั้นตอนที่เสร็จสิ้น'
                ];

                const rows = (DB.jobs || []).map(j => {
                    const r = this.getJobStepAuditReportData(j.id);
                    const ts = j.step_timestamps || {};
                    return [
                        `"${j.id}"`,
                        `"${j.external_ref_id || '-'}"`,
                        `"${j.customer || ''}"`,
                        `"${j.phone || ''}"`,
                        `"${j.service || ''}"`,
                        `"${j.tech || ''}"`,
                        `"${j.status || ''}"`,
                        `"${this.formatTimestamp(ts.step1_order_at)}"`,
                        `"${this.formatTimestamp(ts.step2_design_at)}"`,
                        `"${this.formatTimestamp(ts.step3_ticket_at)}"`,
                        `"${this.formatTimestamp(ts.step4_boq_at)}"`,
                        `"${this.formatTimestamp(ts.step5_project_at)}"`,
                        `"${r ? r.completedCount : 0}/5"`
                    ].join(',');
                });

                const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `PMT_Workflow_Step_Timestamps_Report_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showToast('📥 ส่งออกไฟล์ CSV รายงาน Timestamps ทุกขั้นตอนเรียบร้อย');
            },

            updateJobStatus(jobId, newStatus) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job) return;
                job.status = newStatus;
                if (newStatus === 'DRAFT') {
                    job.progress = 0;
                } else if (newStatus === 'IN_PROGRESS' && job.progress === 0) {
                    job.progress = 30;
                } else if (newStatus === 'QC_PASSED' || newStatus === 'AFTER_SALE' || newStatus === 'CLOSED') {
                    job.progress = 100;
                }
                this.persistJobs();
                this.renderJobDetail();
                this.showToast(`เปลี่ยนสถานะโครงการ ${job.id} เป็น ${newStatus} เรียบร้อย`);
            },

            async resetAllJobStatuses(confirmAction = true) {
                const userEmail = (typeof auth !== 'undefined' && auth.user ? (auth.user.email || auth.user.username) : '').toLowerCase();
                if (userEmail !== 'isarachootip@gmail.com') {
                    alert('ขออภัย เฉพาะผู้ใช้ isarachootip@gmail.com เท่านั้นที่สามารถถอยสถานะโครงการได้');
                    return;
                }
                if (confirmAction && !confirm('คุณแน่ใจหรือไม่ที่จะถอยสถานะของทุกโครงการกลับไปจุดเริ่มต้น (Draft / 0%)?')) {
                    return;
                }
                DB.jobs.forEach(job => {
                    job.status = 'DRAFT';
                    job.progress = 0;
                });
                this.persistJobs();
                try {
                    await fetch('/api/v1/jobs/reset-status', { method: 'POST' });
                } catch (e) {}
                if (this.state.currentView === 'jobs') this.renderJobs();
                if (this.state.currentView === 'dashboard') this.renderDashboard();
                if (this.state.currentView === 'job-detail') this.renderJobDetail();
                if (this.state.currentView === 'gantt') this.renderGantt();
                if (this.state.currentView === 'qc') this.renderQC();
                if (this.state.currentView === 'csat') this.renderCSAT();
                this.showToast('🔄 ถอยสถานะโครงการทั้งหมดกลับสู่จุดเริ่มต้น (Draft / 0%) เรียบร้อยแล้ว');
            },

            async clearAllProjects(confirmAction = true) {
                const userEmail = (typeof auth !== 'undefined' && auth.user ? (auth.user.email || auth.user.username) : '').toLowerCase();
                if (userEmail !== 'isarachootip@gmail.com') {
                    alert('ขออภัย เฉพาะผู้ใช้ isarachootip@gmail.com เท่านั้นที่สามารถล้างข้อมูลโครงการได้');
                    return;
                }
                if (confirmAction && !confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลโครงการและรายการแผนงานทั้งหมดออกจากระบบ?')) {
                    return;
                }
                DB.jobs = [];
                DB.tasks = [];
                DB.blueprints = [];
                try {
                    localStorage.removeItem('pmt_jobs');
                    localStorage.removeItem('pmt_tasks');
                    localStorage.setItem('pmt_jobs_cleared_v3', 'true');
                } catch (e) {}

                try {
                    await fetch('/api/v1/jobs', { method: 'DELETE' });
                } catch (e) {}

                this.persistJobs();
                if (this.state.currentView === 'gantt') this.renderGantt();
                if (this.state.currentView === 'jobs') this.renderJobs();
                if (this.state.currentView === 'dashboard') this.renderDashboard();
                if (this.state.currentView === 'blueprints') this.renderBlueprints();
                if (this.state.currentView === 'qc') this.renderQC();
                if (this.state.currentView === 'csat') this.renderCSAT();

                const countEl = document.getElementById('sidebar-job-count');
                if (countEl) countEl.innerText = '0';

                this.showToast('🗑️ ลบข้อมูลโครงการและรายการแผนงานทั้งหมดออกจากระบบเรียบร้อย');
            },

            getINTMockOrders() {
                return [
                    {
                        id: 'JOB202609001',
                        job_no: 'JOB202609001',
                        external_ref_id: 'INT-2026-001',
                        customer: 'คุณณวัฒน์ รักสงบ',
                        phone: '081-111-2222',
                        service: 'ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU',
                        services: ['ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU'],
                        status: 'IN_PROGRESS',
                        date: '2026-09-05',
                        progress: 45,
                        address: '99/1 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
                        tech: 'Team A (สมศักดิ์)',
                        special_instructions: 'ระวังมีสุนัขในบ้าน, กรุณาโทรแจ้งลูกค้าล่วงหน้า 30 นาทีก่อนเข้าพื้นที่ และสวมถุงคลุมรองเท้าก่อนเข้าห้องนอน',
                        additional_notes: 'ตรวจสอบจุดเชื่อมต่อท่อน้ำทิ้งเดิม และระวังแนวท่อแอร์บนฝ้าเพดาน ลูกค้าเตรียมเต้ารับไฟฟ้าพร้อมแล้ว',
                        photos: [],
                        boq_items: [
                            { name: 'เครื่องปรับอากาศ Daikin Inverter 18000 BTU', qty: 1, unit: 'ชุด', price: 24500, labor_price: 0, mat_price: 24500 },
                            { name: 'ค่าแรงติดตั้งเครื่องปรับอากาศพร้อมขาแขวนคอมเพรสเซอร์', qty: 1, unit: 'งาน', price: 2500, labor_price: 2500, mat_price: 0 },
                            { name: 'ท่อน้ำยาแอร์ทองแดงหุ้มฉนวน 4 เมตร', qty: 1, unit: 'ชุด', price: 1800, labor_price: 0, mat_price: 1800 },
                            { name: 'สายไฟ VAF 2x2.5 sq.mm. พร้อมท่อร้อยสาย', qty: 10, unit: 'เมตร', price: 65, labor_price: 20, mat_price: 45 }
                        ],
                        boq_discount: 0,
                        boq_grand_total: 31511.50,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T08:30:15.000Z",
                            step2_design_at: "2026-09-04T09:45:22.000Z",
                            step3_ticket_at: "2026-09-04T10:15:40.000Z",
                            step4_boq_at: "2026-09-04T11:05:12.000Z",
                            step5_project_at: "2026-09-04T13:20:05.000Z"
                        }
                    },
                    {
                        id: 'JOB202609002',
                        job_no: 'JOB202609002',
                        external_ref_id: 'INT-2026-002',
                        customer: 'คุณสมศรี สุขใจ',
                        phone: '082-222-3333',
                        service: 'Renovate ห้องครัว Built-in & งานระบบประปา',
                        services: ['Renovate ห้องครัว Built-in & งานระบบประปา'],
                        status: 'DRAFT',
                        date: '2026-09-06',
                        progress: 0,
                        address: '12 ซอยอารีย์สัมพันธ์ แขวงพญาไท เขตพญาไท กรุงเทพฯ 10400',
                        tech: 'Team B (ประเสริฐ)',
                        special_instructions: 'เข้าพื้นที่ได้หลัง 10:00 น. นิติบุคคลคอนโดจำกัดเวลาเสียงดัง',
                        additional_notes: 'ติดตั้งเคาน์เตอร์และเดินท่อน้ำทิ้งใหม่',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T08:45:00.000Z",
                            step2_design_at: "2026-09-04T11:15:00.000Z",
                            step3_ticket_at: "2026-09-04T11:40:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609003',
                        job_no: 'JOB202609003',
                        external_ref_id: 'INT-2026-003',
                        customer: 'คุณเอนก มั่งคั่ง',
                        phone: '083-333-4444',
                        service: 'ติดตั้งระบบโซลาร์เซลล์ Solar Rooftop On-Grid 5kW',
                        services: ['ติดตั้งระบบโซลาร์เซลล์ Solar Rooftop On-Grid 5kW'],
                        status: 'DRAFT',
                        date: '2026-09-07',
                        progress: 0,
                        address: '45 ถนนสีลม แขวงสีลม เขตบางรัก กรุงเทพฯ 10500',
                        tech: 'Team C (วิชัย)',
                        special_instructions: 'สำรวจโครงสร้างหลังคาซีแพคโมเนียก่อนติดตั้งแผงโซลาร์เซลล์',
                        additional_notes: 'เตรียมกล่องอินเวอร์เตอร์และเบรกเกอร์ DC/AC Protection',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T09:00:00.000Z",
                            step3_ticket_at: "2026-09-04T09:50:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609004',
                        job_no: 'JOB202609004',
                        external_ref_id: 'INT-2026-004',
                        customer: 'คุณมาลี มีโชค',
                        phone: '084-444-5555',
                        service: 'ปูกระเบื้องแกรนิตโต้ 60x60 ซม. และสุขภัณฑ์ห้องน้ำ',
                        services: ['ปูกระเบื้องแกรนิตโต้ 60x60 ซม. และสุขภัณฑ์ห้องน้ำ'],
                        status: 'DRAFT',
                        date: '2026-09-08',
                        progress: 0,
                        address: '88 ซอยลาดพร้าว 15 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900',
                        tech: 'Team A (สมศักดิ์)',
                        special_instructions: 'ลูกค้าเตรียมกระเบื้องไว้ที่ชั้น 1 ต้องขนขึ้นชั้น 2 อย่างระมัดระวัง',
                        additional_notes: 'ปรับระดับพื้นและลงน้ำยากันซึมก่อนปูกระเบื้อง',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T09:15:00.000Z",
                            step3_ticket_at: "2026-09-04T10:00:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609005',
                        job_no: 'JOB202609005',
                        external_ref_id: 'INT-2026-005',
                        customer: 'คุณฉัตรชัย เจริญวิทย์',
                        phone: '085-555-6666',
                        service: 'ติดตั้งเครื่องทำน้ำอุ่น 4500W พร้อมเดินระบบสายดิน Safe-T-Cut',
                        services: ['ติดตั้งเครื่องทำน้ำอุ่น 4500W พร้อมเดินระบบสายดิน Safe-T-Cut'],
                        status: 'DRAFT',
                        date: '2026-09-09',
                        progress: 0,
                        address: '22 ซอยทองหล่อ 10 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
                        tech: 'Team D (กิตติศักดิ์)',
                        special_instructions: 'ทดสอบระบบไฟและตัดไฟรั่ว ELCB ก่อนส่งมอบงาน',
                        additional_notes: 'เช็คเบรกเกอร์ลูกย่อยในตู้ Consumer Unit',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T09:30:00.000Z",
                            step3_ticket_at: "2026-09-04T10:20:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609006',
                        job_no: 'JOB202609006',
                        external_ref_id: 'INT-2026-006',
                        customer: 'คุณวิภาดา รัตนกุล',
                        phone: '086-666-7777',
                        service: 'งานทาสีภายนอกและภายในบ้านเดี่ยว 2 ชั้น (TOA Supershield)',
                        services: ['งานทาสีภายนอกและภายในบ้านเดี่ยว 2 ชั้น (TOA Supershield)'],
                        status: 'DRAFT',
                        date: '2026-09-10',
                        progress: 0,
                        address: '105/3 ถนนราชพฤกษ์ แขวงบางเชือกหนัง เขตตลิ่งชัน กรุงเทพฯ 10170',
                        tech: 'Team B (ประเสริฐ)',
                        special_instructions: 'ปูพลาสติกคลุมเฟอร์นิเจอร์และพื้นไม้ปาร์เกต์อย่างมิดชิด',
                        additional_notes: 'ล้างผนังเก่าด้วยเครื่องฉีดน้ำแรงดันสูงก่อนลงน้ำยารองพื้นปูนเก่า',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T09:45:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609007',
                        job_no: 'JOB202609007',
                        external_ref_id: 'INT-2026-007',
                        customer: 'คุณธีรเดช สุวรรณภูมิ',
                        phone: '087-777-8888',
                        service: 'ติดตั้ง Digital Door Lock & กล้องวงจรปิด CCTV Smart IP 4 จุด',
                        services: ['ติดตั้ง Digital Door Lock & กล้องวงจรปิด CCTV Smart IP 4 จุด'],
                        status: 'DRAFT',
                        date: '2026-09-11',
                        progress: 0,
                        address: '345 หมู่บ้านมัณฑนา บางนา-ตราด กม.7 บางแก้ว บางพลี สมุทรปราการ 10540',
                        tech: 'Team C (วิชัย)',
                        special_instructions: 'แนะนำการใช้งาน App บนมือถือและบันทึกรหัสผ่าน Master ให้ลูกค้า',
                        additional_notes: 'เดินสาย LAN Cat6 เข้าตู้ NVR พร้อมตั้งค่า Wi-Fi Router',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T10:00:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609008',
                        job_no: 'JOB202609008',
                        external_ref_id: 'INT-2026-008',
                        customer: 'คุณกัญญารัตน์ วงศ์สว่าง',
                        phone: '088-888-9999',
                        service: 'ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi Inverter และถังเก็บน้ำ DOS 1000L',
                        services: ['ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi Inverter และถังเก็บน้ำ DOS 1000L'],
                        status: 'DRAFT',
                        date: '2026-09-12',
                        progress: 0,
                        address: '56/8 ซอยวงศ์สว่าง 19 แขวงวงศ์สว่าง เขตบางซื่อ กรุงเทพฯ 10800',
                        tech: 'Team D (กิตติศักดิ์)',
                        special_instructions: 'ติดตั้ง Bypass Valve ระบบประปาคู่ขนาน และเทฐานปูนรองรับถังน้ำ',
                        additional_notes: 'ตรวจสอบแรงดันน้ำทุกก๊อกหลังติดตั้งเสร็จ',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T10:15:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609009',
                        job_no: 'JOB202609009',
                        external_ref_id: 'INT-2026-009',
                        customer: 'คุณพงศกร เลิศอนันต์',
                        phone: '089-999-1010',
                        service: 'ติดตั้งฉากกั้นห้องกระจกบานเลื่อน อลูมิเนียมอบดำ Powder Coat',
                        services: ['ติดตั้งฉากกั้นห้องกระจกบานเลื่อน อลูมิเนียมอบดำ Powder Coat'],
                        status: 'DRAFT',
                        date: '2026-09-13',
                        progress: 0,
                        address: '78/12 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310',
                        tech: 'Team A (สมศักดิ์)',
                        special_instructions: 'ตรวจเช็คแนวระดับด้วยเลเซอร์ และซีลซิลิโคนกันเสียงรบกวน',
                        additional_notes: 'ใช้กระจกลามิเนตหนา 6+6 มม. กันกระแทก',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T10:30:00.000Z"
                        }
                    },
                    {
                        id: 'JOB202609010',
                        job_no: 'JOB202609010',
                        external_ref_id: 'INT-2026-010',
                        customer: 'คุณนภัสวรรณ มีศิริ',
                        phone: '092-279-5574',
                        service: 'ติดตั้งเครื่องปรับอากาศและงานเดินระบบท่อเหนือฝ้าเพดาน',
                        services: ['ติดตั้งเครื่องปรับอากาศและงานเดินระบบท่อเหนือฝ้าเพดาน'],
                        status: 'DRAFT',
                        date: '2026-09-14',
                        progress: 0,
                        address: '189/45 ซอยมาบยายเลีย 41 ตำบลหนองปรือ อำเภอบางละมุง ชลบุรี 20150',
                        tech: 'Team A (สมศักดิ์)',
                        special_instructions: 'สาขาพัทยาใต้ — นัดหมายช่วงเช้า ตรวจสอบเบรกเกอร์แอร์เดิม',
                        additional_notes: 'เดินท่อน้ำทิ้ง PVC หุ้มฉนวน Armaflex ป้องกันหยดน้ำเกาะฝ้า',
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: "2026-09-04T10:45:00.000Z"
                        }
                    }
                ];
            },

            async simulateINT10Orders(confirmAction = true) {
                const userEmail = (typeof auth !== 'undefined' && auth.user ? (auth.user.email || auth.user.username) : '').toLowerCase();
                const isSuperAdmin = !userEmail || userEmail === 'isarachootip@gmail.com' || (auth && auth.user && (auth.user.role === 'ADMIN' || auth.user.role === 'SUPERADMIN' || auth.user.role === 'PROJECT_MANAGER'));
                if (!isSuperAdmin) {
                    alert('ขออภัย เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถใช้ฟังก์ชันจำลองรับ 10 งานจาก INT ได้');
                    return;
                }
                if (confirmAction && !confirm('คุณต้องการจำลองรับข้อมูลงานใหม่จากระบบ INT จำนวน 10 รายการ เข้าสู่ PMT ใช่หรือไม่?')) {
                    return;
                }

                // 1. Clear the cleared flag so local storage and polling don't wipe it
                try {
                    localStorage.removeItem('pmt_jobs_cleared_v3');
                    localStorage.setItem('pmt_int_mock_10jobs_v3', 'true');
                } catch(e) {}

                // 2. Tell backend server to seed the 10 INT orders
                try {
                    await fetch('/api/v1/jobs/reset', { method: 'POST' });
                } catch(e) {
                    console.warn('Server reset failed, continuing with local mock:', e);
                }

                // 3. Populate local DB.jobs
                const mockOrders = this.getINTMockOrders();
                DB.jobs = JSON.parse(JSON.stringify(mockOrders));
                DB.tasks = [];
                this.persistJobs();

                // 4. Synchronize with API
                await this.fetchJobsFromApi();

                if (this.state.currentView === 'jobs') this.renderJobs();
                if (this.state.currentView === 'dashboard') this.renderDashboard();
                if (this.state.currentView === 'gantt') this.renderGantt();
                if (this.state.currentView === 'qc') this.renderQC();
                if (this.state.currentView === 'csat') this.renderCSAT();

                const countEl = document.getElementById('sidebar-job-count');
                if (countEl) countEl.innerText = DB.jobs.length;

                this.showToast(`📥 จำลองรับ Order จาก INT System สำเร็จ ${DB.jobs.length} งาน (BOQ ว่างเปล่า รอการนำเข้าเพื่อสร้าง Task ใน Gantt)`);
            },

            init() {
                // Initialize theme
                const savedTheme = localStorage.getItem('pmt-theme') || 'dark';
                if(savedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                // Restore saved jobs or seed with 10 INT mock jobs
                const savedJobs = localStorage.getItem('pmt_jobs');
                if (savedJobs) {
                    try {
                        const parsed = JSON.parse(savedJobs);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            DB.jobs = parsed;
                        } else {
                            DB.jobs = this.getINTMockOrders();
                            this.persistJobs();
                        }
                    } catch (e) {
                        DB.jobs = this.getINTMockOrders();
                        this.persistJobs();
                    }
                } else {
                    DB.jobs = this.getINTMockOrders();
                    this.persistJobs();
                }

                // Initial seed of 10 INT orders if not seeded yet
                if (localStorage.getItem('pmt_int_mock_10jobs_v3') !== 'true') {
                    try {
                        localStorage.setItem('pmt_int_mock_10jobs_v3', 'true');
                        DB.jobs = this.getINTMockOrders();
                        this.persistJobs();
                    } catch(e) {}
                }

                // Restore saved tasks
                const savedTasks = localStorage.getItem('pmt_tasks');
                if (savedTasks) {
                    try {
                        const parsedTasks = JSON.parse(savedTasks);
                        if (Array.isArray(parsedTasks)) {
                            DB.tasks = parsedTasks;
                        }
                    } catch (e) {}
                }

                // Restore saved QC bookings
                const savedQCBookings = localStorage.getItem('pmt_qc_bookings');
                if (savedQCBookings) {
                    try {
                        const parsedBookings = JSON.parse(savedQCBookings);
                        if (Array.isArray(parsedBookings)) {
                            DB.qcBookings = parsedBookings;
                        }
                    } catch (e) {}
                }

                // Restore saved tickets or seed with initial mock tickets (Step 3)
                const savedTickets = localStorage.getItem('pmt_tickets');
                if (savedTickets) {
                    try {
                        const parsedTickets = JSON.parse(savedTickets);
                        if (Array.isArray(parsedTickets) && parsedTickets.length > 0) {
                            DB.tickets = parsedTickets;
                        } else {
                            DB.tickets = this.getDefaultMockTickets();
                            this.persistTickets();
                        }
                    } catch (e) {
                        DB.tickets = this.getDefaultMockTickets();
                        this.persistTickets();
                    }
                } else {
                    DB.tickets = this.getDefaultMockTickets();
                    this.persistTickets();
                }

                // Restore saved blueprints or seed with initial mock blueprints (Step 2)
                const savedBlueprints = localStorage.getItem('pmt_blueprints');
                if (savedBlueprints) {
                    try {
                        const parsedBlueprints = JSON.parse(savedBlueprints);
                        if (Array.isArray(parsedBlueprints) && parsedBlueprints.length > 0) {
                            DB.blueprints = parsedBlueprints;
                        } else {
                            DB.blueprints = this.getDefaultMockBlueprints();
                            this.persistBlueprints();
                        }
                    } catch (e) {
                        DB.blueprints = this.getDefaultMockBlueprints();
                        this.persistBlueprints();
                    }
                } else {
                    DB.blueprints = this.getDefaultMockBlueprints();
                    this.persistBlueprints();
                }

                // Step Timestamps Audit: Ensure all jobs have step_timestamps initialized for reporting
                if (Array.isArray(DB.jobs)) {
                    DB.jobs.forEach(j => {
                        if (!j.step_timestamps) j.step_timestamps = {};
                        if (!j.step_timestamps.step1_order_at) {
                            j.step_timestamps.step1_order_at = j.created_at || (j.date ? `${j.date}T08:30:00.000Z` : "2026-09-04T08:30:15.000Z");
                        }
                        const hasBp = (DB.blueprints || []).find(b => b.jobId === j.id);
                        if (hasBp && !j.step_timestamps.step2_design_at) {
                            j.step_timestamps.step2_design_at = hasBp.recorded_at || "2026-09-04T09:45:22.000Z";
                        }
                        const hasTkt = (DB.tickets || []).find(t => t.job_id === j.id);
                        if (hasTkt && !j.step_timestamps.step3_ticket_at) {
                            j.step_timestamps.step3_ticket_at = hasTkt.created_at || "2026-09-04T10:15:40.000Z";
                        }
                        if (j.boq_items && j.boq_items.length > 0 && !j.step_timestamps.step4_boq_at) {
                            j.step_timestamps.step4_boq_at = "2026-09-04T11:05:12.000Z";
                        }
                        const hasTasks = (DB.tasks || []).some(t => t.jobId === j.id);
                        if (hasTasks && !j.step_timestamps.step5_project_at) {
                            j.step_timestamps.step5_project_at = "2026-09-04T13:20:05.000Z";
                        }
                    });
                }

                // Rule Enforcement: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart
                // Filter out any tasks whose jobs do not have BOQ items
                if (Array.isArray(DB.jobs)) {
                    DB.jobs.forEach(j => {
                        if (!j.boq_items) j.boq_items = [];
                        if (j.boq_discount === undefined) j.boq_discount = 0;
                    });
                    const jobsWithBOQ = new Set(DB.jobs.filter(j => j.boq_items && j.boq_items.length > 0).map(j => j.id));
                    if (Array.isArray(DB.tasks)) {
                        DB.tasks = DB.tasks.filter(t => jobsWithBOQ.has(t.jobId));
                    }
                }

                // Automatically generate/sync QC bookings (5 days before each task end date)
                this.syncQCBookingsFromTasks();

                this.navigate('dashboard');
                this.fetchJobsFromApi();
                this.fetchMAFromApi();
                // Polling sync every 3 seconds for live updates
                setInterval(() => {
                    this.fetchJobsFromApi();
                    this.fetchMAFromApi();
                }, 3000);
            },

            async fetchJobsFromApi() {
                try {
                    const res = await fetch('/api/v1/jobs');
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && Array.isArray(json.data)) {
                            if (json.data.length === 0) {
                                // Only wipe out local jobs if user explicitly clicked "ล้างข้อมูลโครงการ" AND DB.jobs is empty
                                if (localStorage.getItem('pmt_jobs_cleared_v3') === 'true' && (!DB.jobs || DB.jobs.length === 0)) {
                                    DB.jobs = [];
                                    DB.tasks = [];
                                    DB.blueprints = [];
                                    this.persistJobs();
                                    if (this.state.currentView === 'jobs') this.renderJobs();
                                    if (this.state.currentView === 'dashboard') this.renderDashboard();
                                    if (this.state.currentView === 'gantt') this.renderGantt();
                                    if (this.state.currentView === 'qc') this.renderQC();
                                    if (this.state.currentView === 'csat') this.renderCSAT();
                                    if (this.state.currentView === 'blueprints') this.renderBlueprints();
                                    const countEl = document.getElementById('sidebar-job-count');
                                    if (countEl) countEl.innerText = '0';
                                    return;
                                }
                                // If local state has jobs (such as simulated jobs), do NOT wipe them out!
                                // Instead, tell the server to reset/seed so backend gets synchronized!
                                if (DB.jobs && DB.jobs.length > 0) {
                                    fetch('/api/v1/jobs/reset', { method: 'POST' }).catch(() => {});
                                    return;
                                }
                                return;
                            }
                            const remoteJobs = json.data;
                            if (remoteJobs.length > 0) {
                                const localOnly = DB.jobs.filter(lj => !remoteJobs.some(rj => rj.id === lj.id));
                                const mergedRemote = remoteJobs.map(rj => {
                                    const localMatch = DB.jobs.find(lj => lj.id === rj.id);
                                    if (!localMatch) return rj;
                                    const combinedPhotos = (localMatch.photos && localMatch.photos.length > 0) ? localMatch.photos : (rj.photos || []);
                                    return { 
                                        ...rj, 
                                        ...localMatch, 
                                        special_instructions: localMatch.special_instructions !== undefined ? localMatch.special_instructions : (rj.special_instructions || ''),
                                        additional_notes: localMatch.additional_notes !== undefined ? localMatch.additional_notes : (rj.additional_notes || ''),
                                        photos: combinedPhotos
                                    };
                                });
                                DB.jobs = [...localOnly, ...mergedRemote];
                                this.persistJobs();
                                if (this.state.currentView === 'jobs') this.renderJobs();
                                if (this.state.currentView === 'dashboard') this.renderDashboard();
                                
                                const activeEl = document.activeElement;
                                const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                                if (this.state.currentView === 'job-detail' && !isEditing) this.renderJobDetail();
                                
                                if (this.state.currentView === 'gantt') this.renderGantt();
                                if (this.state.currentView === 'qc') this.renderQC();
                                if (this.state.currentView === 'csat') this.renderCSAT();
                                const countEl = document.getElementById('sidebar-job-count');
                                if (countEl) countEl.innerText = DB.jobs.length;
                                const sbCsat = document.getElementById('sidebar-csat-count');
                                if (sbCsat) {
                                    const pCount = (DB.jobs || []).filter(j => j.status === 'QC_PASSED').length;
                                    sbCsat.innerText = pCount;
                                }
                            }
                        }
                    }
                } catch (err) {
                    // fallback to local state
                }
            },

            toggleTheme() {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('pmt-theme', isDark ? 'dark' : 'light');
                this.updateCharts();
                this.showToast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`);
            },

            toggleSidebar() {
                const sb = document.getElementById('app-sidebar');
                sb.classList.toggle('w-64');
                sb.classList.toggle('w-16');
            },

            setTimeRange(range, btn) {
                btn.parentElement.querySelectorAll('button').forEach(b => {
                    b.classList.remove('bg-card', 'text-foreground', 'shadow-sm');
                    b.classList.add('text-muted-foreground');
                });
                btn.classList.add('bg-card', 'text-foreground', 'shadow-sm');
                btn.classList.remove('text-muted-foreground');
                this.showToast(`Filtered data for period: ${range}`);
            },

            navigate(view, param = null) {
                // Update nav styles
                document.querySelectorAll('.nav-link').forEach(el => {
                    el.classList.remove('nav-item-active');
                });
                
                const activeNav = document.querySelector(`.nav-link[onclick*="'${view}'"]`);
                if(activeNav) {
                    activeNav.classList.add('nav-item-active');
                }

                // Update breadcrumb
                const breadcrumbMap = {
                    'dashboard': 'Dashboard (ภาพรวมระบบ)',
                    'jobs': 'Step 1: บันทึกงาน & รับ Order ใหม่ (All Work Orders)',
                    'job-detail': `รายละเอียดงาน ${param || ''}`,
                    'blueprints': 'Step 2: บันทึก Design & แบบแปลนติดตั้ง (Blueprints & CAD)',
                    'tickets': 'Step 3: บันทึก Ticket & แนบใบเสร็จ (Tickets & Receipts)',
                    'boq': 'Step 4: นำBOQ เข้าระบบ & ประมาณการราคา (Bill of Quantities)',
                    'project-conversion': 'Step 5: บันทึก BOQ เข้า Project (Labor-to-Task & Gantt)',
                    'gantt': 'แผนงาน Gantt เต็มรูป (Gantt Timeline)',
                    'qc': 'QC Inspection (ตรวจคุณภาพ)',
                    'csat': 'ความพึงพอใจลูกค้า (CSAT Survey)',
                    'ma-contracts': 'บริการหลังการขาย & สัญญา MA',
                    'settings': 'ตั้งค่าระบบ & API',
                    'faq': 'คู่มือระบบ & คำถามที่พบบ่อย (Workflow Guide & FAQ)',
                    'users': 'จัดการผู้ใช้งาน'
                };
                document.getElementById('topbar-breadcrumb').innerText = breadcrumbMap[view] || view;

                // Hide all pages
                document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden-view'));
                
                // Show requested page
                const pageEl = document.getElementById(`page-${view}`);
                if(pageEl) pageEl.classList.remove('hidden-view');

                this.state.currentView = view;

                // Page specific renders
                if(view === 'jobs') this.renderJobs();
                if(view === 'blueprints') this.renderBlueprints();
                if(view === 'tickets') this.renderTickets();
                if(view === 'boq') this.renderBOQPage(param);
                if(view === 'project-conversion') this.renderProjectConversion(param);
                if(view === 'dashboard') {
                    this.renderDashboard();
                    setTimeout(() => this.updateCharts(), 50);
                }
                if(view === 'job-detail') {
                    this.state.currentJobId = param;
                    this.renderJobDetail();
                }
                if(view === 'gantt') this.renderGantt();
                if(view === 'qc') this.renderQC();
                if(view === 'csat') this.renderCSAT();
                if(view === 'ma-contracts') this.renderMAContracts();
                if(view === 'users') {
                    if (typeof userMgmt !== 'undefined') userMgmt.load();
                }

                // Update sidebar badges
                const sidebarJob = document.getElementById('sidebar-job-count');
                if (sidebarJob) sidebarJob.innerText = DB.jobs.length;
                const sidebarBp = document.getElementById('sidebar-blueprint-count');
                if (sidebarBp) {
                    const designedJobIds = new Set((DB.blueprints || []).map(b => b.jobId));
                    const pendingBpCount = (DB.jobs || []).filter(j => !designedJobIds.has(j.id)).length;
                    sidebarBp.innerText = pendingBpCount;
                }
                const sidebarTicket = document.getElementById('sidebar-ticket-count');
                if (sidebarTicket && DB.tickets) sidebarTicket.innerText = DB.tickets.length;
                const sidebarBoq = document.getElementById('sidebar-boq-count');
                if (sidebarBoq) {
                    const boqJobsCount = (DB.jobs || []).filter(j => j.boq_items && j.boq_items.length > 0).length;
                    sidebarBoq.innerText = boqJobsCount;
                }
                const sidebarTask = document.getElementById('sidebar-task-count');
                if (sidebarTask) sidebarTask.innerText = (DB.tasks || []).length;
                const sidebarMa = document.getElementById('sidebar-ma-count');
                if (sidebarMa) sidebarMa.innerText = DB.maContracts.length;
                const sidebarCsat = document.getElementById('sidebar-csat-count');
                if (sidebarCsat) {
                    const csatPending = (DB.jobs || []).filter(j => j.status === 'QC_PASSED').length;
                    sidebarCsat.innerText = csatPending;
                }
            },

            showToast(msg) {
                const t = document.getElementById('toast');
                document.getElementById('toast-msg').innerText = msg;
                t.classList.remove('translate-y-20', 'opacity-0');
                setTimeout(() => {
                    t.classList.add('translate-y-20', 'opacity-0');
                }, 3200);
            },

            showModal(id) {
                const m = document.getElementById(id);
                m.classList.remove('hidden-view');
                setTimeout(() => {
                    m.classList.remove('opacity-0');
                    const dialog = m.querySelector('#' + id + '-content') || m.querySelector('div');
                    dialog.classList.remove('scale-95');
                }, 10);
            },

            hideModal(id) {
                const m = document.getElementById(id);
                m.classList.add('opacity-0');
                const dialog = m.querySelector('#' + id + '-content') || m.querySelector('div');
                if(dialog) dialog.classList.add('scale-95');
                setTimeout(() => {
                    m.classList.add('hidden-view');
                }, 200);
            },

            handleGlobalSearch(e) {
                const query = e.target.value.toLowerCase().trim();
                if(e.key === 'Enter' && query) {
                    this.navigate('jobs');
                    const filtered = DB.jobs.filter(j => 
                        j.id.toLowerCase().includes(query) || 
                        j.customer.toLowerCase().includes(query) || 
                        j.phone.includes(query) ||
                        j.service.toLowerCase().includes(query)
                    );
                    this.renderJobs(filtered);
                }
            },

            async submitCreateJob() {
                const firstName = document.getElementById('cj-firstname').value.trim();
                const lastName = document.getElementById('cj-lastname').value.trim();
                const service = document.getElementById('cj-service').value;
                const lat = parseFloat(document.getElementById('cj-lat').value) || 13.7563;
                const lng = parseFloat(document.getElementById('cj-lng').value) || 100.5018;
                const phone = document.getElementById('cj-phone').value || '089-000-0000';
                const address = document.getElementById('cj-address').value || 'Bangkok, Thailand';
                const tech = document.getElementById('cj-tech').value || 'Team A (สมศักดิ์)';
                const date = document.getElementById('cj-date').value || '2026-09-06';
                const special_instructions = document.getElementById('cj-instructions')?.value.trim() || '';
                const additional_notes = document.getElementById('cj-notes')?.value.trim() || '';
                
                if(!firstName || !lastName) {
                    return this.showToast('กรุณากรอกชื่อและนามสกุลลูกค้า');
                }
                
                try {
                    const res = await fetch('/api/v1/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firstName, lastName, service, lat, lng, phone, address, tech, date, special_instructions, additional_notes })
                    });
                    if (res.ok) {
                        const result = await res.json();
                        this.showToast(`สร้างงาน ${result.data?.job_no || 'ใหม่'} (ลูกค้า: ${firstName} ${lastName}) สำเร็จแล้ว`);
                        await this.fetchJobsFromApi();
                    } else {
                        throw new Error('API create failed');
                    }
                } catch (e) {
                    const now = new Date();
                    const yyyy = String(now.getFullYear());
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const runningStr = String(DB.jobs.length + 1).padStart(3, '0');
                    const newId = `JOB${yyyy}${mm}${runningStr}`;
                    const fullName = `${firstName} ${lastName}`;
                    const nowIso = new Date().toISOString();
                    DB.jobs.unshift({
                        id: newId,
                        job_no: newId,
                        external_ref_id: `INT-${yyyy}-${runningStr}`,
                        firstName: firstName,
                        lastName: lastName,
                        customer: fullName,
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                        phone: phone,
                        service: service,
                        status: 'DRAFT',
                        date: date,
                        progress: 0,
                        address: address,
                        tech: tech,
                        special_instructions: special_instructions,
                        additional_notes: additional_notes,
                        photos: [],
                        boq_items: [],
                        boq_discount: 0,
                        step_timestamps: {
                            step1_order_at: nowIso
                        },
                        step_timestamps_history: [
                            { stepKey: 'step1_order_at', timestamp: nowIso, note: 'บันทึกเปิดงานใหม่ / รับ Order' }
                        ]
                    });
                    this.showToast(`สร้างงาน ${newId} (ลูกค้า: ${fullName}) สำเร็จแล้ว`);
                    if(this.state.currentView === 'jobs') this.renderJobs();
                    if(this.state.currentView === 'dashboard') this.renderDashboard();
                }

                this.hideModal('modal-create-job');
                document.getElementById('cj-firstname').value = '';
                document.getElementById('cj-lastname').value = '';
                document.getElementById('cj-address').value = '';
                const instEl = document.getElementById('cj-instructions');
                const noteEl = document.getElementById('cj-notes');
                if (instEl) instEl.value = '';
                if (noteEl) noteEl.value = '';
            },

            getStatusHtml(status) {
                const s = status.toLowerCase().replace('_', '-');
                const labelMap = {
                    'DRAFT': 'Draft',
                    'IN_PROGRESS': 'In Progress',
                    'QC_PENDING': 'QC Pending',
                    'QC_PASSED': 'QC Passed',
                    'AFTER_SALE': 'After Sale',
                    'CLOSED': 'Closed'
                };
                return `<span class="status-pill status-${s}">${labelMap[status] || status}</span>`;
            },

            renderDashboard() {
                document.getElementById('kpi-progress').innerText = DB.jobs.filter(j => j.status==='IN_PROGRESS').length;
                document.getElementById('kpi-qc').innerText = DB.jobs.filter(j => j.status==='QC_PASSED' || j.status==='AFTER_SALE' || j.status==='CLOSED').length;
                
                // Recent Jobs Table
                const recentRows = DB.jobs.slice(0, 4).map(j => `
                    <tr class="hover:bg-muted/40 transition-colors cursor-pointer" onclick="app.navigate('job-detail', '${j.id}')">
                        <td class="py-3 font-mono font-semibold text-brand-500">${j.id}</td>
                        <td class="py-3 font-medium text-foreground">${j.customer}</td>
                        <td class="py-3 text-muted-foreground">${j.service}</td>
                        <td class="py-3">${this.getStatusHtml(j.status)}</td>
                        <td class="py-3 text-right">
                            <div class="inline-flex items-center gap-2">
                                <span class="font-mono text-muted-foreground">${j.progress}%</span>
                                <div class="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-brand-500 h-1.5 rounded-full" style="width: ${j.progress}%"></div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `).join('');
                document.getElementById('dashboard-recent-jobs').innerHTML = recentRows || '<tr><td colspan="5" class="py-6 text-center text-xs text-muted-foreground">ยังไม่มีรายการงานล่าสุดในระบบ</td></tr>';

                // Alerts
                const alerts = DB.jobs.filter(j => j.status !== 'CLOSED' && j.status !== 'QC_PASSED');
                const alertsHtml = alerts.length ? alerts.map(j => `
                    <div class="p-3 rounded-xl bg-muted/40 border border-border hover:border-brand-500/40 transition-all cursor-pointer group" onclick="app.navigate('job-detail', '${j.id}')">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-mono text-[11px] font-semibold text-brand-500">${j.id}</span>
                            <span class="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                <i class="ph ph-clock"></i> ${j.date}
                            </span>
                        </div>
                        <div class="text-xs font-medium text-foreground group-hover:text-brand-500 transition truncate">${j.customer}</div>
                        <div class="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <span class="text-[10px] text-muted-foreground truncate">${j.service}</span>
                            ${this.getStatusHtml(j.status)}
                        </div>
                    </div>
                `).join('') : '<div class="text-xs text-muted-foreground text-center py-6">ไม่มีงานที่ใกล้ครบกำหนดในขณะนี้</div>';
                
                document.getElementById('dashboard-alerts').innerHTML = alertsHtml;
            },

            updateCharts() {
                const isDark = document.documentElement.classList.contains('dark');
                const textColor = isDark ? '#a1a1aa' : '#71717a';
                const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

                // 1. Performance Area Chart
                const perfCtx = document.getElementById('performanceChart');
                if(perfCtx) {
                    let oldPerf = Chart.getChart("performanceChart");
                    if(oldPerf) oldPerf.destroy();

                    new Chart(perfCtx.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
                            datasets: [
                                {
                                    label: 'งานที่ส่งมอบแล้ว (Current)',
                                    data: [12, 19, 15, 26, 22, 30, 28, 35],
                                    borderColor: '#8b5cf6',
                                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                                    fill: true,
                                    tension: 0.4,
                                    borderWidth: 2.5,
                                    pointRadius: 3,
                                    pointBackgroundColor: '#8b5cf6'
                                },
                                {
                                    label: 'เป้าหมาย (Target)',
                                    data: [10, 15, 18, 22, 25, 27, 30, 32],
                                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                    borderDash: [5, 5],
                                    fill: false,
                                    tension: 0.4,
                                    borderWidth: 1.5,
                                    pointRadius: 0
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                                    titleColor: isDark ? '#f4f4f5' : '#09090b',
                                    bodyColor: isDark ? '#a1a1aa' : '#71717a',
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    borderWidth: 1,
                                    cornerRadius: 8,
                                    padding: 10
                                }
                            },
                            scales: {
                                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } },
                                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } }
                            }
                        }
                    });
                }

                // 2. Status Donut Chart
                const ctx = document.getElementById('dashboardChart');
                if(ctx) {
                    let chartStatus = Chart.getChart("dashboardChart");
                    if (chartStatus) chartStatus.destroy();

                    const draftCount = DB.jobs.filter(j => j.status === 'DRAFT').length;
                    const progressCount = DB.jobs.filter(j => j.status === 'IN_PROGRESS').length;
                    const qcPendingCount = DB.jobs.filter(j => j.status === 'QC_PENDING').length;
                    const qcPassedCount = DB.jobs.filter(j => j.status === 'QC_PASSED').length;
                    const afterSaleCount = DB.jobs.filter(j => j.status === 'AFTER_SALE' || j.status === 'CLOSED').length;

                    new Chart(ctx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['Draft', 'In Progress', 'QC Pending', 'QC Passed', 'After Sale & Closed'],
                            datasets: [{
                                data: [draftCount, progressCount, qcPendingCount, qcPassedCount, afterSaleCount],
                                backgroundColor: [
                                    '#71717a',
                                    '#f59e0b',
                                    '#8b5cf6',
                                    '#10b981',
                                    '#0ea5e9'
                                ],
                                borderColor: isDark ? '#121215' : '#ffffff',
                                borderWidth: 3,
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                                    titleColor: isDark ? '#f4f4f5' : '#09090b',
                                    bodyColor: isDark ? '#a1a1aa' : '#71717a',
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    borderWidth: 1,
                                    padding: 10,
                                    cornerRadius: 8
                                }
                            },
                            cutout: '72%'
                        }
                    });
                }
            },

            renderJobs(jobList = null) {
                const serviceFilter = document.getElementById('filter-service') ? document.getElementById('filter-service').value : 'all';
                const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';

                let list = jobList || DB.jobs;

                if(!jobList) {
                    if(serviceFilter !== 'all') {
                        list = list.filter(j => j.service === serviceFilter);
                    }
                    if(statusFilter !== 'all') {
                        list = list.filter(j => j.status === statusFilter);
                    }
                }

                const html = list.map(j => `
                    <tr class="hover:bg-muted/40 transition-colors cursor-pointer group" onclick="app.navigate('job-detail', '${j.id}')">
                        <td class="px-5 py-4 font-mono font-semibold text-brand-500">${j.id}</td>
                        <td class="px-5 py-4">
                            <div class="text-foreground font-medium group-hover:text-brand-500 transition">${j.customer}</div>
                            <div class="text-[11px] text-muted-foreground font-mono">${j.phone}</div>
                        </td>
                        <td class="px-5 py-4 text-muted-foreground">
                            <span class="inline-flex items-center gap-1">
                                <i class="ph ph-tag text-muted-foreground/60"></i> ${j.service}
                            </span>
                        </td>
                        <td class="px-5 py-4 text-muted-foreground">
                            <span class="text-xs">${j.tech}</span>
                        </td>
                        <td class="px-5 py-4">${this.getStatusHtml(j.status)}</td>
                        <td class="px-5 py-4 w-44">
                            <div class="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                                <span class="font-semibold text-foreground">${j.progress}%</span>
                                <span class="text-[10px] text-purple-600 dark:text-purple-400 font-mono" title="ความสมบูรณ์ 5 ขั้นตอน">${(() => {
                                    const rep = app.getJobStepAuditReportData(j.id);
                                    return rep ? `Step ${rep.completedCount}/5` : '';
                                })()}</span>
                            </div>
                            <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-1.5">
                                <div class="bg-gradient-to-r from-brand-600 to-indigo-500 h-1.5 rounded-full" style="width: ${j.progress}%"></div>
                            </div>
                            <!-- 5-Step Micro Indicators with Exact Timestamp Tooltips -->
                            <div class="flex items-center gap-1" onclick="event.stopPropagation(); app.openStepAuditReportModal('${j.id}')" title="คลิกเพื่อดู Audit Report บันทึกเวลาทั้ง 5 ขั้นตอน">
                                ${(() => {
                                    const rep = app.getJobStepAuditReportData(j.id);
                                    if (!rep) return '';
                                    return rep.steps.map(s => {
                                        const done = s.isDone;
                                        const t = s.timestamp ? app.formatTimestamp(s.timestamp) : 'ยังไม่บันทึก';
                                        return `<span class="w-3.5 h-3.5 rounded-full font-mono text-[8px] flex items-center justify-center font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground/50 border border-border'}" title="${s.name}: ${t}">${s.stepNumber}</span>`;
                                    }).join('');
                                })()}
                                <span class="text-[9px] text-brand-500 ml-1 hover:underline cursor-pointer"><i class="ph ph-clock"></i></span>
                            </div>
                        </td>
                        <td class="px-5 py-4 text-right">
                            <button class="text-muted-foreground group-hover:text-brand-500 p-1 rounded hover:bg-muted transition">
                                <i class="ph ph-caret-right text-base"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

                document.getElementById('jobs-table-body').innerHTML = html || '<tr><td colspan="7" class="px-5 py-8 text-center text-muted-foreground">ไม่พบรายการงานตามเงื่อนไข</td></tr>';
            },

            switchJobTab(tab) {
                this.state.jobTab = tab;
                this.renderJobDetail();
            },

            appendInstruction(text) {
                const el = document.getElementById('job-special-instructions');
                if (!el) return;
                const current = el.value.trim();
                if (current) {
                    el.value = current + ', ' + text;
                } else {
                    el.value = text;
                }
                el.focus();
            },

            appendNote(text) {
                const el = document.getElementById('job-additional-notes');
                if (!el) return;
                const current = el.value.trim();
                if (current) {
                    el.value = current + '\n' + text;
                } else {
                    el.value = text;
                }
                el.focus();
            },

            async saveJobNotes(jobId) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job) return;

                const specialEl = document.getElementById('job-special-instructions');
                const notesEl = document.getElementById('job-additional-notes');

                const special_instructions = specialEl ? specialEl.value.trim() : (job.special_instructions || '');
                const additional_notes = notesEl ? notesEl.value.trim() : (job.additional_notes || '');

                job.special_instructions = special_instructions;
                job.additional_notes = additional_notes;
                this.persistJobs();

                // Sync with backend server
                fetch(`/api/v1/jobs/${jobId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ special_instructions, additional_notes })
                }).catch(() => {});

                this.showToast('✅ บันทึกคำสั่งพิเศษและข้อมูลเพิ่มเติมเรียบร้อยแล้ว');
                this.renderJobDetail();
            },

            openPhotoUploadModal(jobId) {
                this.state.uploadTargetJobId = jobId;
                const job = DB.jobs.find(j => j.id === jobId);
                const titleEl = document.getElementById('pht-title');
                const noteEl = document.getElementById('pht-note');
                const tagEl = document.getElementById('pht-tag');
                const gpsEl = document.getElementById('pht-gps');

                if (titleEl) titleEl.value = '';
                if (noteEl) noteEl.value = '';
                if (tagEl) tagEl.value = 'สภาพหน้างานทั่วไป';
                if (gpsEl && job) gpsEl.value = `📍 ${job.lat || 13.7563}, ${job.lng || 100.5018} (Verified)`;

                this.clearPhotoPreview();
                this.showModal('modal-upload-photo');

                // Bind drag & drop handlers if not already bound
                const dropzone = document.getElementById('pht-dropzone');
                if (dropzone && !dropzone._dndBound) {
                    dropzone._dndBound = true;
                    dropzone.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        dropzone.classList.add('border-brand-500', 'bg-brand-500/10');
                    });
                    dropzone.addEventListener('dragleave', (e) => {
                        e.preventDefault();
                        dropzone.classList.remove('border-brand-500', 'bg-brand-500/10');
                    });
                    dropzone.addEventListener('drop', (e) => {
                        e.preventDefault();
                        dropzone.classList.remove('border-brand-500', 'bg-brand-500/10');
                        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            app.handlePhotoFiles(e.dataTransfer.files);
                        }
                    });
                }
            },

            handlePhotoFiles(files) {
                if (!files || files.length === 0) return;
                const file = files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    const previewContainer = document.getElementById('pht-preview-container');
                    const previewImg = document.getElementById('pht-preview-img');
                    const dropzone = document.getElementById('pht-dropzone');
                    const titleInput = document.getElementById('pht-title');
                    const infoEl = document.getElementById('pht-file-info');

                    if (previewImg) previewImg.src = dataUrl;
                    if (previewContainer) previewContainer.classList.remove('hidden-view');
                    if (dropzone) dropzone.classList.add('hidden-view');
                    if (titleInput && !titleInput.value) {
                        titleInput.value = file.name.replace(/\.[^/.]+$/, "");
                    }
                    if (infoEl) {
                        const sizeKb = Math.round(file.size / 1024);
                        infoEl.innerText = `${file.name} (${sizeKb > 1024 ? (sizeKb/1024).toFixed(1) + ' MB' : sizeKb + ' KB'})`;
                    }
                    this._currentPhotoDataUrl = dataUrl;
                    this._currentPhotoFileName = file.name;
                };
                reader.readAsDataURL(file);
            },

            handlePhotoFileChange(event) {
                if (event.target.files && event.target.files.length > 0) {
                    this.handlePhotoFiles(event.target.files);
                }
            },

            clearPhotoPreview() {
                this._currentPhotoDataUrl = null;
                this._currentPhotoFileName = null;
                const fileInput = document.getElementById('pht-file-input');
                const cameraInput = document.getElementById('pht-camera-input');
                const previewContainer = document.getElementById('pht-preview-container');
                const previewImg = document.getElementById('pht-preview-img');
                const dropzone = document.getElementById('pht-dropzone');

                if (fileInput) fileInput.value = '';
                if (cameraInput) cameraInput.value = '';
                if (previewImg) previewImg.src = '';
                if (previewContainer) previewContainer.classList.add('hidden-view');
                if (dropzone) dropzone.classList.remove('hidden-view');
            },

            async submitUploadPhoto(event) {
                event.preventDefault();
                const jobId = this.state.uploadTargetJobId || this.state.currentJobId;
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job) return;

                const dataUrl = this._currentPhotoDataUrl;
                if (!dataUrl) {
                    alert('กรุณาเลือกไฟล์รูปภาพ หรือ ถ่ายรูปก่อนกดอัปโหลด');
                    return;
                }

                const title = document.getElementById('pht-title')?.value.trim() || 'รูปหน้างานเพิ่มเติม';
                const tag = document.getElementById('pht-tag')?.value || 'ภาพเพิ่มเติม';
                const note = document.getElementById('pht-note')?.value.trim() || '';

                if (!job.photos) job.photos = [];

                const newPhoto = {
                    id: 'PHT-' + Date.now(),
                    title: title,
                    name: this._currentPhotoFileName || `IMG_SITE_${Date.now()}.JPG`,
                    url: dataUrl,
                    tag: tag,
                    note: note,
                    lat: job.lat || 13.7563,
                    lng: job.lng || 100.5018,
                    gps_verified: true,
                    uploaded_at: new Date().toISOString()
                };

                job.photos.push(newPhoto);
                this.persistJobs();

                // Call backend API in background
                fetch(`/api/v1/jobs/${jobId}/photos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: newPhoto.title,
                        name: newPhoto.name,
                        dataUrl: newPhoto.url,
                        tag: newPhoto.tag,
                        note: newPhoto.note,
                        lat: newPhoto.lat,
                        lng: newPhoto.lng
                    })
                }).catch(() => {});

                this.hideModal('modal-upload-photo');
                this.clearPhotoPreview();
                this.showToast(`📷 อัปโหลดรูปภาพ "${title}" (รูปที่ ${5 + job.photos.length}) เรียบร้อยแล้ว`);
                this.renderJobDetail();
            },

            deletePhoto(jobId, photoId) {
                if (!confirm('ต้องการลบรูปภาพนี้ออกจากงานใช่หรือไม่?')) return;
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job || !job.photos) return;

                job.photos = job.photos.filter(p => p.id !== photoId);
                this.persistJobs();

                // Sync with server
                fetch(`/api/v1/jobs/${jobId}/photos/${photoId}`, {
                    method: 'DELETE'
                }).catch(() => {
                    fetch(`/api/v1/jobs/${jobId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ photos: job.photos })
                    }).catch(() => {});
                });

                this.showToast('🗑️ ลบรูปภาพเรียบร้อยแล้ว');
                this.renderJobDetail();
            },

            openBasePhotoLightbox(num) {
                const basePhotos = [
                    { num: 1, title: 'สภาพพื้นที่ก่อนติดตั้ง', desc: 'มุมมองกว้างบริเวณผนังห้องนอน', preview: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80' },
                    { num: 2, title: 'การวัดระดับและยึด Plate', desc: 'ระดับน้ำตรง แข็งแรงตามสเปก', preview: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1000&auto=format&fit=crop&q=80' },
                    { num: 3, title: 'แนวท่อน้ำยาและรางครอบ', desc: 'เดินท่อเรียบร้อย ไม่รั่วซึม', preview: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1000&auto=format&fit=crop&q=80' },
                    { num: 4, title: 'ระบบไฟฟ้าและสายดิน', desc: 'เบรกเกอร์แยกและวัดกราวด์ผ่าน', preview: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&auto=format&fit=crop&q=80' },
                    { num: 5, title: 'หลังติดตั้งและเก็บกวาด', desc: 'ทดสอบความเย็น 16°C ปกติ', preview: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1000&auto=format&fit=crop&q=80' },
                ];
                const p = basePhotos.find(b => b.num === num);
                if (!p) return;
                this.showLightbox(p.preview, p.title, `รูปที่ ${p.num} • มาตรฐาน`, p.desc, 'ภาพมาตรฐานหน้างาน');
            },

            openUploadedPhotoLightbox(jobId, photoId) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job || !job.photos) return;
                const photo = job.photos.find(p => p.id === photoId);
                if (!photo) return;
                const time = photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ล่าสุด';
                this.showLightbox(photo.url, photo.title, photo.tag || 'ภาพเพิ่มเติม', photo.note || 'รูปถ่ายเพิ่มเติมหน้างาน', time);
            },

            showLightbox(imgUrl, title, badge, desc, time) {
                const imgEl = document.getElementById('lightbox-img');
                const titleEl = document.getElementById('lightbox-title');
                const badgeEl = document.getElementById('lightbox-badge');
                const descEl = document.getElementById('lightbox-desc');
                const timeEl = document.getElementById('lightbox-time');

                if (imgEl) imgEl.src = imgUrl;
                if (titleEl) titleEl.innerText = title || 'รูปภาพหน้างาน';
                if (badgeEl) badgeEl.innerText = badge || 'Site Photo';
                if (descEl) descEl.innerText = desc || 'ตรวจสอบความถูกต้องเรียบร้อย';
                if (timeEl) timeEl.innerText = time || 'เมื่อสักครู่';

                this.showModal('modal-photo-lightbox');
            },

            viewQCPhotos(id) {
                this.selectJob(id);
                this.switchJobTab('general');
            },

            checkinJob(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(job) {
                    job.status = 'IN_PROGRESS';
                    job.progress = Math.max(job.progress || 0, 40);
                    job.checkin_done = true;
                    job.checkin_time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    job.distance_meters = 180;
                    job.is_in_radius = true;
                }
                // Async API call in background
                fetch(`/api/v1/jobs/${id}/checkin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lat: job?.lat || 13.7563,
                        lng: job?.lng || 100.5018,
                        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'],
                        summary: 'ช่างเข้าพื้นที่หน้างานเรียบร้อย'
                    })
                }).catch(() => {});

                this.showToast(`✅ บันทึก GPS Check-in หน้างานสำเร็จ! ระยะห่าง 180 ม. (ผ่านเกณฑ์รัศมี 400 ม.) สถานะเปลี่ยนเป็น In Progress`);
                this.renderJobDetail();
                if(this.state.currentView === 'jobs') this.renderJobs();
                if(this.state.currentView === 'dashboard') this.renderDashboard();
            },

            acceptJobToPMT(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(!job) return;

                const acceptNow = new Date().toISOString();
                job.status = 'IN_PROGRESS';
                job.pmt_accepted = true;
                job.pmt_accepted_at = acceptNow;
                job.progress = Math.max(job.progress || 0, 45);
                this.recordStepTimestamp(id, 'step1_accepted_at', acceptNow, 'รับงานเข้าสู่ PMT (In Progress)');
                if (!job.step_timestamps || !job.step_timestamps.step1_order_at) {
                    this.recordStepTimestamp(id, 'step1_order_at', acceptNow, 'รับ Order');
                }

                this.persistJobs();

                // Sync with backend server
                fetch(`/api/v1/jobs/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'IN_PROGRESS',
                        overall_progress: job.progress,
                        pmt_accepted: true,
                        pmt_accepted_at: job.pmt_accepted_at
                    })
                }).catch(() => {});

                this.showToast(`🎉 รับงาน ${id} เข้าระบบ PMT เรียบร้อยแล้ว! (สถานะ: In Progress)`);
                this.renderJobDetail();
                if(this.state.currentView === 'jobs') this.renderJobs();
                if(this.state.currentView === 'dashboard') this.renderDashboard();
            },

            sendJobToQC(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(job) {
                    job.status = 'QC_PENDING';
                    job.progress = 100;
                }
                this.showToast(`🚀 งาน ${id} ถูกส่งไปยังคิวตรวจ QC แล้ว!`);
                this.renderJobDetail();
                if(this.state.currentView === 'jobs') this.renderJobs();
                if(this.state.currentView === 'dashboard') this.renderDashboard();
            },

            goToQC(id) {
                this.navigate('qc');
                setTimeout(() => {
                    this.selectQCJob(id);
                }, 100);
            },

            completeJob() {
                if (this.state.currentJobId) {
                    this.sendJobToQC(this.state.currentJobId);
                }
            },

            renderJobDetail() {
                const job = DB.jobs.find(j => j.id === this.state.currentJobId);
                if(!job) return;

                const curTab = this.state.jobTab || 'general';
                const isDraft = job.status === 'DRAFT';
                const isInProgress = job.status === 'IN_PROGRESS' || job.status === 'SURVEYED';
                const isQcPending = job.status === 'QC_PENDING';
                const isQcPassed = job.status === 'QC_PASSED';
                const isAfterSale = job.status === 'AFTER_SALE';
                const isClosed = job.status === 'CLOSED';

                let tabContent = '';
                if (curTab === 'boq') {
                    const boqItems = job.boq_items || [];
                    if (!job.boq_items) job.boq_items = [];

                    const subtotal = boqItems.reduce((acc, item) => acc + ((item.qty || 0) * (item.price || 0)), 0);
                    const discount = job.boq_discount !== undefined ? job.boq_discount : 0;
                    const taxable = Math.max(0, subtotal - discount);
                    const vat = taxable * 0.07;
                    const grandTotal = taxable + vat;

                    tabContent = `
                    <div class="space-y-6">
                        <!-- PMT-Native BOQ System Banner -->
                        <div class="artifact-card p-5 bg-brand-500/5 border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-brand-500/15 text-brand-500 flex items-center justify-center text-xl shrink-0">
                                    <i class="ph ph-receipt"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-display font-bold text-sm text-foreground">บันทึกรายการ BOQ & ค่าวัสดุ (PMT-Native BOQ)</h3>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">บันทึกบนระบบ PMT</span>
                                    </div>
                                    <p class="text-xs text-muted-foreground mt-0.5">หลังจากรับงานเข้าสู่ระบบ PMT แล้ว ขั้นตอนการบันทึก/ปรับปรุงรายการ BOQ จะถูกดำเนินการบนระบบ PMT</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 shrink-0 flex-wrap">
                                <button class="btn-artifact-secondary px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer" onclick="app.openImportBOQModal('${job.id}')" title="นำเข้ารายการวัสดุและราคาจาก Excel หรือ Template">
                                    <i class="ph ph-file-arrow-up text-sm"></i> นำเข้าไฟล์ BOQ (Import)
                                </button>
                                <button class="btn-artifact-secondary px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer" onclick="app.navigate('blueprints')" title="เปิดดูแบบแปลนติดตั้งในศูนย์รวมแบบแปลน">
                                    <i class="ph ph-blueprint text-brand-500"></i> ดูแบบติดตั้ง (Blueprints)
                                </button>
                                <button class="btn-artifact-secondary text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer" onclick="app.clearJobBOQ('${job.id}')" title="ลบรายการ BOQ ทั้งหมดของโครงการนี้">
                                    <i class="ph ph-trash"></i> ลบรายการ BOQ
                                </button>
                            </div>
                        </div>

                        <!-- Rule Banner: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ -->
                        ${boqItems.length === 0 ? `
                        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <i class="ph ph-warning-circle text-lg"></i>
                                </div>
                                <div>
                                    <div class="font-bold flex items-center gap-1.5 text-foreground">
                                        <span>ขั้นตอนที่ 1: โครงการยังไม่มีรายการ BOQ</span>
                                        <span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">Step 1 of 2</span>
                                    </div>
                                    <p class="text-muted-foreground mt-0.5">📌 <strong>Flow การทำงาน:</strong> นำเข้าไฟล์ BOQ (Excel / OCR / Template) ก่อน จึงจะสามารถแปลงเป็น Task ใน Gantt Chart ได้</p>
                                </div>
                            </div>
                            <button onclick="app.openImportBOQModal('${job.id}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm">
                                <i class="ph ph-file-arrow-up text-sm"></i> 📥 กดที่นี่: นำเข้าไฟล์ BOQ
                            </button>
                        </div>
                        ` : `
                        <div class="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200">
                            <div class="flex items-center gap-2.5">
                                <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <i class="ph ph-check-circle text-xl text-emerald-500"></i>
                                </div>
                                <div>
                                    <div class="font-bold flex items-center gap-1.5 text-foreground flex-wrap">
                                        <span class="text-emerald-600 dark:text-emerald-400">✓ นำเข้า BOQ แล้ว (${boqItems.length} รายการ)</span>
                                        <span class="text-muted-foreground">•</span>
                                        <span>ขั้นตอนที่ 2: แปลงเป็นแผนงาน Gantt</span>
                                        <span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono font-bold">Next Step</span>
                                    </div>
                                    <p class="text-muted-foreground mt-0.5">ตรวจทานรายการด้านล่าง แล้วกดปุ่ม <strong>"กำหนดวัน & ช่าง"</strong> เพื่อระบุวันเริ่ม-สิ้นสุดและทีมช่างที่จะลงผัง Gantt Timeline</p>
                                </div>
                            </div>
                            <button onclick="app.openConvertBOQToTasksModal('${job.id}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md">
                                <i class="ph ph-calendar-check text-sm"></i> ⚡ กดปุ่มนี้: แปลง BOQ เป็น Task ใน Gantt ➔
                            </button>
                        </div>
                        `}

                        <!-- BOQ Bill of Quantities Interactive Form Card -->
                        <div class="artifact-card p-6 space-y-4">
                            <div class="flex items-center justify-between pb-3 border-b border-border">
                                <div>
                                    <h4 class="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                                        <i class="ph ph-list-numbers text-brand-500"></i> ตารางรายการคำนวณราคาและวัสดุ
                                    </h4>
                                    <p class="text-xs text-muted-foreground mt-0.5">แก้ไขจำนวนหรือราคาได้โดยตรง ระบบจะคำนวณยอดรวมและภาษีมูลค่าเพิ่มให้อัตโนมัติ</p>
                                </div>
                                <div class="text-right">
                                    <span class="text-[10px] text-muted-foreground font-mono">Job Ref: ${job.id}</span>
                                    <div class="text-[11px] text-emerald-500 font-medium flex items-center gap-1 justify-end">
                                        <i class="ph ph-check-circle"></i> สถานะ: พร้อมส่งต่อ QC
                                    </div>
                                </div>
                            </div>

                            <!-- Interactive Table -->
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs">
                                    <thead>
                                        <tr class="border-b border-border text-muted-foreground text-[11px]">
                                            <th class="py-2.5 font-medium w-12 text-center">ลำดับ</th>
                                            <th class="py-2.5 font-medium">รายการวัสดุ / งานบริการ</th>
                                            <th class="py-2.5 font-medium w-24 text-center">จำนวน</th>
                                            <th class="py-2.5 font-medium w-24 text-center">หน่วย</th>
                                            <th class="py-2.5 font-medium w-36 text-right">ราคาต่อหน่วย (฿)</th>
                                            <th class="py-2.5 font-medium w-36 text-right">รวมเป็นเงิน (฿)</th>
                                            <th class="py-2.5 font-medium w-12 text-center">ลบ</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border">
                                        ${boqItems.length === 0 ? `
                                        <tr>
                                            <td colspan="7" class="py-8 text-center text-muted-foreground">
                                                <div class="flex flex-col items-center justify-center gap-1.5 py-2">
                                                    <i class="ph ph-receipt text-2xl text-muted-foreground/50"></i>
                                                    <span class="text-xs text-muted-foreground font-medium">ยังไม่มีรายการ BOQ สำหรับงานนี้</span>
                                                </div>
                                            </td>
                                        </tr>
                                        ` : boqItems.map((item, idx) => {
                                            const itemTotal = (item.qty || 0) * (item.price || 0);
                                            return `
                                            <tr class="hover:bg-muted/30 transition">
                                                <td class="py-2.5 text-center text-muted-foreground font-mono">${idx + 1}</td>
                                                <td class="py-2.5">
                                                    <input type="text" value="${item.name}" oninput="app.updateBOQItem('${job.id}', ${idx}, 'name', this.value)" class="w-full bg-transparent hover:bg-muted/50 focus:bg-card border border-transparent hover:border-border focus:border-brand-500 rounded px-2 py-1 text-xs text-foreground font-medium transition focus:outline-none">
                                                </td>
                                                <td class="py-2.5 text-center">
                                                    <input type="number" min="1" step="1" value="${item.qty}" oninput="app.updateBOQItem('${job.id}', ${idx}, 'qty', this.value)" class="w-20 text-center bg-muted/30 border border-border focus:border-brand-500 rounded px-2 py-1 text-xs text-foreground font-mono transition focus:outline-none">
                                                </td>
                                                <td class="py-2.5 text-center">
                                                    <input type="text" value="${item.unit || 'ชุด'}" oninput="app.updateBOQItem('${job.id}', ${idx}, 'unit', this.value)" class="w-16 text-center bg-muted/30 border border-border focus:border-brand-500 rounded px-1.5 py-1 text-xs text-foreground transition focus:outline-none">
                                                </td>
                                                <td class="py-2.5 text-right">
                                                    <input type="number" min="0" step="50" value="${item.price}" oninput="app.updateBOQItem('${job.id}', ${idx}, 'price', this.value)" class="w-28 text-right bg-muted/30 border border-border focus:border-brand-500 rounded px-2 py-1 text-xs text-foreground font-mono transition focus:outline-none">
                                                </td>
                                                <td class="py-2.5 text-right font-mono font-semibold text-foreground" id="boq-item-total-${idx}">
                                                    ${itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td class="py-2.5 text-center">
                                                    <button type="button" onclick="app.removeBOQItem('${job.id}', ${idx})" class="p-1 text-muted-foreground hover:text-rose-500 rounded transition" title="ลบรายการนี้">
                                                        <i class="ph ph-trash text-sm"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <!-- Summary calculation -->
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-border gap-4">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <button onclick="app.addBOQItem('${job.id}')" class="btn-artifact-primary px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 font-medium shadow-sm cursor-pointer">
                                        <i class="ph ph-plus-circle text-sm"></i> เพิ่มแถวรายการใหม่
                                    </button>
                                </div>
                                <div class="w-full sm:w-80 space-y-1.5 text-xs bg-muted/20 p-4 rounded-xl border border-border">
                                    <div class="flex justify-between text-muted-foreground">
                                        <span>ราคารวม (Subtotal):</span>
                                        <span class="font-mono font-medium text-foreground" id="boq-subtotal-val">${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                                    </div>
                                    <div class="flex justify-between text-emerald-500">
                                        <span>ส่วนลดพิเศษโครงการ:</span>
                                        <span class="font-mono font-medium">-${discount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                                    </div>
                                    <div class="flex justify-between text-muted-foreground">
                                        <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                                        <span class="font-mono font-medium text-foreground" id="boq-vat-val">${vat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                                    </div>
                                    <div class="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
                                        <span>ยอดสุทธิ (Grand Total):</span>
                                        <span class="font-mono text-brand-500 text-base font-bold" id="boq-grandtotal-val">${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Navigation: Clear Control Flow -->
                        <div class="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-3">
                            <button class="btn-artifact-secondary px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer" onclick="app.switchJobTab('general')">
                                <i class="ph ph-arrow-left"></i> กลับหน้าข้อมูลงาน & Check-in
                            </button>
                            <div class="flex items-center gap-2">
                                <button type="button" class="btn-artifact-secondary px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 font-medium cursor-pointer" onclick="app.saveBOQOnly('${job.id}')" title="บันทึกข้อมูลตาราง BOQ เก็บไว้">
                                    <i class="ph ph-floppy-disk"></i> บันทึกร่าง BOQ
                                </button>
                                <button type="button" class="btn-artifact-primary px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 font-bold shadow-sm bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white cursor-pointer" onclick="app.openConvertBOQToTasksModal('${job.id}')">
                                    <i class="ph ph-calendar-check text-sm"></i> ⚡ กำหนดวันเวลา & ช่าง (แปลงเป็น Gantt Chart) ➔
                                </button>
                            </div>
                        </div>
                    </div>
                    `;
                } else {
                    const checkinBadge = `
                        <span class="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                            <i class="ph ph-check-circle text-sm"></i> ช่าง Check-in หน้างาน (GPS) แล้ว
                        </span>
                    `;

                    let actionButtons = '';
                    if (isDraft || !job.pmt_accepted) {
                        actionButtons = `
                            ${checkinBadge}
                            <span class="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                                <i class="ph ph-hourglass-medium text-sm"></i> รอนำเข้า PMT
                            </span>
                        `;
                    } else if (isClosed) {
                        actionButtons = `
                            ${checkinBadge}
                            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                                <i class="ph ph-seal-check text-base"></i>
                                <span>ปิดงานและส่งข้อมูลเข้าสู่ระบบ BMT สำเร็จเรียบร้อย (${job.bmt_ref || 'BMT-REF-2026-99214'})</span>
                            </div>
                        `;
                    } else {
                        actionButtons = `
                            ${checkinBadge}
                            <span class="text-xs text-emerald-500 font-semibold flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                                <i class="ph ph-check-circle text-sm"></i> รับเข้าระบบ PMT แล้ว
                            </span>
                        `;
                    }

                    const step1Class = "w-3.5 h-3.5 bg-emerald-500 text-white flex items-center justify-center rounded-full ring-4 ring-card text-[9px] font-bold";
                    const step2Dot = "w-3.5 h-3.5 bg-emerald-500 text-white flex items-center justify-center rounded-full ring-4 ring-card text-[9px] font-bold";

                    const uploadedPhotos = job.photos || [];
                    const totalPhotoCount = 5 + uploadedPhotos.length;

                    const basePhotos = [
                        { num: 1, icon: 'ph ph-house-line', file: 'IMG_SITE_01.JPG', title: 'สภาพพื้นที่ก่อนติดตั้ง', desc: 'มุมมองกว้างบริเวณผนังห้องนอน', preview: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80' },
                        { num: 2, icon: 'ph ph-ruler', file: 'IMG_SITE_02.JPG', title: 'การวัดระดับและยึด Plate', desc: 'ระดับน้ำตรง แข็งแรงตามสเปก', preview: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80' },
                        { num: 3, icon: 'ph ph-pipe', file: 'IMG_SITE_03.JPG', title: 'แนวท่อน้ำยาและรางครอบ', desc: 'เดินท่อเรียบร้อย ไม่รั่วซึม', preview: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80' },
                        { num: 4, icon: 'ph ph-lightning', file: 'IMG_SITE_04.JPG', title: 'ระบบไฟฟ้าและสายดิน', desc: 'เบรกเกอร์แยกและวัดกราวด์ผ่าน', preview: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80' },
                        { num: 5, icon: 'ph ph-check-circle', file: 'IMG_SITE_05.JPG', title: 'หลังติดตั้งและเก็บกวาด', desc: 'ทดสอบความเย็น 16°C ปกติ', preview: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&auto=format&fit=crop&q=80' },
                    ];

                    let extraPhotosHtml = '';
                    if (uploadedPhotos.length > 0) {
                        extraPhotosHtml = uploadedPhotos.map((p, idx) => {
                            const photoNum = 5 + idx + 1;
                            const uploadTime = p.uploaded_at ? new Date(p.uploaded_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ล่าสุด';
                            const displayImg = p.url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80';
                            return `
                            <div class="artifact-card p-1.5 rounded-lg space-y-1 border border-brand-500/30 hover:border-brand-500 transition relative group">
                                <div class="aspect-[16/10] bg-muted/60 rounded flex flex-col items-center justify-center border border-dashed border-brand-500/40 relative overflow-hidden cursor-pointer" onclick="app.openUploadedPhotoLightbox('${job.id}', '${p.id}')">
                                    <img src="${displayImg}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                                    <span class="absolute top-1 right-1 px-1 py-0.2 bg-brand-500 text-white rounded text-[8px] font-medium shadow-sm leading-tight">รูปที่ ${photoNum}</span>
                                    <span class="absolute top-1 left-1 px-1 py-0.2 bg-black/65 backdrop-blur-xs text-white rounded text-[7px] font-medium leading-tight">${p.tag || 'เพิ่ม'}</span>
                                    <div class="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                        <span class="text-white text-[9px] font-semibold bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i class="ph ph-magnifying-glass-plus"></i> ขยาย</span>
                                    </div>
                                </div>
                                <div class="flex items-start justify-between gap-0.5">
                                    <div class="flex-1 min-w-0">
                                        <div class="text-[11px] font-semibold text-foreground truncate leading-tight" title="${p.title}">${p.title}</div>
                                    </div>
                                    <button type="button" onclick="app.deletePhoto('${job.id}', '${p.id}')" title="ลบรูปนี้" class="p-0.5 text-muted-foreground hover:text-rose-500 rounded transition opacity-60 hover:opacity-100 cursor-pointer">
                                        <i class="ph ph-trash text-xs"></i>
                                    </button>
                                </div>
                                <div class="flex items-center justify-between text-[8px] font-mono leading-tight">
                                    <span class="text-emerald-500 flex items-center gap-0.5"><i class="ph ph-check"></i> GPS Verified</span>
                                    <span class="text-muted-foreground">${uploadTime}</span>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }

                    tabContent = `
                    <div class="space-y-2.5">
                        <!-- Top Dual Cards: Customer Info & Timeline Actions -->
                        <div class="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
                            <!-- Left: Customer & Location (5 Cols) -->
                            <div class="lg:col-span-5 artifact-card p-3 space-y-2 flex flex-col justify-between">
                                <div class="flex items-center justify-between pb-1.5 border-b border-border">
                                    <h3 class="font-display font-semibold text-xs text-foreground flex items-center gap-1.5">
                                        <i class="ph ph-user-circle text-brand-500 text-sm"></i> ข้อมูลลูกค้าและสถานที่
                                    </h3>
                                    <span class="text-[10px] text-brand-600 dark:text-brand-400 font-semibold bg-brand-500/10 px-2 py-0.2 rounded border border-brand-500/20">
                                        ${job.tech}
                                    </span>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <div class="text-[10px] text-muted-foreground font-medium">ชื่อลูกค้า:</div>
                                        <div class="text-xs font-semibold text-foreground truncate" title="${job.firstName || ''} ${job.lastName || ''} (${job.customer})">${job.firstName || ''} ${job.lastName || ''} <span class="text-muted-foreground font-normal">(${job.customer})</span></div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-muted-foreground font-medium">เบอร์โทร / บริการ:</div>
                                        <div class="text-xs font-mono text-foreground">${job.phone} <span class="text-[10px] text-brand-500 font-sans font-medium">(${job.service})</span></div>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-2.5 py-1 text-xs">
                                    <span class="text-[11px] font-mono text-brand-500 truncate">📍 ${job.lat || 13.7563}, ${job.lng || 100.5018}</span>
                                    <button class="text-[10px] text-muted-foreground hover:text-foreground bg-card px-2 py-0.5 rounded border border-border cursor-pointer shrink-0 ml-2" onclick="navigator.clipboard.writeText('${job.lat || 13.7563}, ${job.lng || 100.5018}'); app.showToast('คัดลอกพิกัด GPS เรียบร้อย');">Copy</button>
                                </div>

                                <div class="text-[11px] text-muted-foreground truncate" title="${job.address}">
                                    <strong class="text-foreground font-medium">ที่อยู่:</strong> ${job.address}
                                </div>
                            </div>

                            <!-- Right: Actions & Workflow Timeline (7 Cols) -->
                            <div class="lg:col-span-7 artifact-card p-3 space-y-2 flex flex-col justify-between">
                                <div class="flex items-center justify-between pb-1.5 border-b border-border">
                                    <h3 class="font-display font-semibold text-xs text-foreground flex items-center gap-1.5">
                                        <i class="ph ph-lightning text-brand-500 text-sm"></i> การดำเนินการด่วน (Quick Actions)
                                    </h3>
                                    <div class="flex items-center gap-2">
                                        ${actionButtons}
                                    </div>
                                </div>

                                <!-- 5-Step Workflow Timestamps Quick Header -->
                                <div class="p-2 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm shrink-0">
                                            <i class="ph ph-clock-counter-clockwise"></i>
                                        </div>
                                        <div>
                                            <div class="font-bold text-foreground text-[11px]">Workflow Step Timestamps Audit</div>
                                            <div class="text-[10px] text-muted-foreground">บันทึกเวลาประทับทุกขั้นตอนเพื่อทำ Report</div>
                                        </div>
                                    </div>
                                    <button type="button" onclick="app.openStepAuditReportModal('${job.id}')" class="btn-artifact-primary px-3 py-1 rounded-lg text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer">
                                        <i class="ph ph-file-text"></i>
                                        <span>เปิด Audit Report</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Site Photos Section (Compact 6-Columns) -->
                        <div class="artifact-card p-3 space-y-2">
                            <div class="flex items-center justify-between pb-1.5 border-b border-border">
                                <div class="flex items-center gap-2">
                                    <h3 class="font-display font-semibold text-xs text-foreground flex items-center gap-1.5">
                                        <i class="ph ph-images text-brand-500 text-sm"></i> รูปถ่ายหน้างาน (Site Photos)
                                    </h3>
                                    <span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-500 border border-brand-500/20">รวม ${totalPhotoCount} รูป</span>
                                    <span class="text-[10px] text-muted-foreground hidden sm:inline">• สำรวจหน้างานและ Check-in จาก AE</span>
                                </div>
                                <button class="btn-artifact-primary px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 shadow-sm font-medium cursor-pointer" onclick="app.openPhotoUploadModal('${job.id}')">
                                    <i class="ph ph-camera-plus text-xs"></i> <span>ถ่ายรูปเพิ่ม / Upload</span>
                                </button>
                            </div>

                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                ${basePhotos.map(p => `
                                <div class="artifact-card p-1.5 rounded-lg space-y-1 border border-border hover:border-brand-500/40 transition group cursor-pointer" onclick="app.openBasePhotoLightbox(${p.num})">
                                    <div class="aspect-[16/10] bg-muted/60 rounded flex flex-col items-center justify-center border border-dashed border-border relative overflow-hidden group">
                                        <i class="${p.icon} text-xl text-muted-foreground/60 group-hover:scale-110 transition"></i>
                                        <span class="absolute top-1 right-1 px-1 py-0.2 bg-emerald-500/90 text-white rounded text-[8px] font-medium leading-tight">รูปที่ ${p.num}</span>
                                        <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            <span class="text-white text-[9px] font-medium bg-black/70 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i class="ph ph-eye"></i> ดูรูป</span>
                                        </div>
                                    </div>
                                    <div class="text-[11px] font-semibold text-foreground truncate leading-tight" title="${p.title}">${p.title}</div>
                                    <div class="flex items-center justify-between text-[8px] text-muted-foreground leading-tight">
                                        <span class="text-emerald-500 font-mono flex items-center gap-0.5"><i class="ph ph-check"></i> GPS Verified</span>
                                    </div>
                                </div>
                                `).join('')}

                                ${extraPhotosHtml}

                                ${uploadedPhotos.length === 0 ? `
                                <div onclick="app.openPhotoUploadModal('${job.id}')" class="artifact-card p-1.5 rounded-lg border-2 border-dashed border-brand-500/30 hover:border-brand-500 hover:bg-brand-500/5 transition cursor-pointer flex flex-col items-center justify-center gap-1 text-center group min-h-[75px]">
                                    <div class="w-6 h-6 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition">
                                        <i class="ph ph-plus text-xs font-bold"></i>
                                    </div>
                                    <div class="text-[10px] font-semibold text-foreground group-hover:text-brand-500 transition leading-tight">เพิ่มรูปหน้างาน</div>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Dedicated Section: Site Notes & Special Instructions + Integrated Bottom Action Bar -->
                        <div class="artifact-card p-3 border border-brand-500/30 bg-card shadow-sm space-y-2">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                <!-- Special Instructions -->
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <label class="text-[11px] font-semibold text-foreground flex items-center gap-1">
                                            <i class="ph ph-warning-circle text-amber-500"></i> คำสั่งพิเศษ (Special Instructions)
                                        </label>
                                        <span class="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-medium">ข้อควรระวัง</span>
                                    </div>
                                    <textarea id="job-special-instructions" rows="2" class="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500 transition resize-none" placeholder="พิมพ์คำสั่งพิเศษ เช่น ระวังหมาดุ, นัดเข้าหลัง 10:00 น., ให้สวมถุงคลุมรองเท้า...">${job.special_instructions || ''}</textarea>
                                </div>

                                <!-- Additional Notes -->
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <label class="text-[11px] font-semibold text-foreground flex items-center gap-1">
                                            <i class="ph ph-notepad text-brand-500"></i> ข้อมูลเพิ่มเติม / หมายเหตุหน้างาน (Additional Notes)
                                        </label>
                                        <span class="text-[9px] text-brand-500 bg-brand-500/10 px-1.5 py-0.2 rounded border border-brand-500/20 font-medium">บันทึกหน้างาน</span>
                                    </div>
                                    <textarea id="job-additional-notes" rows="2" class="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-500 transition resize-none" placeholder="พิมพ์บันทึกข้อมูลเพิ่มเติมเกี่ยวกับสภาพหน้างานจริง วัสดุ หรือข้อสังเกตเพิ่มเติม...">${job.additional_notes || ''}</textarea>
                                </div>
                            </div>

                            <!-- Consolidated Unified Action Bar -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border">
                                <div class="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <i class="ph ph-info text-brand-500"></i> ข้อมูลคำสั่งพิเศษจะซิงค์ไปยังรายงาน QC อัตโนมัติ
                                </div>
                                <div class="flex items-center gap-2">
                                    <button type="button" onclick="app.saveJobNotes('${job.id}')" class="btn-artifact-secondary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                                        <i class="ph ph-floppy-disk text-sm"></i>
                                        <span>บันทึกหมายเหตุ & คำสั่งพิเศษ</span>
                                    </button>
                                    ${job.pmt_accepted ? `
                                    <button class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 font-medium shadow-sm cursor-pointer" onclick="app.navigate('blueprints')">
                                        <span>ไปหน้าบันทึก Design (Step 2)</span> <i class="ph ph-arrow-right text-xs"></i>
                                    </button>
                                    ` : `
                                    <button class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 font-semibold shadow-sm cursor-pointer" onclick="app.acceptJobToPMT('${job.id}')">
                                        <i class="ph ph-check-circle text-sm"></i>
                                        <span>รับเข้าระบบ PMT</span>
                                        <i class="ph ph-arrow-right text-xs ml-0.5"></i>
                                    </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }

                const totalPhotosCount = 5 + (job.photos?.length || 0);
                const html = `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border">
                        <div class="flex items-center gap-2.5">
                            <button onclick="app.navigate('jobs')" class="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer">
                                <i class="ph ph-arrow-left text-sm"></i>
                            </button>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="font-display text-lg font-bold text-foreground tracking-tight">${job.id}</h2>
                                    <span class="text-xs text-muted-foreground">/ ${job.customer}</span>
                                </div>
                                <p class="text-[11px] text-muted-foreground">นัดติดตั้ง: <strong class="text-foreground font-medium">${job.date}</strong> ${job.start_time ? `<span class="text-brand-600 dark:text-brand-400 font-mono font-medium">(${job.start_time}${job.end_time ? ' - ' + job.end_time : ''} น.)</span>` : ''} • ผู้รับผิดชอบ: <strong class="text-foreground font-semibold">${job.tech}</strong></p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${this.getStatusHtml(job.status)}
                        </div>
                    </div>

                    <!-- 5-Step Workflow & Timestamps Audit Pipeline Tracker Card -->
                    <div class="artifact-card p-4 space-y-3 bg-gradient-to-br from-card via-card to-purple-500/5 border border-border shadow-xs">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg shrink-0">
                                    <i class="ph ph-git-commit"></i>
                                </div>
                                <div>
                                    <h3 class="font-display font-bold text-xs text-foreground flex items-center gap-1.5">
                                        <span>5 ขั้นตอนการปฏิบัติงาน & บันทึกเวลา (Workflow Step Timestamps)</span>
                                        <span class="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Audit Trail Active</span>
                                    </h3>
                                    <p class="text-[10px] text-muted-foreground">บันทึกเวลาอัตโนมัติทุกขั้นตอน (Step 1-5) เพื่อความโปร่งใสและการจัดทำรายงาน Audit & SLA</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button type="button" onclick="app.openStepAuditReportModal('${job.id}')" class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer">
                                    <i class="ph ph-file-text text-sm"></i>
                                    <span>📄 ดูรายงาน Audit Report</span>
                                </button>
                            </div>
                        </div>

                        <!-- 5 Steps Horizontal Responsive Cards -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                            ${(() => {
                                const report = app.getJobStepAuditReportData(job.id);
                                if (!report) return '';
                                return report.steps.map(s => {
                                    const isDone = s.isDone;
                                    const tsText = s.timestamp ? app.formatTimestamp(s.timestamp) : 'ยังไม่ดำเนินการ';
                                    const iconMap = {
                                        1: 'ph-file-text',
                                        2: 'ph-blueprint',
                                        3: 'ph-receipt',
                                        4: 'ph-calculator',
                                        5: 'ph-calendar-check'
                                    };
                                    let actionBtn = '';
                                    if (s.stepNumber === 1) {
                                        actionBtn = `<span class="text-[9px] text-muted-foreground font-mono truncate">${job.external_ref_id || job.id}</span>`;
                                    } else if (s.stepNumber === 2) {
                                        actionBtn = `<button type="button" onclick="app.navigate('blueprints')" class="text-[10px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"><i class="ph ph-arrow-square-out"></i> ไปหน้า Design</button>`;
                                    } else if (s.stepNumber === 3) {
                                        actionBtn = `<button type="button" onclick="app.navigate('tickets')" class="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"><i class="ph ph-arrow-square-out"></i> ไปหน้า Ticket</button>`;
                                    } else if (s.stepNumber === 4) {
                                        actionBtn = `<button type="button" onclick="app.switchJobTab('boq')" class="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"><i class="ph ph-receipt"></i> นำBOQ เข้าระบบ</button>`;
                                    } else if (s.stepNumber === 5) {
                                        actionBtn = `<button type="button" onclick="app.navigate('gantt')" class="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"><i class="ph ph-chart-bar"></i> ผัง Gantt</button>`;
                                    }

                                    return `
                                    <div class="p-2.5 rounded-xl border ${isDone ? 'bg-emerald-500/5 border-emerald-500/25 dark:bg-emerald-500/10' : 'bg-muted/30 border-border opacity-70'} flex flex-col justify-between space-y-2 transition hover:shadow-xs">
                                        <div>
                                            <div class="flex items-center justify-between gap-1 mb-1">
                                                <span class="w-5 h-5 rounded-full ${isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground border border-border'} font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                                    ${s.stepNumber}
                                                </span>
                                                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${isDone ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}">
                                                    ${isDone ? '✓ บันทึกแล้ว' : '⏳ รอดำเนินการ'}
                                                </span>
                                            </div>
                                            <div class="font-bold text-foreground text-[11px] leading-tight truncate" title="${s.name}">
                                                ${s.name}
                                            </div>
                                            <div class="text-[9px] text-muted-foreground truncate" title="${s.category}">
                                                ${s.category}
                                            </div>
                                        </div>

                                        <div class="pt-1.5 border-t border-border/50 space-y-1">
                                            <div class="font-mono text-[9px] ${isDone ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-muted-foreground/60 italic'} flex items-center gap-1 truncate" title="${tsText}">
                                                <i class="ph ph-clock text-[10px] ${isDone ? 'text-emerald-600' : 'text-muted-foreground/40'} shrink-0"></i>
                                                <span class="truncate">${tsText}</span>
                                            </div>
                                            <div class="flex items-center justify-between pt-0.5">
                                                ${actionBtn}
                                                <span class="text-[8px] font-mono text-muted-foreground">${s.leadTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                    `;
                                }).join('');
                            })()}
                        </div>
                    </div>

                    <!-- Navigation Tabs (2 Tabs) -->
                    <div class="flex gap-4 border-b border-border">
                        <button onclick="app.switchJobTab('general')" class="pb-2 text-xs font-semibold transition cursor-pointer ${curTab !== 'boq' ? 'tab-item-active' : 'text-muted-foreground hover:text-foreground'}">
                            <i class="ph ph-map-pin-line mr-1"></i> Check-in & ข้อมูลหน้างาน (${totalPhotosCount} รูป)
                        </button>
                        <button onclick="app.switchJobTab('boq')" class="pb-2 text-xs font-semibold transition cursor-pointer ${curTab === 'boq' ? 'tab-item-active' : 'text-muted-foreground hover:text-foreground'}">
                            <i class="ph ph-receipt mr-1"></i> บันทึกรายการ BOQ (PMT)
                        </button>
                    </div>

                    ${tabContent}
                `;
                document.getElementById('job-detail-content').innerHTML = html;
            },

            switchBlueprintTab(tab) {
                this.state.blueprintTab = tab;
                const tabPending = document.getElementById('tab-bp-pending');
                const tabLibrary = document.getElementById('tab-bp-library');
                const secPending = document.getElementById('blueprints-pending-container');
                const secLibrary = document.getElementById('blueprints-library-container');

                if (tab === 'library') {
                    if (tabPending) {
                        tabPending.className = "pb-3 text-xs font-semibold flex items-center gap-2 transition border-b-2 border-transparent text-muted-foreground hover:text-foreground cursor-pointer";
                    }
                    if (tabLibrary) {
                        tabLibrary.className = "pb-3 text-xs font-semibold flex items-center gap-2 transition border-b-2 border-indigo-600 text-foreground cursor-pointer";
                    }
                    if (secPending) secPending.classList.add('hidden-view');
                    if (secLibrary) secLibrary.classList.remove('hidden-view');
                } else {
                    if (tabPending) {
                        tabPending.className = "pb-3 text-xs font-semibold flex items-center gap-2 transition border-b-2 border-indigo-600 text-foreground cursor-pointer";
                    }
                    if (tabLibrary) {
                        tabLibrary.className = "pb-3 text-xs font-semibold flex items-center gap-2 transition border-b-2 border-transparent text-muted-foreground hover:text-foreground cursor-pointer";
                    }
                    if (secPending) secPending.classList.remove('hidden-view');
                    if (secLibrary) secLibrary.classList.add('hidden-view');
                }
            },

            setBlueprintViewMode(mode) {
                this.state.blueprintViewMode = mode;
                try { localStorage.setItem('pmt_blueprint_view_mode', mode); } catch (e) {}
                this.updateBlueprintViewModeButtons();
                this.renderBlueprints();
            },

            updateBlueprintViewModeButtons() {
                const mode = this.state.blueprintViewMode || 'card';
                const btnCard = document.getElementById('btn-blueprint-mode-card');
                const btnList = document.getElementById('btn-blueprint-mode-list');
                if (btnCard && btnList) {
                    if (mode === 'card') {
                        btnCard.className = 'px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnList.className = 'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    } else {
                        btnList.className = 'px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnCard.className = 'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    }
                }
            },

            handleDirectBlueprintUpload(event, jobId) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                this.openUploadBlueprintModal(jobId);
                this.processSelectedBlueprintFile(file);
                event.target.value = '';
            },

            renderBlueprints(searchQuery = '', serviceFilter = 'all') {
                const searchEl = document.getElementById('blueprint-search');
                const serviceEl = document.getElementById('blueprint-filter-service');
                const q = (searchQuery || (searchEl ? searchEl.value : '')).toLowerCase().trim();
                const sFilter = serviceFilter !== 'all' ? serviceFilter : (serviceEl ? serviceEl.value : 'all');

                const allJobs = DB.jobs || [];
                let blueprints = DB.blueprints || [];

                // Map which jobs have blueprints attached
                const designedJobIds = new Set(blueprints.map(b => b.jobId));

                // 1. Calculate and render pending design jobs queue
                let pendingDesignJobs = allJobs.filter(j => !designedJobIds.has(j.id));
                if (q) {
                    pendingDesignJobs = pendingDesignJobs.filter(j =>
                        (j.id && j.id.toLowerCase().includes(q)) ||
                        (j.customer && j.customer.toLowerCase().includes(q)) ||
                        (j.service && j.service.toLowerCase().includes(q)) ||
                        (j.address && j.address.toLowerCase().includes(q))
                    );
                }
                if (sFilter && sFilter !== 'all') {
                    pendingDesignJobs = pendingDesignJobs.filter(j => (j.service || '').includes(sFilter));
                }

                // 2. Filter uploaded blueprints
                if (q) {
                    blueprints = blueprints.filter(b => 
                        b.id.toLowerCase().includes(q) ||
                        b.jobId.toLowerCase().includes(q) ||
                        b.customer.toLowerCase().includes(q) ||
                        b.filename.toLowerCase().includes(q) ||
                        (b.designer && b.designer.toLowerCase().includes(q))
                    );
                }
                if (sFilter && sFilter !== 'all') {
                    blueprints = blueprints.filter(b => (b.service || '').includes(sFilter));
                }

                // Update Stats
                const totalPendingCount = allJobs.filter(j => !designedJobIds.has(j.id)).length;
                const totalDesignedCount = designedJobIds.size;
                const totalBpFiles = (DB.blueprints || []).length;

                const statPendingEl = document.getElementById('blueprints-stat-pending');
                if (statPendingEl) statPendingEl.innerText = totalPendingCount;
                const statDesignedEl = document.getElementById('blueprints-stat-designed');
                if (statDesignedEl) statDesignedEl.innerText = totalDesignedCount;
                const statTotalEl = document.getElementById('blueprints-stat-total');
                if (statTotalEl) statTotalEl.innerText = totalBpFiles;
                const statJobsEl = document.getElementById('blueprints-stat-jobs');
                if (statJobsEl) statJobsEl.innerText = allJobs.length;

                // Update tab badges
                const tabPendingBadge = document.getElementById('tab-bp-pending-badge');
                if (tabPendingBadge) tabPendingBadge.innerText = totalPendingCount;
                const tabLibraryBadge = document.getElementById('tab-bp-library-badge');
                if (tabLibraryBadge) tabLibraryBadge.innerText = totalBpFiles;

                // Update sidebar badge to show pending design count
                const sbBp = document.getElementById('sidebar-blueprint-count');
                if (sbBp) sbBp.innerText = totalPendingCount;

                this.updateBlueprintViewModeButtons();
                const isList = (this.state.blueprintViewMode === 'list');

                // 3. Render Pending Queue Container
                const pendingContainer = document.getElementById('blueprints-pending-list');
                if (pendingContainer) {
                    if (isList) {
                        pendingContainer.className = "w-full overflow-hidden";
                    } else {
                        pendingContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
                    }

                    if (pendingDesignJobs.length === 0) {
                        pendingContainer.innerHTML = `
                            <div class="col-span-full artifact-card p-10 text-center text-muted-foreground border border-dashed border-border">
                                <i class="ph ph-check-circle text-4xl mb-2 text-emerald-500"></i>
                                <h4 class="font-display font-medium text-foreground text-sm">ไม่มีงานที่รอจัดทำ Design ในขณะนี้</h4>
                                <p class="text-xs text-muted-foreground mt-1">ทุกโครงการในระบบได้จัดทำแบบแปลนติดตั้งแล้ว หรือไม่ตรงกับเงื่อนไขการค้นหา</p>
                            </div>
                        `;
                    } else if (isList) {
                        pendingContainer.innerHTML = `
                            <div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr class="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                                            <th class="py-3 px-4 font-mono">JOB ID</th>
                                            <th class="py-3 px-4">วันที่รับ Order</th>
                                            <th class="py-3 px-4">ลูกค้า</th>
                                            <th class="py-3 px-4">บริการ / งานติดตั้ง</th>
                                            <th class="py-3 px-4">สถานที่ติดตั้ง</th>
                                            <th class="py-3 px-4">ช่างผู้รับผิดชอบ</th>
                                            <th class="py-3 px-4 text-center">สถานะ</th>
                                            <th class="py-3 px-4 text-right">ดำเนินการ</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border">
                                        ${pendingDesignJobs.map(job => `
                                            <tr class="hover:bg-muted/30 transition">
                                                <td class="py-3 px-4 font-mono font-bold text-foreground">
                                                    <span class="bg-muted px-2 py-0.5 rounded border border-border">${job.id}</span>
                                                </td>
                                                <td class="py-3 px-4 font-mono text-muted-foreground text-[11px]">${job.date || '-'}</td>
                                                <td class="py-3 px-4 font-medium text-foreground">${job.customer}</td>
                                                <td class="py-3 px-4 text-brand-600 dark:text-brand-400 font-medium">${job.service}</td>
                                                <td class="py-3 px-4 text-muted-foreground text-[11px] max-w-[180px] truncate" title="${job.address || '-'}">
                                                    ${job.address || '-'}
                                                </td>
                                                <td class="py-3 px-4 text-muted-foreground">
                                                    <div class="flex items-center gap-1.5">
                                                        <i class="ph ph-wrench text-muted-foreground"></i>
                                                        <span class="text-foreground font-medium">${job.tech || 'ยังไม่ระบุ'}</span>
                                                    </div>
                                                </td>
                                                <td class="py-3 px-4 text-center whitespace-nowrap">
                                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                                        <i class="ph ph-clock"></i> รอแบบ Design
                                                    </span>
                                                </td>
                                                <td class="py-3 px-4 text-right whitespace-nowrap">
                                                    <div class="flex items-center justify-end gap-1.5">
                                                        <button type="button" onclick="app.navigate('job-detail', '${job.id}')" class="btn-artifact-secondary px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer" title="ดูรายละเอียดงาน">
                                                            <i class="ph ph-eye"></i> <span>ดูงาน</span>
                                                        </button>
                                                        <button type="button" onclick="app.openUploadBlueprintModal('${job.id}')" class="btn-artifact-secondary p-1.5 rounded-lg text-xs cursor-pointer" title="ฟอร์มบันทึกแบบแปลน">
                                                            <i class="ph ph-pencil-simple"></i>
                                                        </button>
                                                        <label for="bp-list-upload-${job.id}" class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm" title="เลือกไฟล์เพื่ออัปโหลดแบบแปลนทันที">
                                                            <i class="ph ph-upload-simple"></i>
                                                            <span>อัปโหลด Design</span>
                                                        </label>
                                                        <input type="file" id="bp-list-upload-${job.id}" class="sr-only" accept=".pdf,.dwg,.dxf,.cad,.png,.jpg,.jpeg,.zip,.rar" onchange="app.handleDirectBlueprintUpload(event, '${job.id}')">
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        pendingContainer.innerHTML = pendingDesignJobs.map(job => {
                            return `
                            <div class="artifact-card p-5 rounded-2xl border border-border hover:border-indigo-500/50 transition duration-200 space-y-3.5 bg-card group shadow-xs">
                                <div class="flex items-start justify-between gap-2">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">${job.id}</span>
                                            <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                                <i class="ph ph-clock"></i> รอแบบ Design
                                            </span>
                                        </div>
                                        <h4 class="font-display font-bold text-sm text-foreground mt-1.5">${job.customer}</h4>
                                        <p class="text-[11px] text-brand-600 dark:text-brand-400 font-medium">${job.service}</p>
                                    </div>
                                    <span class="text-[10px] font-mono text-muted-foreground shrink-0">${job.date || '-'}</span>
                                </div>

                                <div class="text-[11px] text-muted-foreground space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border/50">
                                    <div class="flex items-center gap-1.5 truncate">
                                        <i class="ph ph-map-pin text-muted-foreground shrink-0"></i>
                                        <span class="truncate" title="${job.address || '-'}">${job.address || 'ไม่ระบุที่อยู่'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <i class="ph ph-wrench text-muted-foreground shrink-0"></i>
                                        <span>ช่าง: <strong class="text-foreground font-medium">${job.tech || 'ยังไม่ระบุช่าง'}</strong></span>
                                    </div>
                                </div>

                                <div class="pt-2 border-t border-border flex items-center justify-between gap-2">
                                    <button type="button" onclick="app.navigate('job-detail', '${job.id}')" class="btn-artifact-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                                        <i class="ph ph-eye"></i> ดูงาน
                                    </button>
                                    <div class="flex items-center gap-1.5">
                                        <button type="button" onclick="app.openUploadBlueprintModal('${job.id}')" class="btn-artifact-secondary px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer" title="กรอกข้อมูล / บันทึกแบบแปลน">
                                            <i class="ph ph-pencil-simple"></i>
                                        </button>
                                        <label for="bp-card-upload-${job.id}" class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm" title="เลือกไฟล์เพื่ออัปโหลดแบบแปลนทันที">
                                            <i class="ph ph-upload-simple"></i>
                                            <span>อัปโหลด Design</span>
                                        </label>
                                        <input type="file" id="bp-card-upload-${job.id}" class="sr-only" accept=".pdf,.dwg,.dxf,.cad,.png,.jpg,.jpeg,.zip,.rar" onchange="app.handleDirectBlueprintUpload(event, '${job.id}')">
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }
                }

                // 4. Render Blueprints Library Container
                const container = document.getElementById('blueprints-list-container');
                const libCountText = document.getElementById('blueprints-library-count-text');
                if (libCountText) libCountText.innerText = `แสดง ${blueprints.length} จาก ${totalBpFiles} ไฟล์`;

                if (container) {
                    if (isList) {
                        container.className = "w-full overflow-hidden";
                    } else {
                        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
                    }

                    if (blueprints.length === 0) {
                        container.innerHTML = `
                            <div class="col-span-full artifact-card p-12 text-center text-muted-foreground border border-dashed border-border">
                                <i class="ph ph-file-dashed text-4xl mb-2 text-muted-foreground/50"></i>
                                <h4 class="font-display font-medium text-foreground text-sm">ไม่พบไฟล์แบบแปลนที่ตรงกับเงื่อนไข</h4>
                                <p class="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "อัปโหลดแบบแปลนใหม่"</p>
                            </div>
                        `;
                    } else if (isList) {
                        container.innerHTML = `
                            <div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr class="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                                            <th class="py-3 px-4 font-mono">รหัสแบบ</th>
                                            <th class="py-3 px-4 font-mono">JOB ID</th>
                                            <th class="py-3 px-4">ชื่อไฟล์แบบแปลน</th>
                                            <th class="py-3 px-4">ลูกค้า</th>
                                            <th class="py-3 px-4">ประเภทบริการ</th>
                                            <th class="py-3 px-4 text-center">เวอร์ชัน</th>
                                            <th class="py-3 px-4">ขนาดไฟล์</th>
                                            <th class="py-3 px-4">ผู้ออกแบบ</th>
                                            <th class="py-3 px-4">วันที่บันทึก</th>
                                            <th class="py-3 px-4 text-right">ดำเนินการ</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border">
                                        ${blueprints.map(b => `
                                            <tr class="hover:bg-muted/30 transition">
                                                <td class="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">${b.id}</td>
                                                <td class="py-3 px-4 font-mono text-foreground font-bold">${b.jobId}</td>
                                                <td class="py-3 px-4">
                                                    <div class="flex items-center gap-2">
                                                        <i class="ph ph-file-pdf text-rose-500 text-base"></i>
                                                        <span class="font-medium text-foreground truncate max-w-[200px]" title="${b.filename}">${b.filename}</span>
                                                    </div>
                                                </td>
                                                <td class="py-3 px-4 font-medium text-foreground">${b.customer}</td>
                                                <td class="py-3 px-4 text-brand-600 dark:text-brand-400 font-medium">${b.service}</td>
                                                <td class="py-3 px-4 text-center">
                                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow-xs">${b.version}</span>
                                                </td>
                                                <td class="py-3 px-4 font-mono text-muted-foreground text-[11px]">${b.size}</td>
                                                <td class="py-3 px-4 text-muted-foreground text-[11px]">${b.designer || 'Designer'}</td>
                                                <td class="py-3 px-4 font-mono text-muted-foreground text-[11px]">${b.date}</td>
                                                <td class="py-3 px-4 text-right whitespace-nowrap">
                                                    <div class="flex items-center justify-end gap-1.5">
                                                        <button class="btn-artifact-primary px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onclick="app.openBasePhotoLightbox(1)" title="ดูตัวอย่างแบบ">
                                                            <i class="ph ph-eye"></i> <span>ดูตัวอย่าง</span>
                                                        </button>
                                                        <button class="btn-artifact-secondary p-1.5 rounded-lg text-xs cursor-pointer" title="ดาวน์โหลดไฟล์ PDF" onclick="app.showToast('กำลังดาวน์โหลด ${b.filename}...')">
                                                            <i class="ph ph-download-simple"></i>
                                                        </button>
                                                        <button class="btn-artifact-primary px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium cursor-pointer" onclick="app.navigate('job-detail', '${b.jobId}')" title="เปิดดูงาน">
                                                            <span>เปิดดูงาน</span> <i class="ph ph-arrow-right"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        container.innerHTML = blueprints.map(b => {
                            return `
                            <div class="artifact-card p-5 rounded-2xl space-y-4 border border-border hover:border-indigo-500/40 transition group">
                                <!-- Card Top: Thumbnail & Version -->
                                <div class="aspect-video bg-muted/60 rounded-xl overflow-hidden relative border border-border group-hover:border-indigo-500/30 transition">
                                    <img src="${b.previewImg}" alt="${b.filename}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                                    <div class="absolute top-3 right-3 flex items-center gap-1.5">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow-sm">${b.version}</span>
                                    </div>
                                    <div class="absolute top-3 left-3">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-xs text-white">${b.jobId}</span>
                                    </div>
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                        <button class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onclick="app.openBasePhotoLightbox(1)">
                                            <i class="ph ph-eye"></i> ดูตัวอย่างแบบ
                                        </button>
                                    </div>
                                </div>

                                <!-- Card Info -->
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between gap-2">
                                        <h4 class="font-display font-bold text-sm text-foreground truncate" title="${b.filename}">${b.filename}</h4>
                                        <span class="text-[10px] font-mono text-muted-foreground shrink-0">${b.size}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <i class="ph ph-user text-xs"></i> <span>${b.customer}</span> • <span class="text-brand-500 font-medium">${b.service}</span>
                                    </div>
                                    <p class="text-[11px] text-muted-foreground/90 line-clamp-2">${b.notes || 'แบบแปลนและผังงานติดตั้งฉบับมาตรฐาน'}</p>
                                </div>

                                <!-- Card Footer -->
                                <div class="pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                                    <div>
                                        <div>${b.designer || 'Designer'}</div>
                                        <div class="text-[9px] font-mono opacity-75">${b.date}</div>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <button class="btn-artifact-secondary p-1.5 rounded-lg text-xs cursor-pointer" title="ดาวน์โหลดไฟล์ PDF" onclick="app.showToast('กำลังดาวน์โหลด ${b.filename}...')">
                                            <i class="ph ph-download-simple"></i>
                                        </button>
                                        <button class="btn-artifact-primary px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 font-medium cursor-pointer" onclick="app.navigate('job-detail', '${b.jobId}')">
                                            <span>เปิดดูงาน</span> <i class="ph ph-arrow-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }
                }
            },

            filterBlueprints() {
                this.renderBlueprints();
            },

            handleBlueprintFileSelect(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                this.processSelectedBlueprintFile(file);
            },

            handleBlueprintDragOver(event) {
                event.preventDefault();
                const dropzone = document.getElementById('upload-bp-dropzone');
                if (dropzone) dropzone.classList.add('border-indigo-500', 'bg-indigo-500/10');
            },

            handleBlueprintDragLeave(event) {
                event.preventDefault();
                const dropzone = document.getElementById('upload-bp-dropzone');
                if (dropzone) dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
            },

            handleBlueprintDrop(event) {
                event.preventDefault();
                const dropzone = document.getElementById('upload-bp-dropzone');
                if (dropzone) dropzone.classList.remove('border-indigo-500', 'bg-indigo-500/10');
                if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                    this.processSelectedBlueprintFile(event.dataTransfer.files[0]);
                }
            },

            processSelectedBlueprintFile(file) {
                const nameInput = document.getElementById('upload-bp-filename');
                if (nameInput) nameInput.value = file.name;

                const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                const sizeText = file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${sizeMb} MB`;
                this.state.newBlueprintSize = sizeText;
                this.state.newBlueprintFileName = file.name;

                const ext = file.name.split('.').pop().toLowerCase();
                let iconClass = 'ph-file';
                if (ext === 'pdf') iconClass = 'ph-file-pdf text-rose-500';
                else if (['dwg', 'dxf', 'cad'].includes(ext)) iconClass = 'ph-file-code text-indigo-500';
                else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) iconClass = 'ph-file-image text-emerald-500';

                const iconEl = document.getElementById('upload-bp-file-icon');
                if (iconEl) iconEl.innerHTML = `<i class="ph ${iconClass} text-xl"></i>`;

                const nameEl = document.getElementById('upload-bp-file-display-name');
                if (nameEl) nameEl.innerText = file.name;

                const sizeEl = document.getElementById('upload-bp-file-display-size');
                if (sizeEl) sizeEl.innerText = `${sizeText} • พร้อมบันทึกเข้าสู่ Step 2`;

                const cardEl = document.getElementById('upload-bp-selected-file');
                if (cardEl) cardEl.classList.remove('hidden');

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.state.newBlueprintPreview = e.target.result;
                    };
                    reader.readAsDataURL(file);
                } else {
                    this.state.newBlueprintPreview = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80';
                }

                this.showToast(`📎 แนบไฟล์ "${file.name}" (${sizeText}) สำเร็จแล้ว`);
            },

            clearBlueprintSelectedFile() {
                const fileInput = document.getElementById('upload-bp-file');
                if (fileInput) fileInput.value = '';
                const cardEl = document.getElementById('upload-bp-selected-file');
                if (cardEl) cardEl.classList.add('hidden');
                this.state.newBlueprintSize = null;
                this.state.newBlueprintFileName = null;
                this.state.newBlueprintPreview = null;
            },

            useSampleBlueprint(type) {
                let filename = 'Air_Installation_Layout_v3_Final.pdf';
                let size = '3.4 MB';
                let version = 'v3 Final';
                let notes = 'แบบแปลนจุดติดตั้งคอยล์เย็นในห้องนอนใหญ่ และตำแหน่งแขวนคอนเดนซิ่งยูนิตภายนอก';

                if (type === 'kitchen') {
                    filename = 'Kitchen_Renovate_Plumbing_Schematic.dwg';
                    size = '5.8 MB';
                    version = 'v2 Approved';
                    notes = 'ไดอะแกรมระบบสุขาภิบาล จุดต่อน้ำดี-น้ำทิ้ง และตำแหน่งตู้เคาน์เตอร์ครัว Built-in';
                } else if (type === 'solar') {
                    filename = 'Solar_Rooftop_5kW_Wiring_Diagram.pdf';
                    size = '4.2 MB';
                    version = 'v1 Approved';
                    notes = 'แบบผังติดตั้งแผงโซลาร์เซลล์บนหลังคา และแนวเดินสายไฟ DC/AC Protection';
                }

                const nameInput = document.getElementById('upload-bp-filename');
                if (nameInput) nameInput.value = filename;

                const verInput = document.getElementById('upload-bp-version');
                if (verInput) verInput.value = version;

                const notesInput = document.getElementById('upload-bp-notes');
                if (notesInput && !notesInput.value) notesInput.value = notes;

                this.state.newBlueprintSize = size;
                this.state.newBlueprintFileName = filename;

                const ext = filename.split('.').pop().toLowerCase();
                const iconClass = ext === 'pdf' ? 'ph-file-pdf text-rose-500' : 'ph-file-code text-indigo-500';
                const iconEl = document.getElementById('upload-bp-file-icon');
                if (iconEl) iconEl.innerHTML = `<i class="ph ${iconClass} text-xl"></i>`;

                const nameEl = document.getElementById('upload-bp-file-display-name');
                if (nameEl) nameEl.innerText = filename;

                const sizeEl = document.getElementById('upload-bp-file-display-size');
                if (sizeEl) sizeEl.innerText = `${size} • ไฟล์ตัวอย่างมาตรฐาน`;

                const cardEl = document.getElementById('upload-bp-selected-file');
                if (cardEl) cardEl.classList.remove('hidden');

                this.showToast(`📐 เลือกไฟล์ตัวอย่าง "${filename}" เรียบร้อย`);
            },

            openUploadBlueprintModal(preselectedJobId = null) {
                this.clearBlueprintSelectedFile();
                const jobs = DB.jobs || [];
                const selectJob = document.getElementById('upload-bp-jobid');
                if (selectJob) {
                    selectJob.innerHTML = jobs.map(j => `<option value="${j.id}">${j.id} - ${j.customer} (${j.service})</option>`).join('');
                    if (preselectedJobId) {
                        selectJob.value = preselectedJobId;
                    }
                    selectJob.onchange = (e) => {
                        const jId = e.target.value;
                        const j = jobs.find(job => job.id === jId);
                        const fnInput = document.getElementById('upload-bp-filename');
                        if (j && fnInput && (!this.state.newBlueprintFileName || !fnInput.value || fnInput.value.includes('_Layout_'))) {
                            const sanitizedSvc = (j.service || 'Service').replace(/\s+/g, '_').substring(0, 20);
                            fnInput.value = `${j.id}_Layout_${sanitizedSvc}.pdf`;
                        }
                    };
                }
                const filenameInput = document.getElementById('upload-bp-filename');
                const targetJobId = preselectedJobId || (selectJob ? selectJob.value : (jobs[0] ? jobs[0].id : null));
                if (filenameInput) {
                    if (targetJobId) {
                        const selJob = jobs.find(j => j.id === targetJobId);
                        if (selJob) {
                            const sanitizedSvc = (selJob.service || 'Service').replace(/\s+/g, '_').substring(0, 20);
                            filenameInput.value = `${selJob.id}_Layout_${sanitizedSvc}.pdf`;
                        } else {
                            filenameInput.value = '';
                        }
                    } else {
                        filenameInput.value = '';
                    }
                }
                this.showModal('modal-upload-blueprint');
            },

            submitUploadBlueprint(event) {
                event.preventDefault();
                const jobId = document.getElementById('upload-bp-jobid').value;
                const filename = document.getElementById('upload-bp-filename').value.trim();
                const version = document.getElementById('upload-bp-version').value.trim() || 'v2 Final';
                const designer = document.getElementById('upload-bp-designer').value.trim() || 'คุณธนกฤต (Designer)';
                const notes = document.getElementById('upload-bp-notes').value.trim();

                const job = DB.jobs.find(j => j.id === jobId);
                const newBp = {
                    id: 'BP' + String((DB.blueprints ? DB.blueprints.length : 0) + 1).padStart(3, '0'),
                    jobId: jobId,
                    customer: job ? job.customer : 'ลูกค้าทั่วไป',
                    service: job ? job.service : 'งานบริการ',
                    filename: filename,
                    version: version,
                    isCurrent: true,
                    size: this.state.newBlueprintSize || '2.5 MB',
                    date: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
                    designer: designer,
                    previewImg: this.state.newBlueprintPreview || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80',
                    notes: notes
                };

                newBp.recorded_at = new Date().toISOString();
                if (!DB.blueprints) DB.blueprints = [];
                DB.blueprints.unshift(newBp);
                this.persistBlueprints();

                if (job) {
                    job.blueprint_id = newBp.id;
                    job.blueprint_name = filename;
                }
                this.persistJobs();

                // Step 2 Timestamp Recording
                this.recordStepTimestamp(jobId, 'step2_design_at', newBp.recorded_at, `แนบแบบแปลน ${filename} (${version})`);

                this.clearBlueprintSelectedFile();
                this.hideModal('modal-upload-blueprint');
                this.showToast(`✅ บันทึกและแนบแบบแปลน "${filename}" สำหรับ ${jobId} สำเร็จ`);
                if (this.state.currentView === 'blueprints') {
                    this.renderBlueprints();
                }
                if (this.state.currentView === 'job-detail') {
                    this.renderJobDetail();
                }
            },

            addBOQItem(jobId) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job) return;
                if (!job.boq_items) job.boq_items = [];
                job.boq_items.push({
                    name: 'รายการวัสดุ/ค่าแรงใหม่',
                    qty: 1,
                    unit: 'ชุด',
                    price: 500
                });
                this.renderJobDetail();
                this.showToast('เพิ่มแถวรายการ BOQ เรียบร้อย (บันทึกใน PMT)');
            },

            removeBOQItem(jobId, index) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job || !job.boq_items) return;
                job.boq_items.splice(index, 1);
                this.renderJobDetail();
                this.showToast('ลบรายการ BOQ เรียบร้อย');
            },

            updateBOQItem(jobId, index, field, value) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job || !job.boq_items || !job.boq_items[index]) return;
                if (field === 'qty' || field === 'price') {
                    job.boq_items[index][field] = parseFloat(value) || 0;
                } else {
                    job.boq_items[index][field] = value;
                }
                
                // update line total
                const lineTotal = (job.boq_items[index].qty || 0) * (job.boq_items[index].price || 0);
                const lineEl = document.getElementById(`boq-item-total-${index}`);
                if (lineEl) {
                    lineEl.innerText = lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                // update summary calculation
                const items = job.boq_items || [];
                const subtotal = items.reduce((sum, item) => sum + ((item.qty || 0) * (item.price || 0)), 0);
                const discount = job.boq_discount !== undefined ? job.boq_discount : 500;
                const taxable = Math.max(0, subtotal - discount);
                const vat = taxable * 0.07;
                const grandTotal = taxable + vat;

                const subtotalEl = document.getElementById('boq-subtotal-val');
                const vatEl = document.getElementById('boq-vat-val');
                const grandTotalEl = document.getElementById('boq-grandtotal-val');
                if (subtotalEl) subtotalEl.innerText = subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
                if (vatEl) vatEl.innerText = vat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
                if (grandTotalEl) grandTotalEl.innerText = grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
            },

            clearJobBOQ(jobId) {
                const targetJobId = jobId || this.state.currentJobId;
                const job = DB.jobs.find(j => j.id === targetJobId);
                if (!job) return;
                if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการ BOQ ทั้งหมดของโครงการ ${job.id}?`)) return;
                job.boq_items = [];
                job.boq_discount = 0;
                this.persistJobs();
                this.renderJobDetail();
                this.showToast(`🗑️ ลบรายการ BOQ ทั้งหมดของ ${job.id} เรียบร้อย`);
            },

            saveBOQOnly(jobId) {
                const job = DB.jobs.find(j => j.id === jobId);
                if (!job) return;
                this.persistJobs();
                this.renderJobDetail();
                this.showToast(`💾 บันทึกรายการ BOQ ของ ${job.id} เรียบร้อยแล้ว (หากพร้อมวางแผนงาน กรุณากด 'กำหนดวันเวลา & ช่าง')`);
            },

            saveBOQ(jobId) {
                this.openConvertBOQToTasksModal(jobId);
            },

            openSaveBOQModal(jobId) {
                const targetJobId = jobId || this.state.currentJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = DB.jobs.find(j => j.id === targetJobId);
                if (!job) {
                    this.showToast('⚠️ ไม่พบข้อมูล Job');
                    return;
                }

                this.state.saveBOQJobId = targetJobId;

                // Header info in modal
                const idEl = document.getElementById('save-boq-job-id');
                const custEl = document.getElementById('save-boq-job-customer');
                const servEl = document.getElementById('save-boq-job-service');
                if (idEl) idEl.innerText = job.id;
                if (custEl) custEl.innerText = `ลูกค้า: ${job.customer}`;
                if (servEl) servEl.innerText = `บริการ: ${job.service}`;

                // Get current BOQ items
                const items = job.boq_items && job.boq_items.length > 0 ? JSON.parse(JSON.stringify(job.boq_items)) : [];

                // Determine start & end datetime defaults
                const today = new Date().toISOString().slice(0, 10);
                const baseDate = job.date || today;
                const startTime = job.start_time || '08:30';
                const endTime = job.end_time || '17:30';
                const startDatetime = job.start_datetime || `${baseDate}T${startTime}`;
                const endDatetime = job.end_datetime || `${job.end_date || baseDate}T${endTime}`;

                const defaultTech = job.tech || 'Team A (สมศักดิ์)';
                const assignees = job.assignees && job.assignees.length > 0 ? [...job.assignees] : [defaultTech];

                // Helper to identify labor items (ค่าแรง / งานบริการ)
                const isLaborItem = (item) => {
                    if (item.labor_price && Number(item.labor_price) > 0) return true;
                    if (item.mat_price && Number(item.mat_price) > 0 && (!item.labor_price || Number(item.labor_price) === 0)) {
                        const strongLabor = ['ค่าแรง', 'งานติดตั้ง', 'บริการ', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียมหน้างาน', 'ทดสอบระบบ', 'ล้าง', 'ซ่อม'];
                        return strongLabor.some(kw => (item.name || '').includes(kw));
                    }
                    const name = item.name || '';
                    const laborKeywords = ['ค่าแรง', 'งาน', 'บริการ', 'ช่าง', 'ติดตั้ง', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียม', 'ประกอบ', 'ทดสอบ', 'ซ่อม', 'ล้าง'];
                    const materialKeywords = ['ชุดท่อ', 'รางครอบ', 'ขาแขวน', 'เบรกเกอร์', 'ถังเก็บน้ำ', 'ปั๊มน้ำ', 'สายไฟ', 'วาล์ว', 'ฐานรอง', 'อุปกรณ์', 'อะไหล่', 'ทองแดง'];
                    const hasLabor = laborKeywords.some(kw => name.includes(kw));
                    const hasMaterial = materialKeywords.some(kw => name.includes(kw));
                    if (hasLabor && !hasMaterial) return true;
                    if (name.startsWith('ค่าแรง') || name.startsWith('งาน') || name.startsWith('บริการ')) return true;
                    return hasLabor;
                };

                const laborItems = items.filter(isLaborItem);
                const startDateOnly = startDatetime.slice(0, 10);

                const generatedTasks = (laborItems.length > 0 ? laborItems : items.slice(0, 2)).map((item, idx) => {
                    let taskName = item.name.replace(/^ค่าแรงช่าง/, 'งาน').replace(/^ค่าแรง/, 'งาน');
                    const d = new Date(startDateOnly);
                    d.setDate(d.getDate() + idx);
                    const taskStart = d.toISOString().slice(0, 10);
                    return {
                        name: taskName,
                        start: taskStart,
                        end: taskStart,
                        tech: defaultTech
                    };
                });

                this.state.saveBOQData = {
                    jobId: targetJobId,
                    items: items,
                    discount: job.boq_discount !== undefined ? job.boq_discount : 500,
                    startDatetime: startDatetime,
                    endDatetime: endDatetime,
                    tech: defaultTech,
                    assignees: assignees,
                    tasks: generatedTasks
                };

                this.renderSaveBOQModal();
                this.showModal('modal-save-boq-schedule');
            },

            renderSaveBOQModal() {
                const data = this.state.saveBOQData;
                if (!data) return;

                // 1. Set datetime inputs
                const startInp = document.getElementById('save-boq-start-datetime');
                const endInp = document.getElementById('save-boq-end-datetime');
                if (startInp) startInp.value = data.startDatetime;
                if (endInp) endInp.value = data.endDatetime;
                this.updateSaveBOQDurationBadge();

                // 2. Render Tech Chips
                const availableTechs = [
                    'Team A (สมศักดิ์)',
                    'Team B (ประเสริฐ)',
                    'Team C (วิชัย)',
                    'ธนกฤต (ช่างแอร์)',
                    'กิตติพงษ์ (ช่างไฟฟ้า)',
                    'อนุชา (ผู้ช่วยช่าง)'
                ];
                const chipsContainer = document.getElementById('save-boq-tech-chips-container');
                if (chipsContainer) {
                    chipsContainer.innerHTML = availableTechs.map(tech => {
                        const isSelected = (data.assignees || []).includes(tech);
                        return `
                        <button type="button" onclick="app.toggleSaveBOQAssignee('${tech}')" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${isSelected ? 'bg-brand-500 text-white font-semibold shadow-xs ring-2 ring-brand-500/30' : 'bg-muted/70 hover:bg-muted text-foreground border border-border'}">
                            <i class="ph ${isSelected ? 'ph-check-bold' : 'ph-plus'}"></i>
                            <span>${tech}</span>
                        </button>
                        `;
                    }).join('');
                }

                const techTextInp = document.getElementById('save-boq-tech-text');
                if (techTextInp) {
                    techTextInp.value = data.tech || (data.assignees ? data.assignees.join(' + ') : '');
                }

                // 3. Render BOQ table
                const tbody = document.getElementById('save-boq-table-tbody');
                const countEl = document.getElementById('save-boq-items-count');
                if (countEl) countEl.innerText = data.items.length;

                let subtotal = 0;
                if (tbody) {
                    tbody.innerHTML = data.items.map((it, idx) => {
                        const lineTotal = (it.qty || 0) * (it.price || 0);
                        subtotal += lineTotal;
                        return `
                        <tr class="hover:bg-muted/30 transition">
                            <td class="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">${idx + 1}</td>
                            <td class="py-2.5 px-3 font-medium text-foreground">${it.name}</td>
                            <td class="py-2.5 px-3 text-center font-mono">${it.qty}</td>
                            <td class="py-2.5 px-3 text-center text-muted-foreground">${it.unit || 'ชุด'}</td>
                            <td class="py-2.5 px-3 text-right font-mono">${(it.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td class="py-2.5 px-3 text-right font-mono font-bold text-foreground">${lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</td>
                        </tr>
                        `;
                    }).join('');
                }

                const discount = data.discount || 0;
                const taxable = Math.max(0, subtotal - discount);
                const vat = taxable * 0.07;
                const grandTotal = taxable + vat;

                const subtotalEl = document.getElementById('save-boq-subtotal-val');
                const discountEl = document.getElementById('save-boq-discount-val');
                const vatEl = document.getElementById('save-boq-vat-val');
                const grandTotalEl = document.getElementById('save-boq-grandtotal-val');
                if (subtotalEl) subtotalEl.innerText = `${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                if (discountEl) discountEl.innerText = `-${discount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                if (vatEl) vatEl.innerText = `${vat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                if (grandTotalEl) grandTotalEl.innerText = `${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;

                // 4. Render Tasks breakdown preview
                const tasksTbody = document.getElementById('save-boq-tasks-preview-tbody');
                if (tasksTbody) {
                    if (!data.tasks || data.tasks.length === 0) {
                        tasksTbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-muted-foreground text-xs">ไม่มีรายการงานย่อย</td></tr>`;
                    } else {
                        tasksTbody.innerHTML = data.tasks.map((t, idx) => `
                        <tr class="hover:bg-muted/20 transition">
                            <td class="py-2 px-3 text-center text-muted-foreground font-mono">${idx + 1}</td>
                            <td class="py-2 px-3 font-medium text-foreground flex items-center gap-1.5">
                                <i class="ph ph-wrench text-brand-500"></i> <span>${t.name}</span>
                            </td>
                            <td class="py-2 px-3 font-mono text-muted-foreground">
                                <input type="date" value="${t.start}" onchange="app.updateSaveBOQTask(${idx}, 'start', this.value)" class="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-brand-500">
                            </td>
                            <td class="py-2 px-3 font-mono text-muted-foreground">
                                <input type="date" value="${t.end}" onchange="app.updateSaveBOQTask(${idx}, 'end', this.value)" class="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-brand-500">
                            </td>
                            <td class="py-2 px-3 text-xs text-purple-600 dark:text-purple-400 font-semibold truncate">
                                ${t.tech || data.tech}
                            </td>
                        </tr>
                        `).join('');
                    }
                }
            },

            updateSaveBOQDurationBadge() {
                const startInp = document.getElementById('save-boq-start-datetime');
                const endInp = document.getElementById('save-boq-end-datetime');
                const badge = document.getElementById('save-boq-duration-badge');
                if (!startInp || !endInp || !badge) return;

                if (startInp.value && endInp.value) {
                    const s = new Date(startInp.value);
                    const e = new Date(endInp.value);
                    if (e >= s) {
                        const diffMs = e - s;
                        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
                        const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                        if (diffHours < 24) {
                            badge.innerText = `ระยะเวลา: ${diffHours} ชม.`;
                        } else {
                            badge.innerText = `ระยะเวลา: ${diffDays} วัน (${diffHours} ชม.)`;
                        }
                    } else {
                        badge.innerText = `⚠️ วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น`;
                    }
                }
            },

            onSaveBOQScheduleChange() {
                const startInp = document.getElementById('save-boq-start-datetime');
                const endInp = document.getElementById('save-boq-end-datetime');
                if (!startInp || !endInp || !this.state.saveBOQData) return;

                this.state.saveBOQData.startDatetime = startInp.value;
                this.state.saveBOQData.endDatetime = endInp.value;

                const s = new Date(startInp.value);
                const e = new Date(endInp.value);
                if (e < s) {
                    // Auto adjust end time to be 8 hours after start
                    const adjustedEnd = new Date(s.getTime() + 8 * 60 * 60 * 1000);
                    endInp.value = adjustedEnd.toISOString().slice(0, 16);
                    this.state.saveBOQData.endDatetime = endInp.value;
                }

                this.updateSaveBOQDurationBadge();

                // Auto update tasks dates
                const startDateOnly = startInp.value.slice(0, 10);
                if (this.state.saveBOQData.tasks) {
                    this.state.saveBOQData.tasks.forEach((t, i) => {
                        const d = new Date(startDateOnly);
                        d.setDate(d.getDate() + i);
                        t.start = d.toISOString().slice(0, 10);
                        t.end = d.toISOString().slice(0, 10);
                    });
                    const tasksTbody = document.getElementById('save-boq-tasks-preview-tbody');
                    if (tasksTbody) {
                        this.renderSaveBOQModal();
                    }
                }
            },

            toggleSaveBOQAssignee(techName) {
                if (!this.state.saveBOQData) return;
                const data = this.state.saveBOQData;
                if (!data.assignees) data.assignees = [];

                const idx = data.assignees.indexOf(techName);
                if (idx >= 0) {
                    if (data.assignees.length > 1) {
                        data.assignees.splice(idx, 1);
                    }
                } else {
                    data.assignees.push(techName);
                }

                data.tech = data.assignees.join(' + ');
                if (data.tasks) {
                    data.tasks.forEach(t => t.tech = data.tech);
                }
                this.renderSaveBOQModal();
            },

            updateSaveBOQTask(idx, field, val) {
                if (!this.state.saveBOQData || !this.state.saveBOQData.tasks || !this.state.saveBOQData.tasks[idx]) return;
                this.state.saveBOQData.tasks[idx][field] = val;
            },

            confirmSaveBOQAndSchedule() {
                const data = this.state.saveBOQData;
                if (!data) return;

                const startInp = document.getElementById('save-boq-start-datetime');
                const endInp = document.getElementById('save-boq-end-datetime');
                const techTextInp = document.getElementById('save-boq-tech-text');

                const startDatetime = startInp ? startInp.value : data.startDatetime;
                const endDatetime = endInp ? endInp.value : data.endDatetime;
                const techName = techTextInp && techTextInp.value.trim() ? techTextInp.value.trim() : (data.tech || 'Team A (สมศักดิ์)');

                if (!startDatetime) {
                    this.showToast('⚠️ กรุณาระบุวันเวลาเริ่มทำงาน');
                    return;
                }
                if (!endDatetime) {
                    this.showToast('⚠️ กรุณาระบุวันจบงาน');
                    return;
                }

                const job = DB.jobs.find(j => j.id === data.jobId);
                if (!job) {
                    this.showToast('⚠️ ไม่พบข้อมูล Job');
                    return;
                }

                // Rule Enforcement: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart
                if (!data.items || data.items.length === 0) {
                    this.showToast('⚠️ ไม่สามารถบันทึกแผนงาน Task ได้: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart นะครับ');
                    return;
                }

                // Update job in mock DB
                job.boq_items = JSON.parse(JSON.stringify(data.items));
                job.start_datetime = startDatetime;
                job.end_datetime = endDatetime;
                job.date = startDatetime.slice(0, 10);
                job.start_time = startDatetime.slice(11, 16);
                job.end_date = endDatetime.slice(0, 10);
                job.end_time = endDatetime.slice(11, 16);
                job.tech = techName;
                job.assignees = data.assignees || [techName];

                // If job was DRAFT, advance or update status
                if (job.status === 'DRAFT') {
                    job.status = 'IN_PROGRESS';
                    job.progress = Math.max(job.progress || 0, 30);
                }

                // Sync tasks to Gantt Timeline
                if (!DB.tasks) DB.tasks = [];
                DB.tasks = DB.tasks.filter(t => t.jobId !== data.jobId);

                const tasksToSave = data.tasks && data.tasks.length > 0 ? data.tasks : [
                    { name: `งานติดตั้งและบริการ ${job.service}`, start: job.date, end: job.end_date || job.date, tech: job.tech }
                ];

                tasksToSave.forEach((st, i) => {
                    const sDate = new Date(st.start || job.date);
                    const eDate = new Date(st.end || st.start || job.date);
                    const days = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);
                    DB.tasks.push({
                        id: `T_${data.jobId}_${i + 1}`,
                        jobId: data.jobId,
                        name: st.name,
                        tech: st.tech || job.tech,
                        start: st.start || job.date,
                        end: st.end || st.start || job.date,
                        days: days,
                        status: 'IN_PROGRESS'
                    });
                });

                this.recordStepTimestamp(data.jobId, 'step4_boq_at', new Date().toISOString(), 'บันทึก BOQ & กำหนดวันปฏิบัติงาน');
                this.persistJobs();

                // Sync with backend API in background
                fetch(`/api/v1/jobs/${data.jobId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        start_date: job.date,
                        plan_start_date: job.date,
                        plan_end_date: job.end_date,
                        start_time: job.start_time,
                        end_time: job.end_time,
                        assigned_tech: job.tech,
                        assignees: job.assignees,
                        status: job.status
                    })
                }).catch(() => {});

                fetch(`/api/v1/jobs/${data.jobId}/tasks/import-boq`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: tasksToSave.map(t => ({
                            name: t.name,
                            start_date: t.start,
                            end_date: t.end,
                            duration_days: 1,
                            assigned_tech: t.tech || job.tech
                        }))
                    })
                }).catch(() => {});

                this.hideModal('modal-save-boq-schedule');
                this.renderJobDetail();

                if (this.state.currentView === 'gantt') {
                    this.renderGantt();
                }
                if (this.state.currentView === 'jobs') {
                    this.renderJobs();
                }
                if (this.state.currentView === 'dashboard') {
                    this.renderDashboard();
                }

                this.showToast(`🎉 บันทึก BOQ & กำหนดวันเริ่ม ${job.date} (${job.start_time} น.) ถึง ${job.end_date} (${job.end_time} น.) ช่าง: ${job.tech} เรียบร้อย!`);
            },

            openImportBOQModal(jobId) {
                const targetJobId = jobId || this.state.currentJobId;
                this.state.importBOQJobId = targetJobId;
                
                // Reset file input and preview
                const nameEl = document.getElementById('boq-file-name');
                if (nameEl) nameEl.innerText = '';
                const fileInp = document.getElementById('boq-file-input');
                if (fileInp) fileInp.value = '';
                const imgNameEl = document.getElementById('boq-image-name');
                if (imgNameEl) imgNameEl.innerText = '';
                const imgInp = document.getElementById('boq-image-input');
                if (imgInp) imgInp.value = '';

                // Reset sheet selector
                const sheetContainer = document.getElementById('boq-sheet-selector-container');
                if (sheetContainer) sheetContainer.classList.add('hidden');
                const sheetSelect = document.getElementById('boq-sheet-select');
                if (sheetSelect) sheetSelect.innerHTML = '';
                this.state.currentBOQWorkbook = null;
                this.state.availableBOQSheets = [];

                this.switchBOQImportTab('file');

                // Start with empty pending BOQ
                this.state.pendingBOQHeader = null;
                this.state.pendingBOQItems = [];
                this.renderBOQPreviewTable();
                
                this.showModal('modal-import-boq');
            },

            switchBOQImportTab(tab) {
                const tabFile = document.getElementById('boq-tab-file');
                const tabImage = document.getElementById('boq-tab-image');
                const secTemplate = document.getElementById('boq-section-template-download');
                const secFile = document.getElementById('boq-section-file-upload');
                const secImage = document.getElementById('boq-section-image-ocr');

                if (tab === 'image') {
                    if (tabFile) {
                        tabFile.className = "flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground";
                    }
                    if (tabImage) {
                        tabImage.className = "flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 bg-card text-foreground shadow-xs border border-purple-500/30";
                    }
                    if (secTemplate) secTemplate.classList.add('hidden');
                    if (secFile) secFile.classList.add('hidden');
                    if (secImage) secImage.classList.remove('hidden');
                } else {
                    if (tabFile) {
                        tabFile.className = "flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 bg-card text-foreground shadow-xs";
                    }
                    if (tabImage) {
                        tabImage.className = "flex-1 py-2 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground";
                    }
                    if (secTemplate) secTemplate.classList.remove('hidden');
                    if (secFile) secFile.classList.remove('hidden');
                    if (secImage) secImage.classList.add('hidden');
                }
            },

            handleBOQImageSelect(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;

                const nameEl = document.getElementById('boq-image-name');
                if (nameEl) nameEl.innerText = `📸 กำลังประมวลผลรูปภาพ: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

                const scanningOverlay = document.getElementById('boq-ocr-scanning');
                if (scanningOverlay) scanningOverlay.classList.remove('hidden');

                // Execute Vision OCR Ingestion Pipeline
                setTimeout(() => {
                    if (scanningOverlay) scanningOverlay.classList.add('hidden');

                    // Extracted structured quotation data from image
                    this.state.pendingBOQHeader = {
                        customer: 'นภัสวรรณ มีศิริ',
                        phone: '0922795574',
                        branch: 'พัทยาใต้',
                        date: '25/8/69',
                        address: 'หมู่บ้านพัทยารุ่งเรือง ซอยระหว่างมาบยายเลีย ตำบลหนองปรือ อำเภอบางละมุง จังหวัดชลบุรี 20150'
                    };
                    this.state.pendingBOQItems = [
                        { code: 'SKU-AC-INV18', name: 'ค่าแรงช่างติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU', qty: 1, unit: 'งาน', mat_price: 0, labor_price: 2500, price: 2500, remark: 'รวมชุดเบรกเกอร์' },
                        { code: 'MAT-PIPE-04', name: 'ชุดท่อน้ำยาแอร์ทองแดงหนาพิเศษพร้อมฉนวนหุ้ม 4 ม.', qty: 1, unit: 'ชุด', mat_price: 1800, labor_price: 0, price: 1800, remark: 'ท่อทองแดง 0.7 มม.' },
                        { code: 'MAT-DUCT-04', name: 'รางครอบท่อน้ำยาแอร์และข้อต่อมุมมาตรฐาน 4 ม.', qty: 1, unit: 'ชุด', mat_price: 950, labor_price: 0, price: 950, remark: 'สีครีมมาตรฐาน' },
                        { code: 'MAT-BRACKET', name: 'ขาแขวนคอยล์ร้อนแบบกระเช้าชุบกัลวาไนซ์กันสนิม', qty: 1, unit: 'ชุด', mat_price: 650, labor_price: 0, price: 650, remark: 'แบบหนาพิเศษ' },
                        { code: 'MAT-SW-30A', name: 'ชุดเบรกเกอร์ควบคุม Safety Switch มอก. 30A พร้อมกล่อง', qty: 1, unit: 'ชุด', mat_price: 500, labor_price: 0, price: 500, remark: 'มอก. แท้' }
                    ];

                    this.renderBOQPreviewTable();
                    if (nameEl) nameEl.innerHTML = `<span class="text-emerald-500 font-bold">✓ สแกนสำเร็จด้วย AI Vision OCR (${this.state.pendingBOQItems.length} รายการ)</span>`;
                    this.showToast('🔍 AI Vision OCR สแกนเอกสารใบเสนอราคา vFIX และสกัดข้อมูลตารางสำเร็จ!');
                }, 900);
            },

            handleBOQFileSelect(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;

                const nameEl = document.getElementById('boq-file-name');
                if (nameEl) nameEl.innerText = `📄 ไฟล์ที่เลือก: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

                const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm') || (file.type && (file.type.includes('spreadsheet') || file.type.includes('excel')));

                if (isExcel && typeof XLSX !== 'undefined') {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const wb = XLSX.read(data, { type: 'array' });
                            this.state.currentBOQWorkbook = wb;

                            // Analyze all sheets and score them
                            const sheetAnalysis = this.analyzeBOQWorkbookSheets(wb);
                            this.state.availableBOQSheets = sheetAnalysis;

                            // Setup sheet selector dropdown
                            const sheetContainer = document.getElementById('boq-sheet-selector-container');
                            const sheetSelect = document.getElementById('boq-sheet-select');
                            const sheetBadge = document.getElementById('boq-sheet-summary-badge');

                            if (sheetAnalysis.length > 0 && sheetSelect && sheetContainer) {
                                sheetContainer.classList.remove('hidden');
                                if (sheetBadge) sheetBadge.innerText = `พบทั้งหมด ${sheetAnalysis.length} Sheet`;
                                sheetSelect.innerHTML = sheetAnalysis.map(s => {
                                    const countText = s.itemCount > 0 ? `(${s.itemCount} รายการ - รวม ${s.totalAmount.toLocaleString()} ฿)` : '(ไม่มีรายการ)';
                                    const custText = s.customer ? ` [ลูกค้า: ${s.customer}]` : '';
                                    return `<option value="${s.name}" ${s.isBest ? 'selected' : ''}>${s.name} ${custText} ${countText}</option>`;
                                }).join('');
                            }

                            // Pick best sheet or first valid sheet
                            const bestSheet = sheetAnalysis.find(s => s.isBest) || sheetAnalysis.find(s => s.itemCount > 0) || sheetAnalysis[0];

                            if (bestSheet && bestSheet.itemCount > 0) {
                                const parsed = this.parseVFixExcelSheet(wb.Sheets[bestSheet.name], bestSheet.name);
                                this.state.pendingBOQHeader = parsed.header || {};
                                this.state.pendingBOQItems = parsed.items;
                                this.renderBOQPreviewTable();
                                if (nameEl) nameEl.innerHTML = `<span class="text-emerald-500 font-bold">✓ อ่านไฟล์สำเร็จ [Sheet: ${bestSheet.name}] (${parsed.items.length} รายการ)</span>`;
                                this.showToast(`📊 อ่านไฟล์ Excel "${file.name}" (Sheet: ${bestSheet.name}) สำเร็จ (${parsed.items.length} รายการ)`);
                            } else {
                                this.showToast('⚠️ ไม่พบรายการ BOQ ที่มีข้อมูลใน Sheet เริ่มต้น กรุณาเลือก Sheet อื่นจากรายการดรอปดาวน์');
                            }
                        } catch (err) {
                            console.error('Excel parse error:', err);
                            this.showToast(`⚠️ เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ${err.message}`);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target.result;
                        this.parsePastedBOQ(content);
                        this.showToast(`อ่านไฟล์ "${file.name}" สำเร็จ (${this.state.pendingBOQItems.length} รายการ)`);
                    };
                    reader.readAsText(file);
                }
            },

            handleBOQSheetChange(sheetName) {
                if (!this.state.currentBOQWorkbook || !sheetName) return;
                const ws = this.state.currentBOQWorkbook.Sheets[sheetName];
                if (!ws) return;

                const parsed = this.parseVFixExcelSheet(ws, sheetName);
                this.state.pendingBOQHeader = parsed.header || {};
                this.state.pendingBOQItems = parsed.items;
                this.renderBOQPreviewTable();

                const nameEl = document.getElementById('boq-file-name');
                if (nameEl) {
                    nameEl.innerHTML = `<span class="text-emerald-500 font-bold">✓ เปลี่ยนเป็น Sheet: ${sheetName} (${parsed.items.length} รายการ)</span>`;
                }
                this.showToast(`🔄 สลับไปใช้ข้อมูลจาก Sheet "${sheetName}" (${parsed.items.length} รายการ)`);
            },

            analyzeBOQWorkbookSheets(wb) {
                if (!wb || !wb.SheetNames) return [];
                const results = [];

                for (const sName of wb.SheetNames) {
                    const ws = wb.Sheets[sName];
                    if (!ws) continue;
                    const parsed = this.parseVFixExcelSheet(ws, sName);
                    
                    let score = 0;
                    const lower = sName.toLowerCase();
                    if (lower.includes('สำหรับกรอก') || lower.includes('template') || lower.includes('ตัวอย่าง')) score -= 100;
                    if (lower.includes('cover') || lower.includes('เงื่อนไข') || lower.includes('แผนการทำงาน') || lower.includes('note')) score -= 200;
                    if (lower.includes('พรินท์')) score -= 50;

                    if (lower.includes('โครงการ')) score += 150;
                    if (lower.includes('boq')) score += 50;
                    if (lower.includes('pt')) score += 40;

                    if (parsed.header && parsed.header.customer && !parsed.header.customer.includes('...')) {
                        score += 80;
                    }
                    if (parsed.items.length > 0) {
                        score += Math.min(100, parsed.items.length * 10);
                    }

                    const totalAmount = (parsed.items || []).reduce((acc, it) => acc + (it.qty * (it.price || 0)), 0);

                    results.push({
                        name: sName,
                        score: score,
                        itemCount: (parsed.items || []).length,
                        customer: (parsed.header && parsed.header.customer) ? parsed.header.customer : '',
                        totalAmount: totalAmount,
                        isBest: false
                    });
                }

                // Determine best sheet
                if (results.length > 0) {
                    const sorted = [...results].sort((a, b) => b.score - a.score);
                    if (sorted[0] && sorted[0].score > -100) {
                        const target = results.find(r => r.name === sorted[0].name);
                        if (target) target.isBest = true;
                    } else {
                        results[0].isBest = true;
                    }
                }

                return results;
            },

            parseVFixExcelSheet(ws, sName) {
                if (!ws) return { sheetName: sName, header: {}, items: [] };
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                if (!rows || rows.length < 3) return { sheetName: sName, header: {}, items: [] };

                let headerInfo = {};
                let items = [];
                let headerRowIdx = -1;

                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    // 1. Extract metadata from header lines
                    for (let c = 0; c < row.length; c++) {
                        const cell = String(row[c] || '').trim();
                        if (cell.includes('เรียน') && row[c + 1]) {
                            headerInfo.customer = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                        if (cell.includes('ที่อยู่') && row[c + 1]) {
                            headerInfo.address = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                        if (cell.includes('Tel') && row[c + 1]) {
                            headerInfo.phone = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                        if (cell.includes('สาขา') && row[c + 1]) {
                            headerInfo.branch = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                        if (cell.includes('วันที่') && row[c + 1]) {
                            headerInfo.date = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                        if (cell.includes('เลขที่ใบเสร็จ') && row[c + 1]) {
                            headerInfo.receipt_no = String(row[c + 1]).trim().replace(/^[:\s]+/, '');
                        }
                    }

                    // 2. Detect column headers row
                    const rowStr = row.filter(Boolean).map(c => String(c).trim()).join(' ');
                    if (rowStr.includes('ลำดับ') || rowStr.includes('รหัสสินค้า') || (rowStr.includes('Item') && rowStr.includes('Descriptions'))) {
                        headerRowIdx = r;
                        continue;
                    }

                    // 3. Parse line items
                    if (headerRowIdx >= 0 && r > headerRowIdx) {
                        if (rowStr.includes('รวมมูลค่า') || rowStr.includes('Total Amount') || rowStr.includes('ค่าดำเนินการ') || rowStr.includes('ส่วนลด') || rowStr.includes('Net Value') || rowStr.includes('หมายเหตุ :') || rowStr.includes('ผู้จัดทำ')) {
                            continue;
                        }

                        const code = row[1] ? String(row[1]).trim() : '';
                        const name = row[2] ? String(row[2]).trim() : '';
                        const qty = row[3] !== null && row[3] !== undefined && !isNaN(Number(row[3])) ? Number(row[3]) : 0;
                        const unit = row[4] ? String(row[4]).trim() : 'ชุด';
                        const matPrice = row[5] !== null && row[5] !== undefined && !isNaN(Number(row[5])) ? Number(row[5]) : 0;
                        const matAmount = row[6] !== null && row[6] !== undefined && !isNaN(Number(row[6])) ? Number(row[6]) : 0;
                        const laborPrice = row[7] !== null && row[7] !== undefined && !isNaN(Number(row[7])) ? Number(row[7]) : 0;
                        const laborAmount = row[8] !== null && row[8] !== undefined && !isNaN(Number(row[8])) ? Number(row[8]) : 0;
                        const totalAmount = row[9] !== null && row[9] !== undefined && !isNaN(Number(row[9])) ? Number(row[9]) : 0;
                        const remark = row[10] ? String(row[10]).trim() : '';

                        // Project section / note
                        if (name.startsWith('หมู่บ้าน') || name.startsWith('โครงที่')) {
                            headerInfo.project_note = (headerInfo.project_note ? headerInfo.project_note + ' ' : '') + name.replace(/\r?\n/g, ' ');
                            continue;
                        }

                        if (name && (qty > 0 || laborPrice > 0 || matPrice > 0 || totalAmount > 0)) {
                            let unitPrice = 0;
                            if (laborPrice > 0) unitPrice = laborPrice;
                            else if (matPrice > 0) unitPrice = matPrice;
                            else if (qty > 0 && totalAmount > 0) unitPrice = totalAmount / qty;

                            items.push({
                                code: code || `SKU-${items.length + 1}`,
                                name: name,
                                qty: qty || 1,
                                unit: unit || 'ชุด',
                                mat_price: matPrice,
                                labor_price: laborPrice,
                                price: unitPrice,
                                remark: remark
                            });
                        }
                    }
                }

                return {
                    sheetName: sName,
                    header: headerInfo,
                    items: items
                };
            },

            parseVFixExcelWorkbook(wb) {
                const sheets = this.analyzeBOQWorkbookSheets(wb);
                const best = sheets.find(s => s.isBest) || sheets.find(s => s.itemCount > 0) || sheets[0];
                if (!best) return null;
                return this.parseVFixExcelSheet(wb.Sheets[best.name], best.name);
            },

            parsePastedBOQ(text) {
                if (!text || !text.trim()) {
                    this.state.pendingBOQItems = [];
                    this.state.pendingBOQHeader = null;
                    this.renderBOQPreviewTable();
                    return;
                }

                const lines = text.trim().split(/\r?\n/);
                const items = [];
                let detectedHeader = {};

                lines.forEach((line, idx) => {
                    const rawLine = line.trim();
                    if (!rawLine) return;

                    // Header Detection (vFIX Quotation Metadata)
                    if (rawLine.includes('เรียน') || rawLine.includes('Customer:')) {
                        const m = rawLine.match(/เรียน\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.customer = m[1].trim().replace(/^"|"$/g, '');
                    }
                    if (rawLine.includes('ที่อยู่') || rawLine.includes('Address:')) {
                        const m = rawLine.match(/ที่อยู่\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.address = m[1].trim().replace(/^"|"$/g, '');
                    }
                    if (rawLine.includes('Tel') || rawLine.includes('เบอร์โทร')) {
                        const m = rawLine.match(/Tel\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.phone = m[1].trim().replace(/^"|"$/g, '');
                    }
                    if (rawLine.includes('สาขา') || rawLine.includes('Branch:')) {
                        const m = rawLine.match(/สาขา\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.branch = m[1].trim().replace(/^"|"$/g, '');
                    }
                    if (rawLine.includes('เลขที่งาน') || rawLine.includes('Job No')) {
                        const m = rawLine.match(/เลขที่งาน\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.job_ref = m[1].trim().replace(/^"|"$/g, '');
                    }
                    if (rawLine.includes('วันที่') || rawLine.includes('Date:')) {
                        const m = rawLine.match(/วันที่\s*[:,\t]*\s*([^,\t\r\n]+)/i);
                        if (m && m[1]) detectedHeader.date = m[1].trim().replace(/^"|"$/g, '');
                    }

                    // Skip pure header or summary lines
                    if (rawLine.includes('ลำดับ') || rawLine.includes('Descriptions') || rawLine.includes('รหัสสินค้า') || rawLine.includes('ใบเสนอราคา') || rawLine.includes('vFIX')) {
                        return;
                    }

                    // Split cells by tab, semicolon, or comma
                    let parts = line.split('\t');
                    if (parts.length === 1) parts = line.split(';');
                    if (parts.length === 1) parts = line.split(',');
                    parts = parts.map(p => p.trim().replace(/^"|"$/g, ''));

                    // Parse data row
                    if (parts.length >= 3) {
                        let itemCode = '';
                        let name = '';
                        let qty = 1;
                        let unit = 'ชุด';
                        let matPrice = 0;
                        let laborPrice = 0;
                        let price = 0;
                        let remark = '';

                        // Case A: vFIX format (7-11 columns)
                        if (parts.length >= 7) {
                            let offset = 0;
                            if (/^\d+$/.test(parts[0])) {
                                offset = 1;
                            }
                            itemCode = parts[offset] || '';
                            name = parts[offset + 1] || 'รายการวัสดุ/งานบริการ';
                            qty = parseFloat(parts[offset + 2]) || 1;
                            unit = parts[offset + 3] || 'ชุด';
                            matPrice = parseFloat(parts[offset + 4]) || 0;
                            if (parts.length >= offset + 7) {
                                laborPrice = parseFloat(parts[offset + 6]) || 0;
                                remark = parts[offset + 8] || parts[parts.length - 1] || '';
                            }
                            price = (matPrice || 0) + (laborPrice || 0);
                            if (price === 0 && parts[offset + 4]) {
                                price = parseFloat(parts[offset + 4]) || 0;
                            }
                        } else {
                            // Case B: Simple 4-5 column format (ลำดับ, รายการ, จำนวน, หน่วย, ราคา)
                            if (/^\d+$/.test(parts[0]) && isNaN(parts[1])) {
                                parts.shift();
                            }
                            name = parts[0] || 'รายการวัสดุ/งานบริการ';
                            qty = parseFloat(parts[1]) || 1;
                            unit = parts[2] || 'ชุด';
                            price = parseFloat(parts[3]) || (parseFloat(parts[1]) > 50 ? parseFloat(parts[1]) : 500);
                            
                            if (name.includes('ค่าแรง') || name.includes('ช่าง') || name.includes('ติดตั้ง')) {
                                laborPrice = price;
                            } else {
                                matPrice = price;
                            }
                        }

                        if (name && !name.includes('รวมเงิน') && !name.includes('ภาษี') && !name.includes('ยอดสุทธิ') && !name.includes('สำหรับ QC')) {
                            items.push({
                                code: itemCode,
                                name: name,
                                qty: isNaN(qty) ? 1 : qty,
                                unit: unit || 'ชุด',
                                mat_price: matPrice,
                                labor_price: laborPrice,
                                price: price,
                                remark: remark
                            });
                        }
                    }
                });

                this.state.pendingBOQItems = items;
                this.state.pendingBOQHeader = Object.keys(detectedHeader).length > 0 ? detectedHeader : null;
                this.renderBOQPreviewTable();
            },

            renderBOQPreviewTable() {
                const tbody = document.getElementById('boq-preview-tbody');
                const countEl = document.getElementById('boq-preview-count');
                const totalEl = document.getElementById('boq-preview-total');
                const matTotalEl = document.getElementById('boq-preview-mat-total');
                const laborTotalEl = document.getElementById('boq-preview-labor-total');
                const headerPreviewEl = document.getElementById('boq-vfix-header-preview');
                const headerFieldsEl = document.getElementById('boq-vfix-header-fields');
                const items = this.state.pendingBOQItems || [];
                const header = this.state.pendingBOQHeader;

                if (countEl) countEl.innerText = items.length;

                // Render Header info if detected
                if (header && Object.keys(header).length > 0 && headerPreviewEl && headerFieldsEl) {
                    headerPreviewEl.classList.remove('hidden');
                    headerFieldsEl.innerHTML = `
                        <div class="bg-card/70 p-2 rounded-lg border border-purple-500/20">
                            <span class="text-muted-foreground block text-[10px]">ลูกค้า:</span>
                            <strong class="text-foreground truncate block font-medium">${header.customer || '-'}</strong>
                        </div>
                        <div class="bg-card/70 p-2 rounded-lg border border-purple-500/20">
                            <span class="text-muted-foreground block text-[10px]">เบอร์โทร:</span>
                            <strong class="text-foreground font-mono block">${header.phone || '-'}</strong>
                        </div>
                        <div class="bg-card/70 p-2 rounded-lg border border-purple-500/20">
                            <span class="text-muted-foreground block text-[10px]">สาขา:</span>
                            <strong class="text-foreground block font-medium">${header.branch || '-'}</strong>
                        </div>
                        <div class="bg-card/70 p-2 rounded-lg border border-purple-500/20">
                            <span class="text-muted-foreground block text-[10px]">วันที่:</span>
                            <strong class="text-foreground font-mono block">${header.date || '-'}</strong>
                        </div>
                        ${header.address ? `
                        <div class="col-span-2 sm:col-span-4 bg-card/70 p-2 rounded-lg border border-purple-500/20">
                            <span class="text-muted-foreground block text-[10px]">ที่อยู่หน้างาน:</span>
                            <span class="text-muted-foreground text-[10px] truncate block">${header.address}</span>
                        </div>` : ''}
                    `;
                } else if (headerPreviewEl) {
                    headerPreviewEl.classList.add('hidden');
                }

                if (items.length === 0) {
                    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-muted-foreground text-xs">ยังไม่มีข้อมูลตัวอย่าง กรุณาเลือกไฟล์หรือชุด Template</td></tr>`;
                    if (totalEl) totalEl.innerText = 'ยอดรวม: 0.00 ฿';
                    if (matTotalEl) matTotalEl.innerText = 'ค่าวัสดุ: 0.00 ฿';
                    if (laborTotalEl) laborTotalEl.innerText = 'ค่าแรง: 0.00 ฿';
                    return;
                }

                let subtotal = 0;
                let matSubtotal = 0;
                let laborSubtotal = 0;

                const rowsHtml = items.map((item, idx) => {
                    const lineMat = (item.qty || 0) * (item.mat_price || 0);
                    const lineLabor = (item.qty || 0) * (item.labor_price || 0);
                    const rowTotal = (item.qty || 0) * (item.price || 0);
                    subtotal += rowTotal;
                    matSubtotal += lineMat;
                    laborSubtotal += lineLabor;

                    return `
                    <tr class="hover:bg-muted/30">
                        <td class="py-2 px-2.5 text-center text-muted-foreground font-mono">${idx + 1}</td>
                        <td class="py-2 px-2.5 font-mono text-[10px] text-muted-foreground">${item.code || '-'}</td>
                        <td class="py-2 px-2.5 font-medium text-foreground truncate max-w-[180px]" title="${item.name}">${item.name}</td>
                        <td class="py-2 px-2.5 text-center font-mono">${item.qty}</td>
                        <td class="py-2 px-2.5 text-center text-muted-foreground">${item.unit || 'ชุด'}</td>
                        <td class="py-2 px-2.5 text-right font-mono text-muted-foreground">${(item.mat_price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td class="py-2 px-2.5 text-right font-mono text-muted-foreground">${(item.labor_price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td class="py-2 px-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">${rowTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</td>
                    </tr>
                    `;
                }).join('');

                if (tbody) tbody.innerHTML = rowsHtml;
                if (totalEl) totalEl.innerText = `ยอดรวม: ${subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                if (matTotalEl) matTotalEl.innerText = `ค่าวัสดุ: ${matSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                if (laborTotalEl) laborTotalEl.innerText = `ค่าแรง: ${laborSubtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
            },

            confirmImportBOQ() {
                const targetJobId = this.state.importBOQJobId || this.state.currentJobId;
                const job = DB.jobs.find(j => j.id === targetJobId);
                if (!job) {
                    this.showToast('⚠️ ไม่พบข้อมูล Job ที่ต้องการนำเข้า');
                    return;
                }

                const newItems = this.state.pendingBOQItems || [];
                if (newItems.length === 0) {
                    this.showToast('⚠️ กรุณาเลือกไฟล์หรือชุด Template ก่อนยืนยัน');
                    return;
                }

                const modeEl = document.querySelector('input[name="boq-import-mode"]:checked');
                const mode = modeEl ? modeEl.value : 'replace';

                if (mode === 'replace') {
                    job.boq_items = JSON.parse(JSON.stringify(newItems));
                } else {
                    job.boq_items = [...(job.boq_items || []), ...JSON.parse(JSON.stringify(newItems))];
                }

                // Sync header information if available and checked
                const syncHeaderCheckbox = document.getElementById('boq-sync-customer-info');
                const shouldSyncHeader = syncHeaderCheckbox ? syncHeaderCheckbox.checked : true;
                const header = this.state.pendingBOQHeader;

                if (shouldSyncHeader && header) {
                    if (header.customer) {
                        job.customer = header.customer;
                        const nameParts = header.customer.split(' ');
                        job.firstName = nameParts[0] || header.customer;
                        job.lastName = nameParts.slice(1).join(' ') || '';
                    }
                    if (header.phone) job.phone = header.phone;
                    if (header.address) job.address = header.address;
                    if (header.branch) job.branch = header.branch;
                    if (header.date) job.date = header.date;
                }

                this.recordStepTimestamp(targetJobId, 'step4_boq_at', new Date().toISOString(), `นำเข้า BOQ ${newItems.length} รายการ`);
                this.persistJobs();
                this.hideModal('modal-import-boq');
                this.state.selectedGanttJobId = targetJobId;
                const selGantt = document.getElementById('gantt-filter-job');
                if (selGantt) selGantt.value = targetJobId;

                this.renderJobDetail();
                if (this.state.currentView === 'gantt') this.renderGantt();
                if (this.state.currentView === 'jobs') this.renderJobs();
                if (this.state.currentView === 'dashboard') this.renderDashboard();

                this.showToast(`✅ นำเข้า BOQ ${newItems.length} รายการ เรียบร้อย! กำลังเปิดหน้าต่างกำหนดวันเวลาและช่างเพื่อแปลงเป็น Gantt Chart...`);

                // Seamlessly trigger: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart
                setTimeout(() => {
                    this.openConvertBOQToTasksModal(targetJobId);
                }, 300);
            },

            downloadVFixBOQTemplate() {
                const csvHeader = "\uFEFF" +
                    "vFIX,ใบเสนอราคางาน,เลขที่งาน :,JOB202609001,,,\n" +
                    "เรียน :,นภัสวรรณ มีศิริ,,เลขที่ใบเสร็จ :,\n" +
                    "ที่อยู่ :,หมู่บ้านพัทยารุ่งเรือง ซอยระหว่างมาบยายเลีย ตำบลหนองปรือ อำเภอบางละมุง จังหวัดชลบุรี 20150,,สาขา :,พัทยาใต้\n" +
                    "Tel :,0922795574,,วันที่ :,25/8/69\n" +
                    "EMail/ Line ID :,,,,,\n" +
                    ",,,,,,สำหรับ QC กรอก\n" +
                    "ลำดับที่,รหัสสินค้า,รายการ,จำนวน,หน่วย,ค่าวัสดุ_ราคาต่อหน่วย,ค่าวัสดุ_จำนวนเงิน,ค่าแรง_ราคาต่อหน่วย,ค่าแรง_จำนวนเงิน,จำนวนเงินรวม,หมายเหตุ\n" +
                    "1,SKU-AC-INV18,ค่าแรงช่างติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU,1,งาน,0,0,2500,2500,2500,รวมชุดเบรกเกอร์\n" +
                    "2,MAT-PIPE-04,ชุดท่อน้ำยาแอร์ทองแดงหนาพิเศษพร้อมฉนวนหุ้ม 4 ม.,1,ชุด,1800,1800,0,0,1800,ท่อทองแดง 0.7 มม.\n" +
                    "3,MAT-DUCT-04,รางครอบท่อน้ำยาแอร์และข้อต่อมุมมาตรฐาน 4 ม.,1,ชุด,950,950,0,0,950,สีครีมมาตรฐาน\n" +
                    "4,MAT-BRACKET,ขาแขวนคอยล์ร้อนแบบกระเช้าชุบกัลวาไนซ์กันสนิม,1,ชุด,650,650,0,0,650,แบบหนาพิเศษ\n" +
                    "5,MAT-SW-30A,ชุดเบรกเกอร์ควบคุม Safety Switch มอก. 30A พร้อมกล่อง,1,ชุด,500,500,0,0,500,มอก. แท้\n";

                const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `vFIX_Quotation_BOQ_Template_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('📥 ดาวน์โหลด Template ใบเสนอราคา vFIX (.csv) เรียบร้อย');
            },

            downloadBOQTemplate() {
                const csvHeader = "\uFEFF" + "ลำดับ,รายการวัสดุ / งานบริการ,จำนวน,หน่วย,ราคาต่อหน่วย (฿)\n" +
                    "1,ค่าแรงช่างติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU,1,งาน,2500\n" +
                    "2,ชุดท่อน้ำยาแอร์ทองแดงหนาพิเศษพร้อมฉนวนหุ้ม 4 ม.,1,ชุด,1800\n" +
                    "3,รางครอบท่อน้ำยาแอร์และข้อต่อมุมมาตรฐาน 4 ม.,1,ชุด,950\n" +
                    "4,ขาแขวนคอยล์ร้อนแบบกระเช้าชุบกัลวาไนซ์กันสนิม,1,ชุด,650\n" +
                    "5,ชุดเบรกเกอร์ควบคุม Safety Switch มอก. 30A พร้อมกล่อง,1,ชุด,500\n";
                
                const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `PMT_BOQ_Template_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('📥 ดาวน์โหลด Template BOQ (.csv) เรียบร้อย');
            },

            downloadTaskBOQTemplate() {
                const csvContent = "\uFEFF" + "ลำดับ,ชื่อ Task ตาม BOQ,วันเริ่มต้น (Start Date YYYY-MM-DD),วันสิ้นสุด (End Date YYYY-MM-DD),จำนวนวัน,ผู้รับผิดชอบ\n" +
                    "1,งานสำรวจและเตรียมพื้นที่หน้างาน,2026-09-01,2026-09-02,2,Team A (สมศักดิ์)\n" +
                    "2,งานรื้อถอนและปรับระดับพื้นเดิม,2026-09-03,2026-09-04,2,Team A (สมศักดิ์)\n" +
                    "3,งานเดินท่อประปาและระบบไฟฟ้าฝังผนัง,2026-09-05,2026-09-07,3,กิตติพงษ์ (ช่างไฟฟ้า)\n" +
                    "4,งานติดตั้งเคาน์เตอร์ครัวและท็อปหิน,2026-09-08,2026-09-10,3,Team A (สมศักดิ์)\n" +
                    "5,งานติดตั้งอุปกรณ์เตาอบและฮูดดูดควัน,2026-09-11,2026-09-12,2,ธนกฤต (ช่างแอร์)\n";
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `PMT_Project_Tasks_Template_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('📥 ดาวน์โหลด Template Tasks สำหรับนำเข้าแผนงานเรียบร้อย');
            },

            handleBOQFileForTasks(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;

                const job = DB.jobs.find(j => j.id === this.state.convertJobId);
                const baseDate = job ? (job.date || '2026-09-05') : new Date().toISOString().slice(0, 10);
                const defaultTech = job ? (job.tech || 'Team A (สมศักดิ์)') : 'Team A (สมศักดิ์)';

                const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm') || (file.type && (file.type.includes('spreadsheet') || file.type.includes('excel')));

                if (isExcel && typeof XLSX !== 'undefined') {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const wb = XLSX.read(data, { type: 'array' });
                            const parsed = this.parseVFixExcelWorkbook(wb);
                            if (parsed && parsed.items && parsed.items.length > 0) {
                                const isLaborItem = (item) => {
                                    if (item.labor_price && Number(item.labor_price) > 0) return true;
                                    if (item.mat_price && Number(item.mat_price) > 0 && (!item.labor_price || Number(item.labor_price) === 0)) {
                                        const strongLabor = ['ค่าแรง', 'งานติดตั้ง', 'บริการ', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียมหน้างาน', 'ทดสอบระบบ', 'ล้าง', 'ซ่อม', 'ทาสี', 'ฉาบ'];
                                        return strongLabor.some(kw => (item.name || '').includes(kw));
                                    }
                                    const name = item.name || '';
                                    const laborKeywords = ['ค่าแรง', 'งาน', 'บริการ', 'ช่าง', 'ติดตั้ง', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียม', 'ประกอบ', 'ทดสอบ', 'ซ่อม', 'ล้าง', 'ทาสี', 'ฉาบ'];
                                    const materialKeywords = ['ชุดท่อ', 'รางครอบ', 'ขาแขวน', 'เบรกเกอร์', 'ถังเก็บน้ำ', 'ปั๊มน้ำ', 'สายไฟ', 'วาล์ว', 'ฐานรอง', 'อุปกรณ์', 'อะไหล่', 'ทองแดง', 'สีขาว', 'แปรง'];
                                    const hasLabor = laborKeywords.some(kw => name.includes(kw));
                                    const hasMaterial = materialKeywords.some(kw => name.includes(kw));
                                    if (hasLabor && !hasMaterial) return true;
                                    if (name.startsWith('ค่าแรง') || name.startsWith('งาน') || name.startsWith('บริการ')) return true;
                                    return hasLabor;
                                };

                                const laborItems = parsed.items.filter(isLaborItem);
                                const targetItems = laborItems.length > 0 ? laborItems : parsed.items;

                                this.state.convertTasks = targetItems.map((item, idx) => {
                                    const d = new Date(baseDate);
                                    d.setDate(d.getDate() + idx);
                                    const dateStr = d.toISOString().slice(0, 10);
                                    let cleanTaskName = item.name.replace(/^ค่าแรงช่าง/, 'งาน').replace(/^ค่าแรง/, 'งาน');
                                    return {
                                        selected: true,
                                        name: cleanTaskName,
                                        originalBoqName: item.name,
                                        start: dateStr,
                                        end: dateStr,
                                        days: 1,
                                        tech: defaultTech,
                                        assignees: [defaultTech]
                                    };
                                });

                                const ratioEl = document.getElementById('convert-labor-ratio');
                                if (ratioEl) ratioEl.innerText = `${targetItems.length} จาก ${parsed.items.length} รายการ (Sheet: ${parsed.sheetName})`;
                                this.sortConvertTasksByStartDate(false);
                                this.showToast(`📥 แปลงรายการค่าแรงจาก Excel "${file.name}" เป็น ${targetItems.length} Tasks สำเร็จ`);
                            } else {
                                this.showToast('⚠️ ไม่พบข้อมูลตารางในไฟล์ Excel');
                            }
                        } catch (err) {
                            console.error('Excel task convert error:', err);
                            this.showToast(`⚠️ เกิดข้อผิดพลาดในการแปลงไฟล์: ${err.message}`);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target.result;
                        const lines = (content || '').trim().split(/\r?\n/);
                        const parsedTasks = [];

                        lines.forEach((line, idx) => {
                            const rawLine = line.trim();
                            if (!rawLine) return;
                            if (rawLine.includes('ลำดับ') || rawLine.includes('Descriptions') || rawLine.includes('รหัสสินค้า') || rawLine.includes('ใบเสนอราคา') || rawLine.includes('vFIX')) return;

                            let parts = rawLine.split('\t');
                            if (parts.length === 1) parts = line.split(';');
                            if (parts.length === 1) parts = line.split(',');
                            parts = parts.map(p => p.trim().replace(/^"|"$/g, ''));

                            let taskName = '';
                            let isLabor = false;
                            let startDate = '';
                            let endDate = '';
                            let days = 1;
                            let tech = defaultTech;

                            // Case A: vFIX / BOQ format (Item, Code, Desc, Qty, Unit, Mat, Lab...)
                            if (parts.length >= 6) {
                                let offset = /^\d+$/.test(parts[0]) ? 1 : 0;
                                taskName = parts[offset + 1] || parts[offset] || '';
                                const laborPrice = parseFloat(parts[offset + 6]) || parseFloat(parts[offset + 7]) || 0;
                                const matPrice = parseFloat(parts[offset + 4]) || 0;
                                
                                if (laborPrice > 0) isLabor = true;
                                else if (matPrice === 0 && (taskName.includes('ค่าแรง') || taskName.includes('งาน') || taskName.includes('ช่าง') || taskName.includes('ติดตั้ง') || taskName.includes('สำรวจ'))) {
                                    isLabor = true;
                                } else if (taskName.includes('ค่าแรง') || taskName.startsWith('งาน')) {
                                    isLabor = true;
                                }
                            } else {
                                // Case B: Task format (No, Task Name, Start Date, End Date, Days, Tech)
                                if (/^\d+$/.test(parts[0]) && isNaN(parts[1])) {
                                    parts.shift();
                                }
                                taskName = parts[0] || `งานติดตั้ง ${parsedTasks.length + 1}`;
                                startDate = parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) ? parts[1] : '';
                                endDate = parts[2] && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) ? parts[2] : '';
                                days = parseInt(parts[3]) || 1;
                                tech = parts[4] || defaultTech;
                                isLabor = true;
                            }

                            // Filter: ONLY Labor items are converted into tasks
                            if (isLabor && taskName && !taskName.includes('รวมเงิน') && !taskName.includes('ภาษี') && !taskName.includes('สำหรับ QC')) {
                                if (!startDate) {
                                    const d = new Date(baseDate);
                                    d.setDate(d.getDate() + parsedTasks.length);
                                    startDate = d.toISOString().slice(0, 10);
                                }
                                if (!endDate) {
                                    const s = new Date(startDate);
                                    s.setDate(s.getDate() + (days - 1));
                                    endDate = s.toISOString().slice(0, 10);
                                } else {
                                    const s = new Date(startDate);
                                    const en = new Date(endDate);
                                    days = Math.max(1, Math.round((en - s) / (1000 * 60 * 60 * 24)) + 1);
                                }

                                parsedTasks.push({
                                    selected: true,
                                    name: taskName,
                                    start: startDate,
                                    end: endDate,
                                    days: isNaN(days) ? 1 : days,
                                    tech: tech,
                                    assignees: [tech]
                                });
                            }
                        });

                        if (parsedTasks.length > 0) {
                            this.state.convertTasks = parsedTasks;
                            const ratioEl = document.getElementById('convert-labor-ratio');
                            if (ratioEl) ratioEl.innerText = `${parsedTasks.length} รายการค่าแรงที่ดึงเข้าเป็น Tasks`;
                            this.sortConvertTasksByStartDate(false);
                            this.showToast(`📥 นำเข้าเฉพาะรายการค่าแรง ${parsedTasks.length} รายการเป็น Project Tasks สำเร็จ`);
                        } else {
                            this.showToast('⚠️ ไม่พบรายการค่าแรงในไฟล์ที่อัปโหลด');
                        }
                    };
                    reader.readAsText(file);
                }
            },

            openConvertBOQToTasksModal(jobId) {
                const targetJobId = jobId || this.state.currentJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = DB.jobs.find(j => j.id === targetJobId);
                if (!job) {
                    this.showToast('⚠️ ไม่พบข้อมูล Job');
                    return;
                }

                // Rule Enforcement: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart
                const boqItems = job.boq_items || [];
                if (boqItems.length === 0) {
                    const jobName = `${job.id} (${job.customer || 'ลูกค้า'})`;
                    const proceed = confirm(`⚠️ ไม่สามารถสร้างแผนงาน (Task) ได้ในขณะนี้\n\nโครงการ: ${jobName}\n\n📌 กฎเกณฑ์ระบบ:\n"แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart นะครับ"\n\nโครงการนี้ยังไม่มีข้อมูล BOQ\nคุณต้องการเปิดหน้าต่าง "นำเข้าไฟล์ BOQ (Import)" เพื่อเริ่มต้นนำเข้า BOQ เดี๋ยวนี้เลยหรือไม่?`);
                    if (proceed) {
                        this.openImportBOQModal(targetJobId);
                    } else {
                        this.showToast('⚠️ กรุณานำเข้า BOQ ก่อน จึงจะสามารถสร้าง Task ใน Gantt Chart ได้');
                    }
                    return;
                }

                this.state.convertJobId = targetJobId;
                document.getElementById('convert-job-id').innerText = job.id;
                document.getElementById('convert-job-customer').innerText = `ลูกค้า: ${job.customer}`;
                document.getElementById('convert-job-service').innerText = `บริการ: ${job.service}`;

                this.resetConvertTasksFromBOQ();
                this.showModal('modal-convert-boq-tasks');
            },

            resetConvertTasksFromBOQ() {
                const job = DB.jobs.find(j => j.id === this.state.convertJobId);
                if (!job) return;

                const boqItems = job.boq_items || [];
                const baseDate = job.date || '2026-09-05';
                const defaultTech = job.tech || 'Team A (สมศักดิ์)';

                // Helper to identify labor items (ค่าแรง / งานบริการ)
                const isLaborItem = (item) => {
                    // Check explicit labor cost
                    if (item.labor_price && Number(item.labor_price) > 0) return true;
                    if (item.mat_price && Number(item.mat_price) > 0 && (!item.labor_price || Number(item.labor_price) === 0)) {
                        const strongLabor = ['ค่าแรง', 'งานติดตั้ง', 'บริการ', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียมหน้างาน', 'ทดสอบระบบ', 'ล้าง', 'ซ่อม'];
                        return strongLabor.some(kw => (item.name || '').includes(kw));
                    }
                    const name = item.name || '';
                    const laborKeywords = ['ค่าแรง', 'งาน', 'บริการ', 'ช่าง', 'ติดตั้ง', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียม', 'ประกอบ', 'ทดสอบ', 'ซ่อม', 'ล้าง'];
                    const materialKeywords = ['ชุดท่อ', 'รางครอบ', 'ขาแขวน', 'เบรกเกอร์', 'ถังเก็บน้ำ', 'ปั๊มน้ำ', 'สายไฟ', 'วาล์ว', 'ฐานรอง', 'อุปกรณ์', 'อะไหล่', 'ทองแดง'];
                    const hasLabor = laborKeywords.some(kw => name.includes(kw));
                    const hasMaterial = materialKeywords.some(kw => name.includes(kw));
                    if (hasLabor && !hasMaterial) return true;
                    if (name.startsWith('ค่าแรง') || name.startsWith('งาน') || name.startsWith('บริการ')) return true;
                    return hasLabor;
                };

                // Filter only labor items
                const laborItems = boqItems.filter(isLaborItem);

                // Update ratio badge in modal
                const ratioEl = document.getElementById('convert-labor-ratio');
                if (ratioEl) {
                    ratioEl.innerText = `${laborItems.length} จาก ${boqItems.length} รายการ BOQ (คัดเฉพาะค่าแรง)`;
                }

                if (laborItems.length === 0) {
                    if (boqItems.length > 0) {
                        this.state.convertTasks = [
                            { selected: true, name: `งานติดตั้งและบริการ ${job.service}`, start: baseDate, end: baseDate, days: 1, tech: defaultTech, assignees: [defaultTech] }
                        ];
                    } else {
                        this.state.convertTasks = [];
                    }
                } else {
                    this.state.convertTasks = laborItems.map((item, idx) => {
                        const d = new Date(baseDate);
                        d.setDate(d.getDate() + idx);
                        const dateStr = d.toISOString().slice(0, 10);
                        
                        let cleanTaskName = item.name;
                        if (cleanTaskName.startsWith('ค่าแรงช่าง')) {
                            cleanTaskName = cleanTaskName.replace(/^ค่าแรงช่าง/, 'งาน');
                        } else if (cleanTaskName.startsWith('ค่าแรง')) {
                            cleanTaskName = cleanTaskName.replace(/^ค่าแรง/, 'งาน');
                        }

                        return {
                            selected: true,
                            name: cleanTaskName,
                            originalBoqName: item.name,
                            start: dateStr,
                            end: dateStr,
                            days: 1,
                            tech: defaultTech,
                            assignees: [defaultTech]
                        };
                    });
                }

                this.sortConvertTasksByStartDate(false);
            },

            insertConvertTaskAt(idx) {
                const job = DB.jobs.find(j => j.id === this.state.convertJobId);
                const defaultTech = job ? job.tech || 'Team A (สมศักดิ์)' : 'Team A (สมศักดิ์)';
                const baseDate = job ? job.date || '2026-09-05' : '2026-09-05';

                if (!this.state.convertTasks) this.state.convertTasks = [];

                let newStartDate = baseDate;
                if (idx >= 0 && this.state.convertTasks[idx]) {
                    const prevTask = this.state.convertTasks[idx];
                    if (prevTask.end) {
                        const d = new Date(prevTask.end);
                        d.setDate(d.getDate() + 1);
                        newStartDate = d.toISOString().slice(0, 10);
                    } else if (prevTask.start) {
                        newStartDate = prevTask.start;
                    }
                } else if (this.state.convertTasks.length > 0) {
                    const lastTask = this.state.convertTasks[this.state.convertTasks.length - 1];
                    if (lastTask && lastTask.end) {
                        const d = new Date(lastTask.end);
                        d.setDate(d.getDate() + 1);
                        newStartDate = d.toISOString().slice(0, 10);
                    }
                }

                const newTask = {
                    selected: true,
                    name: 'งานแทรกติดตั้ง/ตรวจสอบเพิ่มเติม',
                    start: newStartDate,
                    end: newStartDate,
                    days: 1,
                    tech: defaultTech,
                    assignees: [defaultTech]
                };

                if (idx >= 0 && idx < this.state.convertTasks.length) {
                    this.state.convertTasks.splice(idx + 1, 0, newTask);
                } else {
                    this.state.convertTasks.push(newTask);
                }

                // Automatically sort tasks by start date after insertion
                this.sortConvertTasksByStartDate(false);
                this.showToast('➕ แทรกงานใหม่เรียบร้อย (จัดเรียงตามวันเริ่มต้นอัตโนมัติ)');
            },

            addCustomConvertTaskRow() {
                this.insertConvertTaskAt(-1);
            },

            removeConvertTaskRow(idx) {
                if (!this.state.convertTasks) return;
                this.state.convertTasks.splice(idx, 1);
                this.renderConvertTasksRows();
            },

            sortConvertTasksByStartDate(showToast = false) {
                if (!this.state.convertTasks) return;
                this.state.convertTasks.sort((a, b) => {
                    const da = new Date(a.start || '9999-12-31').getTime();
                    const db = new Date(b.start || '9999-12-31').getTime();
                    if (da !== db) return da - db;
                    const ea = new Date(a.end || '9999-12-31').getTime();
                    const eb = new Date(b.end || '9999-12-31').getTime();
                    if (ea !== eb) return ea - eb;
                    return (a.name || '').localeCompare(b.name || '');
                });
                this.renderConvertTasksRows();
                if (showToast) {
                    this.showToast('🔄 จัดเรียงรายการ Task ตามวันเริ่มต้น (Start Date) เรียบร้อย');
                }
            },

            updateConvertTaskField(idx, field, value) {
                if (!this.state.convertTasks || !this.state.convertTasks[idx]) return;
                const task = this.state.convertTasks[idx];

                if (field === 'selected') {
                    task.selected = !!value;
                } else if (field === 'name') {
                    task.name = value;
                } else if (field === 'start') {
                    task.start = value;
                    if (task.start) {
                        if (!task.end || new Date(task.end) < new Date(task.start)) {
                            // Automatically adjust end date to match duration
                            const s = new Date(task.start);
                            s.setDate(s.getDate() + ((task.days || 1) - 1));
                            task.end = s.toISOString().slice(0, 10);
                        } else {
                            const s = new Date(task.start);
                            const e = new Date(task.end);
                            const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                            task.days = isNaN(diffDays) ? 1 : diffDays;
                        }
                    }
                    // Auto-sort by start date when start date is modified
                    this.sortConvertTasksByStartDate(false);
                    return;
                } else if (field === 'end') {
                    task.end = value;
                    if (task.start && task.end) {
                        if (new Date(task.end) < new Date(task.start)) {
                            task.start = task.end;
                            task.days = 1;
                        } else {
                            const s = new Date(task.start);
                            const e = new Date(task.end);
                            const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                            task.days = isNaN(diffDays) ? 1 : diffDays;
                        }
                    }
                    const daysEl = document.getElementById(`convert-days-${idx}`);
                    if (daysEl) daysEl.innerText = `${task.days} วัน`;
                } else if (field === 'days') {
                    task.days = parseInt(value) || 1;
                    if (task.start) {
                        const s = new Date(task.start);
                        s.setDate(s.getDate() + task.days - 1);
                        task.end = s.toISOString().slice(0, 10);
                        const endInp = document.getElementById(`convert-end-${idx}`);
                        if (endInp) endInp.value = task.end;
                    }
                }

                const countEl = document.getElementById('convert-task-count');
                if (countEl) countEl.innerText = this.state.convertTasks.filter(t => t.selected).length;
            },

            toggleTaskAssignee(taskIdx, techName) {
                if (!this.state.convertTasks || !this.state.convertTasks[taskIdx]) return;
                const task = this.state.convertTasks[taskIdx];
                if (!task.assignees) task.assignees = [task.tech || 'Team A (สมศักดิ์)'];

                const existsIdx = task.assignees.indexOf(techName);
                if (existsIdx >= 0) {
                    if (task.assignees.length > 1) {
                        task.assignees.splice(existsIdx, 1);
                    }
                } else {
                    task.assignees.push(techName);
                }
                task.tech = task.assignees.join(' + ');
                this.renderConvertTasksRows();
            },

            renderConvertTasksRows() {
                const tbody = document.getElementById('convert-tasks-tbody');
                const countEl = document.getElementById('convert-task-count');
                const tasks = this.state.convertTasks || [];

                const availableTechs = [
                    'Team A (สมศักดิ์)',
                    'Team B (ประเสริฐ)',
                    'Team C (วิชัย)',
                    'อนุชา (ผู้ช่วยช่าง)',
                    'ธนกฤต (ช่างแอร์)',
                    'กิตติพงษ์ (ช่างไฟฟ้า)'
                ];

                if (countEl) countEl.innerText = tasks.filter(t => t.selected).length;

                if (tasks.length === 0) {
                    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-muted-foreground text-xs">ไม่มีรายการ Task กรุณากดปุ่ม "รีเซ็ตจาก BOQ" หรือ "+ แทรกงานใหม่" หรือ "นำเข้าไฟล์ BOQ"</td></tr>`;
                    return;
                }

                const rowsHtml = tasks.map((t, idx) => {
                    const assignees = t.assignees || [t.tech || 'Team A (สมศักดิ์)'];
                    const techChips = availableTechs.map(tech => {
                        const isSelected = assignees.includes(tech);
                        const shortName = tech.split(' ')[0] + (tech.includes('(') ? ' ' + tech.slice(tech.indexOf('(')) : '');
                        return `
                        <button type="button" onclick="app.toggleTaskAssignee(${idx}, '${tech}')" class="px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${isSelected ? 'bg-purple-500 text-white font-semibold shadow-xs' : 'bg-muted/70 hover:bg-muted text-muted-foreground border border-border'}">
                            ${isSelected ? '✓ ' : '+ '}${shortName}
                        </button>
                        `;
                    }).join('');

                    return `
                    <tr class="hover:bg-muted/30 transition">
                        <td class="py-2.5 px-3 text-center">
                            <input type="checkbox" ${t.selected ? 'checked' : ''} onchange="app.updateConvertTaskField(${idx}, 'selected', this.checked)" class="accent-purple-600 rounded cursor-pointer">
                        </td>
                        <td class="py-2.5 px-2 text-center text-muted-foreground font-mono text-[11px] font-semibold">
                            ${idx + 1}
                        </td>
                        <td class="py-2.5 px-3">
                            <input type="text" value="${t.name}" oninput="app.updateConvertTaskField(${idx}, 'name', this.value)" placeholder="ระบุชื่องาน / บริการ" class="w-full bg-muted/30 hover:bg-muted/60 focus:bg-card border border-border focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-foreground font-medium transition focus:outline-none">
                        </td>
                        <td class="py-2.5 px-3">
                            <input type="date" value="${t.start}" onchange="app.updateConvertTaskField(${idx}, 'start', this.value)" class="w-full bg-muted/30 border border-border focus:border-purple-500 rounded-lg px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none cursor-pointer">
                        </td>
                        <td class="py-2.5 px-3">
                            <input type="date" id="convert-end-${idx}" value="${t.end}" onchange="app.updateConvertTaskField(${idx}, 'end', this.value)" class="w-full bg-muted/30 border border-border focus:border-purple-500 rounded-lg px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none cursor-pointer">
                        </td>
                        <td class="py-2.5 px-3 text-center" id="convert-days-${idx}">
                            <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                ${t.days || 1} วัน
                            </span>
                        </td>
                        <td class="py-2.5 px-3">
                            <div class="flex flex-wrap gap-1 max-w-[260px]">
                                ${techChips}
                            </div>
                            <div class="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1 truncate">
                                👥 ผู้รับผิดชอบ: ${assignees.join(', ')}
                            </div>
                        </td>
                        <td class="py-2.5 px-2 text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button type="button" onclick="app.insertConvertTaskAt(${idx})" class="px-2 py-1 text-[11px] text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-md transition cursor-pointer flex items-center gap-0.5" title="แทรกงานด้านล่างแถวนี้">
                                    <i class="ph ph-plus-circle text-xs"></i> แทรก
                                </button>
                                <button type="button" onclick="app.removeConvertTaskRow(${idx})" class="p-1 text-muted-foreground hover:text-rose-500 rounded transition cursor-pointer" title="ลบ Task นี้">
                                    <i class="ph ph-trash text-sm"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');

                if (tbody) tbody.innerHTML = rowsHtml;
            },

            confirmConvertBOQToTasks() {
                const targetJobId = this.state.convertJobId || this.state.currentJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = DB.jobs.find(j => j.id === targetJobId);
                if (!job) {
                    this.showToast('⚠️ ไม่พบข้อมูล Job');
                    return;
                }

                const selectedTasks = (this.state.convertTasks || []).filter(t => t.selected);
                if (selectedTasks.length === 0) {
                    this.showToast('⚠️ กรุณาเลือกอย่างน้อย 1 Task เพื่อแปลงเป็นแผนงาน');
                    return;
                }

                // Ensure sorted by start date before saving
                selectedTasks.sort((a, b) => {
                    const da = new Date(a.start || '9999-12-31').getTime();
                    const db = new Date(b.start || '9999-12-31').getTime();
                    if (da !== db) return da - db;
                    return (a.name || '').localeCompare(b.name || '');
                });

                // Remove existing tasks for this job from DB.tasks
                if (!DB.tasks) DB.tasks = [];
                DB.tasks = DB.tasks.filter(t => t.jobId !== targetJobId);

                // Add newly converted tasks
                selectedTasks.forEach((st, i) => {
                    DB.tasks.push({
                        id: `T_${targetJobId}_${i + 1}`,
                        jobId: targetJobId,
                        name: st.name,
                        tech: st.tech || (st.assignees ? st.assignees.join(' + ') : 'Team A'),
                        start: st.start || '2026-09-05',
                        end: st.end || st.start || '2026-09-05',
                        days: st.days || 1,
                        status: 'IN_PROGRESS'
                    });
                });

                // Sync with backend API in background
                fetch(`/api/v1/jobs/${targetJobId}/tasks/import-boq`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: selectedTasks.map(t => ({
                            name: t.name,
                            start_date: t.start,
                            end_date: t.end,
                            duration_days: t.days,
                            assigned_tech: t.tech,
                            assignees: t.assignees
                        }))
                    })
                }).catch(err => console.log('Backend sync task notice:', err.message));

                this.recordStepTimestamp(targetJobId, 'step5_project_at', new Date().toISOString(), `แปลง BOQ เป็นแผนงาน Task ${selectedTasks.length} รายการ`);
                this.persistJobs();
                this.syncQCBookingsFromTasks();
                this.hideModal('modal-convert-boq-tasks');
                this.state.selectedGanttJobId = targetJobId;
                const sel = document.getElementById('gantt-filter-job');
                if (sel) sel.value = targetJobId;
                this.showToast(`⚡ แปลง BOQ เป็น Task ปฏิบัติงาน ${selectedTasks.length} รายการ และสร้างคิวจองช่าง QC ล่วงหน้า 5 วันเรียบร้อย`);

                this.navigate('gantt');
            },

            openJobDetailBOQ(jobId) {
                if (!jobId) return;
                this.state.jobTab = 'boq';
                this.navigate('job-detail', jobId);
                const job = DB.jobs.find(j => j.id === jobId);
                const jobName = job ? `${job.id} (${job.customer})` : jobId;
                this.showToast(`📋 เปิด Project Detail หน้าบันทึก BOQ ของ ${jobName}`);
            },

            getDefaultMockTickets() {
                return [
                    {
                        id: "TKT-202609-001",
                        ticket_no: "209051119",
                        receipt_no: "RC-VFIX-260901-001",
                        job_id: "JOB202609001",
                        customer_name: "คุณ นภัสวรรณ มีศิริ",
                        service: "ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU",
                        amount: 32500,
                        payment_date: "2026-09-04",
                        payment_method: "โอนเงินผ่านธนาคาร (Bank Transfer)",
                        slip_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
                        slip_name: "slip_transfer_kbank.jpg",
                        status: "VERIFIED",
                        notes: "ชำระเงินมัดจำงวดแรกผ่าน QR โอนเงิน ธนาคารกสิกรไทย สาขาพัทยา"
                    },
                    {
                        id: "TKT-202609-002",
                        ticket_no: "209051120",
                        receipt_no: "RC-VFIX-260901-002",
                        job_id: "JOB202609002",
                        customer_name: "คุณสมศรี สุขใจ",
                        service: "Renovate ห้องครัว Built-in & งานระบบประปา",
                        amount: 48900,
                        payment_date: "2026-09-04",
                        payment_method: "บัตรเครดิต (Credit Card)",
                        slip_url: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80",
                        slip_name: "slip_credit_card.jpg",
                        status: "VERIFIED",
                        notes: "รูดบัตรเครดิต KBank ผ่อนชำระ 0% 10 เดือน ที่สาขาอารีย์"
                    },
                    {
                        id: "TKT-202609-003",
                        ticket_no: "209051121",
                        receipt_no: "RC-VFIX-260901-003",
                        job_id: "JOB202609003",
                        customer_name: "คุณเอนก มั่งคั่ง",
                        service: "ติดตั้งระบบโซลาร์เซลล์ Solar Rooftop On-Grid 5kW",
                        amount: 145000,
                        payment_date: "2026-09-04",
                        payment_method: "โอนเงินผ่านธนาคาร (Bank Transfer)",
                        slip_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
                        slip_name: "slip_solar_50pct.jpg",
                        status: "ATTACHED",
                        notes: "มัดจำ 50% งานติดตั้ง Solar Rooftop ยอดรวม 290,000 บาท"
                    },
                    {
                        id: "TKT-202609-004",
                        ticket_no: "209051122",
                        receipt_no: "RC-VFIX-260901-004",
                        job_id: "JOB202609004",
                        customer_name: "คุณวิชัย ใจสว่าง",
                        service: "ปูกระกระเบื้องแกรนิตโต้ 60x60 ซม. และงานยาแนวกันซึม",
                        amount: 22000,
                        payment_date: "2026-09-04",
                        payment_method: "เงินสด (Cash)",
                        slip_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
                        slip_name: "receipt_cash.jpg",
                        status: "VERIFIED",
                        notes: "รับเงินสดหน้างาน พร้อมออกใบเสร็จรับเงินชั่วคราว"
                    },
                    {
                        id: "TKT-202609-005",
                        ticket_no: "209051123",
                        receipt_no: "RC-VFIX-260901-005",
                        job_id: "JOB202609005",
                        customer_name: "คุณสมศักดิ์ มั่นคงโชคดี",
                        service: "ติดตั้งเครื่องปรับอากาศ 45000W พร้อมเดินท่อทองแดงขาแขวน 1-CUT",
                        amount: 18500,
                        payment_date: "2026-09-04",
                        payment_method: "โอนเงินผ่านธนาคาร (Bank Transfer)",
                        slip_url: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80",
                        slip_name: "slip_transfer.jpg",
                        status: "ATTACHED",
                        notes: "โอนชำระเงินค่าติดตั้งและอุปกรณ์ท่อทองแดง"
                    }
                ];
            },

            getDefaultMockBlueprints() {
                return [
                    {
                        id: "BP001",
                        jobId: "JOB202609001",
                        customer: "คุณณวัฒน์ รักสงบ",
                        service: "ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU",
                        filename: "Air_Installation_Layout_v3_Final.pdf",
                        version: "v3 Final",
                        isCurrent: true,
                        size: "3.4 MB",
                        date: "04/09/2569 10:30 น.",
                        designer: "คุณธนกฤต (HVAC Designer)",
                        previewImg: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&auto=format&fit=crop&q=80",
                        notes: "แบบแปลนจุดติดตั้งคอยล์เย็นในห้องนอนใหญ่ และตำแหน่งแขวนคอนเดนซิ่งยูนิตภายนอกพร้อมแนวท่อรางครอบ 4 เมตร"
                    },
                    {
                        id: "BP002",
                        jobId: "JOB202609002",
                        customer: "คุณสมศรี สุขใจ",
                        service: "Renovate ห้องครัว Built-in & งานระบบประปา",
                        filename: "Kitchen_Renovate_Plumbing_Schematic.dwg",
                        version: "v2 Approved",
                        isCurrent: true,
                        size: "5.8 MB",
                        date: "04/09/2569 11:15 น.",
                        designer: "คุณกิตติศักดิ์ (Interior CAD)",
                        previewImg: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&auto=format&fit=crop&q=80",
                        notes: "ไดอะแกรมระบบสุขาภิบาล จุดต่อน้ำดี-น้ำทิ้ง และตำแหน่งตู้เคาน์เตอร์ครัว Built-in พร้อมแนวบล็อกไฟฝังผนัง"
                    }
                ];
            },

            // ─── STEP 3: TICKETS & RECEIPTS METHODS ─────────────────────
            renderTickets() {
                const searchInput = document.getElementById('ticket-search');
                const statusFilter = document.getElementById('ticket-filter-status');
                const methodFilter = document.getElementById('ticket-filter-method');
                const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
                const sf = statusFilter ? statusFilter.value : 'all';
                const mf = methodFilter ? methodFilter.value : 'all';

                const tickets = DB.tickets || [];

                // Stats calculation
                const totalTickets = tickets.length;
                const verifiedTickets = tickets.filter(t => t.status === 'VERIFIED').length;
                const pendingTickets = tickets.filter(t => t.status === 'ATTACHED').length;
                const totalAmount = tickets.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                const elTotal = document.getElementById('tickets-stat-total');
                if (elTotal) elTotal.innerText = totalTickets;
                const elVerified = document.getElementById('tickets-stat-verified');
                if (elVerified) elVerified.innerText = verifiedTickets;
                const elPending = document.getElementById('tickets-stat-pending');
                if (elPending) elPending.innerText = pendingTickets;
                const elAmount = document.getElementById('tickets-stat-amount');
                if (elAmount) elAmount.innerText = totalAmount.toLocaleString('th-TH') + ' ฿';

                const badgeTicketCount = document.getElementById('sidebar-ticket-count');
                if (badgeTicketCount) badgeTicketCount.innerText = totalTickets;

                // Filter
                let filtered = tickets;
                if (q) {
                    filtered = filtered.filter(t => 
                        (t.ticket_no && t.ticket_no.toLowerCase().includes(q)) ||
                        (t.receipt_no && t.receipt_no.toLowerCase().includes(q)) ||
                        (t.job_id && t.job_id.toLowerCase().includes(q)) ||
                        (t.customer_name && t.customer_name.toLowerCase().includes(q)) ||
                        (t.service && t.service.toLowerCase().includes(q))
                    );
                }
                if (sf !== 'all') {
                    filtered = filtered.filter(t => t.status === sf);
                }
                if (mf !== 'all') {
                    filtered = filtered.filter(t => (t.payment_method || '').includes(mf));
                }

                const tbody = document.getElementById('tickets-table-body');
                if (!tbody) return;

                if (filtered.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="8" class="py-12 text-center text-muted-foreground">
                                <div class="flex flex-col items-center justify-center gap-2">
                                    <i class="ph ph-receipt text-3xl text-muted-foreground/40"></i>
                                    <p class="text-xs font-semibold text-foreground">ไม่พบรายการ Ticket หรือใบเสร็จที่ตรงกับเงื่อนไข</p>
                                    <p class="text-[11px] text-muted-foreground">กดปุ่ม "บันทึก Ticket & ใบเสร็จใหม่" เพื่อเพิ่มข้อมูล</p>
                                    <button onclick="app.openCreateTicketModal()" class="mt-2 btn-artifact-primary px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                                        + บันทึก Ticket & ใบเสร็จ
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                tbody.innerHTML = filtered.map(t => {
                    const job = (DB.jobs || []).find(j => j.id === t.job_id);
                    const customerDisplay = t.customer_name || (job ? job.customer : 'ลูกค้าโครงการ');
                    const serviceDisplay = t.service || (job ? job.service : 'งานบริการ');
                    const amt = Number(t.amount) || 0;
                    const isVerified = t.status === 'VERIFIED';
                    const statusBadge = isVerified 
                        ? '<span class="status-pill font-mono text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">✓ ตรวจสอบแล้ว</span>'
                        : '<span class="status-pill font-mono text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">⏳ แนบใบเสร็จแล้ว</span>';

                    const slipThumb = t.slip_url ? `
                        <div class="inline-block relative group cursor-pointer" onclick="app.openTicketSlipLightbox('${t.id}')" title="คลิกดูสลิปขนาดใหญ่">
                            <img src="${t.slip_url}" alt="Slip" class="w-12 h-10 object-cover rounded-lg border border-border group-hover:border-emerald-500 transition shadow-xs">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                                <i class="ph ph-magnifying-glass-plus text-white text-xs"></i>
                            </div>
                        </div>
                    ` : '<span class="text-[10px] text-muted-foreground">-</span>';

                    return `
                    <tr class="hover:bg-muted/30 transition">
                        <td class="px-5 py-3.5">
                            <div class="font-mono font-bold text-foreground text-xs">${t.ticket_no}</div>
                            <div class="text-[10px] text-muted-foreground font-mono mt-0.5">${t.payment_date || '-'}</div>
                        </td>
                        <td class="px-5 py-3.5">
                            <div class="flex items-center gap-1.5">
                                <span class="cursor-pointer font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline" onclick="app.navigate('job-detail', '${t.job_id}')">${t.job_id}</span>
                            </div>
                            <div class="font-medium text-foreground text-xs truncate max-w-[200px]" title="${customerDisplay}">${customerDisplay}</div>
                            <div class="text-[10px] text-muted-foreground truncate max-w-[200px]">${serviceDisplay}</div>
                        </td>
                        <td class="px-5 py-3.5 font-mono text-foreground font-medium">
                            ${t.receipt_no || '-'}
                        </td>
                        <td class="px-5 py-3.5 font-mono font-bold text-foreground">
                            ${amt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                        </td>
                        <td class="px-5 py-3.5 text-[11px] text-muted-foreground">
                            <div class="font-medium text-foreground truncate max-w-[140px]">${t.payment_method || 'โอนเงิน'}</div>
                            <div class="text-[10px] text-muted-foreground truncate max-w-[140px]">${t.notes || ''}</div>
                        </td>
                        <td class="px-5 py-3.5 text-center">
                            ${slipThumb}
                        </td>
                        <td class="px-5 py-3.5">
                            ${statusBadge}
                        </td>
                        <td class="px-5 py-3.5 text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button type="button" onclick="app.openBOQForJob('${t.job_id}')" class="btn-artifact-primary px-2.5 py-1 rounded-lg text-[11px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 cursor-pointer font-medium shadow-xs" title="ไปจัดทำ BOQ (Step 4) สำหรับงานนี้">
                                    <span>BOQ</span> <i class="ph ph-arrow-right"></i>
                                </button>
                                <button type="button" onclick="app.openTicketSlipLightbox('${t.id}')" class="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-muted transition cursor-pointer" title="ดูใบเสร็จ">
                                    <i class="ph ph-eye text-base"></i>
                                </button>
                                <button type="button" onclick="app.deleteTicket('${t.id}')" class="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-muted transition cursor-pointer" title="ลบ Ticket">
                                    <i class="ph ph-trash text-base"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');
            },

            openCreateTicketModal(jobId = null) {
                const selectJob = document.getElementById('create-ticket-jobid');
                if (selectJob) {
                    selectJob.innerHTML = (DB.jobs || []).map(j => {
                        const cust = j.customer || `${j.firstName || ''} ${j.lastName || ''}`.trim() || 'ลูกค้า';
                        return `<option value="${j.id}">${j.id} - ${cust} (${j.service || 'งานติดตั้ง'})</option>`;
                    }).join('');

                    if (jobId) selectJob.value = jobId;
                }

                const targetJob = (DB.jobs || []).find(j => j.id === (jobId || (selectJob ? selectJob.value : '')));
                const nextNum = (DB.tickets || []).length + 1;
                const nextNumStr = String(nextNum).padStart(3, '0');

                const tktInput = document.getElementById('create-ticket-no');
                if (tktInput) tktInput.value = `TKT-202609-${nextNumStr}`;

                const rcInput = document.getElementById('create-ticket-receipt-no');
                if (rcInput) rcInput.value = `RC-VFIX-260901-${nextNumStr}`;

                const amtInput = document.getElementById('create-ticket-amount');
                if (amtInput) {
                    let defaultAmt = 25000;
                    if (targetJob && targetJob.boq_grand_total) defaultAmt = targetJob.boq_grand_total;
                    amtInput.value = defaultAmt;
                }

                const dateInput = document.getElementById('create-ticket-date');
                if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

                const previewContainer = document.getElementById('ticket-slip-preview-container');
                if (previewContainer) previewContainer.classList.add('hidden');
                this.state.newTicketSlipPreview = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80';
                this.state.newTicketSlipName = 'slip_sample_transfer.jpg';

                const notesInput = document.getElementById('create-ticket-notes');
                if (notesInput) notesInput.value = '';

                this.showModal('modal-create-ticket');
            },

            handleTicketJobChange(jobId) {
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (job && job.boq_grand_total) {
                    const amtInput = document.getElementById('create-ticket-amount');
                    if (amtInput) amtInput.value = job.boq_grand_total;
                }
            },

            handleTicketSlipSelect(event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                this.state.newTicketSlipName = file.name;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.state.newTicketSlipPreview = e.target.result;
                    const previewContainer = document.getElementById('ticket-slip-preview-container');
                    const previewImg = document.getElementById('ticket-slip-preview-img');
                    const previewName = document.getElementById('ticket-slip-preview-name');
                    if (previewContainer && previewImg) {
                        previewImg.src = e.target.result;
                        if (previewName) previewName.innerText = `📎 ${file.name}`;
                        previewContainer.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            },

            useSampleSlip(type = 1) {
                const sampleUrl = type === 1 
                    ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
                    : 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&auto=format&fit=crop&q=80';
                const sampleName = type === 1 ? 'sample_kbank_transfer_slip.jpg' : 'sample_credit_card_slip.jpg';
                this.state.newTicketSlipPreview = sampleUrl;
                this.state.newTicketSlipName = sampleName;
                const previewContainer = document.getElementById('ticket-slip-preview-container');
                const previewImg = document.getElementById('ticket-slip-preview-img');
                const previewName = document.getElementById('ticket-slip-preview-name');
                if (previewContainer && previewImg) {
                    previewImg.src = sampleUrl;
                    if (previewName) previewName.innerText = `📎 ${sampleName}`;
                    previewContainer.classList.remove('hidden');
                }
                this.showToast('📷 เลือกรูปตัวอย่างสลิปใบเสร็จเรียบร้อย');
            },

            submitCreateTicket(event) {
                event.preventDefault();
                const jobId = document.getElementById('create-ticket-jobid').value;
                const ticketNo = document.getElementById('create-ticket-no').value.trim();
                const receiptNo = document.getElementById('create-ticket-receipt-no').value.trim();
                const amount = parseFloat(document.getElementById('create-ticket-amount').value) || 0;
                const paymentDate = document.getElementById('create-ticket-date').value;
                const paymentMethod = document.getElementById('create-ticket-method').value;
                const notes = document.getElementById('create-ticket-notes').value.trim();

                const job = (DB.jobs || []).find(j => j.id === jobId);
                const newTicket = {
                    id: `TKT-${Date.now()}`,
                    ticket_no: ticketNo,
                    receipt_no: receiptNo,
                    job_id: jobId,
                    customer_name: job ? job.customer : '',
                    service: job ? job.service : '',
                    amount: amount,
                    payment_date: paymentDate,
                    payment_method: paymentMethod,
                    slip_url: this.state.newTicketSlipPreview || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
                    slip_name: this.state.newTicketSlipName || 'receipt_slip.jpg',
                    status: 'VERIFIED',
                    notes: notes,
                    created_at: new Date().toISOString()
                };

                if (!DB.tickets) DB.tickets = [];
                DB.tickets.unshift(newTicket);
                this.persistTickets();

                // Step 3 Timestamp Recording
                this.recordStepTimestamp(jobId, 'step3_ticket_at', newTicket.created_at, `บันทึก Ticket ${ticketNo} สลิป ${receiptNo || '-'}`);
                this.hideModal('modal-create-ticket');
                this.renderTickets();
                this.showToast(`✅ บันทึก Ticket ${ticketNo} และแนบใบเสร็จเรียบร้อย`);
            },

            openTicketSlipLightbox(ticketId) {
                const t = (DB.tickets || []).find(x => x.id === ticketId);
                if (!t) return;
                const img = document.getElementById('receipt-lightbox-img');
                const title = document.getElementById('receipt-lightbox-title');
                const sub = document.getElementById('receipt-lightbox-subtitle');
                const details = document.getElementById('receipt-lightbox-details');
                if (img) img.src = t.slip_url;
                if (title) title.innerText = `ใบเสร็จรับเงิน: ${t.receipt_no || '-'}`;
                if (sub) sub.innerText = `Ticket: ${t.ticket_no} • โครงการ: ${t.job_id} (${t.customer_name})`;
                if (details) {
                    details.innerHTML = `
                        <div><strong>ยอดชำระ:</strong> <span class="font-mono text-emerald-600 font-bold">${Number(t.amount).toLocaleString('th-TH')} ฿</span> (${t.payment_method})</div>
                        <div><strong>วันที่:</strong> <span class="font-mono">${t.payment_date || '-'}</span> | <strong>หมายเหตุ:</strong> ${t.notes || '-'}</div>
                    `;
                }
                this.showModal('modal-ticket-receipt-lightbox');
            },

            deleteTicket(ticketId) {
                if (!confirm('คุณต้องการลบ Ticket รายการนี้ใช่หรือไม่?')) return;
                DB.tickets = (DB.tickets || []).filter(t => t.id !== ticketId);
                this.persistTickets();
                this.renderTickets();
                this.showToast('🗑️ ลบ Ticket เรียบร้อย');
            },

            openBOQForJob(jobId) {
                this.state.boqSelectedJobId = jobId;
                this.navigate('boq', jobId);
            },

            // ─── STEP 4: BOQ MANAGEMENT METHODS ─────────────────────────
            renderBOQPage(jobId = null) {
                const targetJobId = jobId || this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                this.state.boqSelectedJobId = targetJobId;

                const job = (DB.jobs || []).find(j => j.id === targetJobId);

                // Populate Project Select
                const selectEl = document.getElementById('boq-page-job-select');
                if (selectEl) {
                    selectEl.innerHTML = (DB.jobs || []).map(j => {
                        const cust = j.customer || `${j.firstName || ''} ${j.lastName || ''}`.trim() || 'ลูกค้า';
                        const count = (j.boq_items || []).length;
                        const statusTag = count > 0 ? `(${count} รายการ - มี BOQ)` : `(ยังไม่มี BOQ)`;
                        return `<option value="${j.id}" ${j.id === targetJobId ? 'selected' : ''}>${j.id} - ${cust} ${statusTag}</option>`;
                    }).join('');
                    selectEl.value = targetJobId;
                }

                const infoBadge = document.getElementById('boq-project-info-badge');
                if (infoBadge && job) {
                    infoBadge.innerHTML = `
                        <span class="font-mono font-bold text-purple-600 dark:text-purple-400">${job.id}</span>
                        <span>•</span>
                        <span class="font-semibold text-foreground">${job.customer}</span>
                        <span>•</span>
                        <span class="text-muted-foreground">${job.phone}</span>
                        <span>•</span>
                        <span class="text-brand-500 font-medium">${job.service}</span>
                    `;
                }

                const boqItems = (job && job.boq_items) ? job.boq_items : [];

                // Categorize items
                const isLabor = (name) => {
                    if (!name) return false;
                    const n = name.toLowerCase();
                    return n.includes('ติดตั้ง') || n.includes('รื้อถอน') || n.includes('เดินท่อ') || 
                           n.includes('ทาสี') || n.includes('ปู') || n.includes('ฉาบ') || 
                           n.includes('ประกอบ') || n.includes('ซ่อม') || n.includes('บริการ') ||
                           n.includes('งาน') || n.includes('แรง') || n.includes('ล้าง');
                };

                let laborCount = 0;
                let matCount = 0;
                let subtotal = 0;

                boqItems.forEach(item => {
                    const qty = Number(item.qty) || 0;
                    const price = Number(item.price || item.unit_price) || 0;
                    subtotal += (qty * price);
                    if (isLabor(item.name)) {
                        laborCount++;
                    } else {
                        matCount++;
                    }
                });

                const discount = job ? (Number(job.boq_discount) || 0) : 0;
                const afterDiscount = Math.max(0, subtotal - discount);
                const vat = afterDiscount * 0.07;
                const grandTotal = afterDiscount + vat;

                if (job) {
                    job.boq_subtotal = subtotal;
                    job.boq_grand_total = grandTotal;
                }

                // Update KPI Cards
                const elTotItems = document.getElementById('boq-stat-total-items');
                if (elTotItems) elTotItems.innerText = boqItems.length;
                const elLaborItems = document.getElementById('boq-stat-labor-items');
                if (elLaborItems) elLaborItems.innerText = laborCount;
                const elMatItems = document.getElementById('boq-stat-material-items');
                if (elMatItems) elMatItems.innerText = matCount;
                const elGrand = document.getElementById('boq-stat-grandtotal');
                if (elGrand) elGrand.innerText = grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';

                // Update summary box
                const elSub = document.getElementById('boq-page-subtotal-val');
                if (elSub) elSub.innerText = subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
                const elDisc = document.getElementById('boq-page-discount-val');
                if (elDisc) elDisc.innerText = `-${discount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`;
                const elVat = document.getElementById('boq-page-vat-val');
                if (elVat) elVat.innerText = vat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
                const elGt = document.getElementById('boq-page-grandtotal-val');
                if (elGt) elGt.innerText = grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';

                // Render Table
                const tbody = document.getElementById('boq-page-table-tbody');
                if (tbody) {
                    if (boqItems.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="8" class="py-12 text-center text-muted-foreground">
                                    <div class="flex flex-col items-center justify-center gap-2">
                                        <i class="ph ph-file-dashed text-3xl text-muted-foreground/40"></i>
                                        <p class="text-xs font-semibold text-foreground">ยังไม่มีรายการ BOQ สำหรับโครงการ ${targetJobId}</p>
                                        <p class="text-[11px] text-muted-foreground">กดปุ่ม "📥 นำเข้า Excel / vFIX" หรือกด "เพิ่มแถวรายการ" เพื่อเริ่มจัดทำ</p>
                                        <div class="flex items-center gap-2 mt-2">
                                            <button onclick="app.openImportBOQModal('${targetJobId}')" class="btn-artifact-primary px-3.5 py-1.5 rounded-lg text-xs bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">
                                                📥 นำเข้า Excel / vFIX
                                            </button>
                                            <button onclick="app.addBOQItemToPage()" class="btn-artifact-secondary px-3.5 py-1.5 rounded-lg text-xs cursor-pointer">
                                                + เพิ่มแถวรายการ
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        tbody.innerHTML = boqItems.map((item, idx) => {
                            const labor = isLabor(item.name);
                            const itemPrice = Number(item.price || item.unit_price) || 0;
                            const itemQty = Number(item.qty) || 0;
                            const itemTotal = itemQty * itemPrice;
                            const typeBadge = labor 
                                ? '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">⚡ ค่าแรง/บริการ</span>'
                                : '<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20">📦 วัสดุอุปกรณ์</span>';

                            return `
                            <tr class="hover:bg-muted/30 transition">
                                <td class="py-2.5 px-3 text-center text-muted-foreground font-mono">${idx + 1}</td>
                                <td class="py-2.5 px-3">
                                    <input type="text" value="${item.name || ''}" oninput="app.updateBOQPageItem(${idx}, 'name', this.value)" placeholder="ชื่อรายการ..." class="w-full bg-transparent hover:bg-muted/40 focus:bg-card border border-transparent hover:border-border focus:border-purple-500 rounded px-2 py-1 text-xs text-foreground font-medium transition focus:outline-none">
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    ${typeBadge}
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    <input type="number" min="1" step="1" value="${itemQty}" oninput="app.updateBOQPageItem(${idx}, 'qty', this.value)" class="w-20 text-center bg-muted/30 border border-border focus:border-purple-500 rounded px-2 py-1 text-xs text-foreground font-mono transition focus:outline-none">
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    <input type="text" value="${item.unit || 'ชุด'}" oninput="app.updateBOQPageItem(${idx}, 'unit', this.value)" class="w-16 text-center bg-muted/30 border border-border focus:border-purple-500 rounded px-1.5 py-1 text-xs text-foreground transition focus:outline-none">
                                </td>
                                <td class="py-2.5 px-3 text-right">
                                    <input type="number" min="0" step="50" value="${itemPrice}" oninput="app.updateBOQPageItem(${idx}, 'price', this.value)" class="w-28 text-right bg-muted/30 border border-border focus:border-purple-500 rounded px-2 py-1 text-xs text-foreground font-mono transition focus:outline-none">
                                </td>
                                <td class="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                    ${itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    <button type="button" onclick="app.removeBOQPageItem(${idx})" class="p-1 text-muted-foreground hover:text-rose-500 rounded transition cursor-pointer" title="ลบรายการนี้">
                                        <i class="ph ph-trash text-sm"></i>
                                    </button>
                                </td>
                            </tr>
                            `;
                        }).join('');
                    }
                }

                // Render Overview of all jobs
                const overviewTbody = document.getElementById('boq-overview-table-tbody');
                if (overviewTbody) {
                    overviewTbody.innerHTML = (DB.jobs || []).map(j => {
                        const items = j.boq_items || [];
                        const hasBOQ = items.length > 0;
                        const laborItems = items.filter(it => isLabor(it.name)).length;
                        const sub = items.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.price || it.unit_price) || 0)), 0);
                        const disc = Number(j.boq_discount) || 0;
                        const gt = Math.max(0, sub - disc) * 1.07;
                        const isCurrent = j.id === targetJobId;

                        const boqStatusBadge = hasBOQ 
                            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono">มี BOQ (${items.length} รายการ)</span>`
                            : `<span class="px-2 py-0.5 rounded text-[10px] bg-zinc-500/10 text-zinc-500 font-mono">ยังไม่มี BOQ</span>`;

                        return `
                        <tr class="hover:bg-muted/30 transition ${isCurrent ? 'bg-purple-500/5' : ''}">
                            <td class="px-4 py-2.5 font-mono font-bold ${isCurrent ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}">
                                ${j.id}
                            </td>
                            <td class="px-4 py-2.5 font-medium text-foreground">${j.customer}</td>
                            <td class="px-4 py-2.5 text-muted-foreground truncate max-w-[180px]">${j.service}</td>
                            <td class="px-4 py-2.5 text-center">${boqStatusBadge}</td>
                            <td class="px-4 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">${laborItems} งาน</td>
                            <td class="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                                ${hasBOQ ? gt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿' : '-'}
                            </td>
                            <td class="px-4 py-2.5 text-right">
                                <div class="flex items-center justify-end gap-1.5">
                                    <button onclick="app.switchBOQPageJob('${j.id}')" class="btn-artifact-secondary px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer">
                                        เปิด BOQ
                                    </button>
                                    <button onclick="app.proceedToStep5Project('${j.id}')" class="btn-artifact-primary px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white cursor-pointer" title="แปลงเป็น Project (Step 5)">
                                        Step 5 ➔
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('');
                }
            },

            switchBOQPageJob(jobId) {
                this.state.boqSelectedJobId = jobId;
                this.renderBOQPage(jobId);
            },

            addBOQItemToPage() {
                const targetJobId = this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = (DB.jobs || []).find(j => j.id === targetJobId);
                if (!job) return;
                if (!job.boq_items) job.boq_items = [];
                job.boq_items.push({
                    name: 'งานบริการติดตั้งเพิ่มเติม',
                    qty: 1,
                    unit: 'ชุด',
                    price: 2500,
                    labor_price: 2500,
                    mat_price: 0
                });
                this.persistJobs();
                this.renderBOQPage(targetJobId);
                this.showToast('➕ เพิ่มแถวรายการใหม่เรียบร้อย');
            },

            updateBOQPageItem(idx, field, value) {
                const targetJobId = this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = (DB.jobs || []).find(j => j.id === targetJobId);
                if (!job || !job.boq_items || !job.boq_items[idx]) return;
                if (field === 'qty' || field === 'price') {
                    job.boq_items[idx][field] = Number(value) || 0;
                } else {
                    job.boq_items[idx][field] = value;
                }
                this.persistJobs();
                this.renderBOQPage(targetJobId);
            },

            removeBOQPageItem(idx) {
                const targetJobId = this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                const job = (DB.jobs || []).find(j => j.id === targetJobId);
                if (!job || !job.boq_items) return;
                job.boq_items.splice(idx, 1);
                this.persistJobs();
                this.renderBOQPage(targetJobId);
                this.showToast('🗑️ ลบรายการ BOQ เรียบร้อย');
            },

            saveBOQPage() {
                const targetJobId = this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                this.recordStepTimestamp(targetJobId, 'step4_boq_at', new Date().toISOString(), 'บันทึกรายการ BOQ ในระบบ PMT');
                this.persistJobs();
                this.showToast(`💾 บันทึกรายการ BOQ โครงการ ${targetJobId} เรียบร้อย (บันทึก Timestamp แล้ว)`);
            },

            proceedToStep5Project(jobId) {
                const targetJobId = jobId || this.state.boqSelectedJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                this.state.selectedConversionJobId = targetJobId;
                this.state.selectedGanttJobId = targetJobId;
                this.navigate('project-conversion', targetJobId);
                this.showToast(`🚀 เข้าสู่ Step 5: พร้อมบันทึก BOQ โครงการ ${targetJobId} เข้าเป็นแผนงาน Project`);
            },

            // ─── STEP 5: PROJECT CONVERSION & GANTT METHODS ─────────────
            renderProjectConversion(jobId = null) {
                const targetJobId = jobId || this.state.selectedConversionJobId || this.state.selectedGanttJobId || (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                this.state.selectedConversionJobId = targetJobId;
                this.state.selectedGanttJobId = targetJobId;

                const job = (DB.jobs || []).find(j => j.id === targetJobId);

                // Populate conversion-job-select
                const sel = document.getElementById('conversion-job-select');
                if (sel) {
                    sel.innerHTML = (DB.jobs || []).map(j => {
                        const cust = j.customer || `${j.firstName || ''} ${j.lastName || ''}`.trim() || 'ลูกค้า';
                        const boqCount = (j.boq_items || []).length;
                        const taskCount = (DB.tasks || []).filter(t => t.jobId === j.id).length;
                        return `<option value="${j.id}" ${j.id === targetJobId ? 'selected' : ''}>${j.id} - ${cust} (BOQ: ${boqCount} | Tasks: ${taskCount})</option>`;
                    }).join('');
                    sel.value = targetJobId;
                }

                const boqItems = (job && job.boq_items) ? job.boq_items : [];
                const isLabor = (name) => {
                    if (!name) return false;
                    const n = name.toLowerCase();
                    return n.includes('ติดตั้ง') || n.includes('รื้อถอน') || n.includes('เดินท่อ') || 
                           n.includes('ทาสี') || n.includes('ปู') || n.includes('ฉาบ') || 
                           n.includes('ประกอบ') || n.includes('ซ่อม') || n.includes('บริการ') ||
                           n.includes('งาน') || n.includes('แรง') || n.includes('ล้าง');
                };
                const laborItems = boqItems.filter(it => isLabor(it.name));
                const jobTasks = (DB.tasks || []).filter(t => t.jobId === targetJobId);

                const banner = document.getElementById('conversion-status-banner');
                if (banner) {
                    if (boqItems.length === 0) {
                        banner.innerHTML = `
                            <div class="flex items-center gap-3 text-xs">
                                <div class="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-base shrink-0">
                                    <i class="ph ph-warning-circle"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-foreground">โครงการนี้ยังไม่มีรายการ BOQ</h4>
                                    <p class="text-muted-foreground text-[11px]">กรุณากลับไป Step 4: นำBOQ เข้าระบบ หรือกดปุ่มนำเข้าไฟล์ Excel ก่อนเพื่อสกัดรายการค่าแรง</p>
                                </div>
                            </div>
                            <button onclick="app.navigate('boq', '${targetJobId}')" class="btn-artifact-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0">
                                ➔ ไปหน้า Step 4: นำBOQ เข้าระบบ
                            </button>
                        `;
                    } else if (jobTasks.length === 0) {
                        banner.innerHTML = `
                            <div class="flex items-center gap-3 text-xs">
                                <div class="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base shrink-0">
                                    <i class="ph ph-hourglass"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-foreground">มีรายการค่าแรงใน BOQ ${laborItems.length} รายการ พร้อมแปลงเข้า Project</h4>
                                    <p class="text-muted-foreground text-[11px]">กดปุ่มแปลงด้านขวาเพื่อกำหนดวันเริ่ม-สิ้นสุด และทีมช่างลงในแผนงาน Gantt</p>
                                </div>
                            </div>
                            <button onclick="app.openConvertBOQToTasksModal('${targetJobId}')" class="btn-artifact-primary px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-600 hover:to-brand-700 text-white cursor-pointer shadow-md shrink-0 flex items-center gap-1.5">
                                <i class="ph ph-lightning text-sm"></i>
                                <span>⚡ แปลง BOQ เข้า Project</span>
                            </button>
                        `;
                    } else {
                        banner.innerHTML = `
                            <div class="flex items-center gap-3 text-xs">
                                <div class="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base shrink-0">
                                    <i class="ph ph-check-circle"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-foreground">แปลงเข้า Project เรียบร้อย (${jobTasks.length} Tasks ใน Gantt)</h4>
                                    <p class="text-muted-foreground text-[11px]">ตารางงานช่างและคิวจอง QC ล่วงหน้า 5 วันถูกซิงค์เข้าสู่แผนงานแล้ว</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <button onclick="app.openConvertBOQToTasksModal('${targetJobId}')" class="btn-artifact-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1">
                                    <i class="ph ph-pencil-simple"></i> ปรับวัน/ช่าง
                                </button>
                                <button onclick="app.navigate('gantt')" class="btn-artifact-primary px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1">
                                    <i class="ph ph-chart-bar"></i> ดูหน้า Gantt
                                </button>
                            </div>
                        `;
                    }
                }

                // Render tasks table
                const taskTitle = document.getElementById('conversion-tasks-title');
                if (taskTitle) {
                    taskTitle.innerText = `รายการ Task ในโครงการ ${targetJobId} (${jobTasks.length} งาน)`;
                }

                const tbody = document.getElementById('conversion-tasks-tbody');
                if (tbody) {
                    if (jobTasks.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="6" class="py-10 text-center text-muted-foreground">
                                    <div class="flex flex-col items-center justify-center gap-1.5">
                                        <i class="ph ph-calendar-x text-3xl text-muted-foreground/40"></i>
                                        <p class="text-xs font-semibold text-foreground">ยังไม่มี Task ที่แปลงเข้าแผนงานสำหรับโครงการนี้</p>
                                        <p class="text-[11px] text-muted-foreground">กดปุ่ม "⚡ แปลง BOQ เข้า Project" เพื่อสร้าง Task จากรายการค่าแรง</p>
                                        ${laborItems.length > 0 ? `
                                            <button onclick="app.openConvertBOQToTasksModal('${targetJobId}')" class="mt-2 btn-artifact-primary px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer">
                                                ⚡ แปลงค่าแรง ${laborItems.length} รายการเป็น Task
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        tbody.innerHTML = jobTasks.map((t, idx) => {
                            const days = t.days || 1;
                            const tech = t.tech || (job ? job.tech : 'Team A (สมศักดิ์)');
                            return `
                            <tr class="hover:bg-muted/30 transition">
                                <td class="px-4 py-2.5">
                                    <div class="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                        <span class="w-4 h-4 rounded-full bg-brand-500/20 text-brand-500 font-mono text-[9px] flex items-center justify-center">${idx + 1}</span>
                                        <span>${t.name}</span>
                                    </div>
                                </td>
                                <td class="px-4 py-2.5">
                                    <span class="px-2 py-0.5 rounded bg-muted text-foreground font-medium text-[11px] border border-border">${tech}</span>
                                </td>
                                <td class="px-4 py-2.5 font-mono text-xs text-foreground">${t.start || '-'}</td>
                                <td class="px-4 py-2.5 font-mono text-xs text-foreground">${t.end || '-'}</td>
                                <td class="px-4 py-2.5 text-center font-mono text-xs">${days} วัน</td>
                                <td class="px-4 py-2.5 text-center">
                                    <span class="status-pill status-in-progress font-mono text-[10px]">${t.status || 'IN_PROGRESS'}</span>
                                </td>
                            </tr>
                            `;
                        }).join('');
                    }
                }
            },

            switchConversionJob(jobId) {
                this.state.selectedConversionJobId = jobId;
                this.state.selectedGanttJobId = jobId;
                this.renderProjectConversion(jobId);
            },

            openCurrentFilterJobBOQ() {
                const jobFilterEl = document.getElementById('gantt-filter-job');
                const selectedJobFilter = jobFilterEl ? jobFilterEl.value : 'all';
                const targetJobId = (selectedJobFilter && selectedJobFilter !== 'all') ? selectedJobFilter : (DB.jobs[0] ? DB.jobs[0].id : 'JOB202609001');
                this.openJobDetailBOQ(targetJobId);
            },

            renderGanttFilterOptions(selectedVal = 'all') {
                const sel = document.getElementById('gantt-filter-job');
                if (!sel) return;
                let html = '<option value="all">ทุกโครงการ (All Jobs)</option>';
                (DB.jobs || []).forEach(j => {
                    const cust = j.customer || `${j.firstName || ''} ${j.lastName || ''}`.trim() || 'ลูกค้า';
                    const boqCount = (j.boq_items || []).length;
                    const taskCount = (DB.tasks || []).filter(t => t.jobId === j.id).length;
                    const boqTag = boqCount > 0 ? `[BOQ: ${boqCount} | Tasks: ${taskCount}]` : '[ยังไม่มี BOQ]';
                    html += `<option value="${j.id}" ${selectedVal === j.id ? 'selected' : ''}>${j.id} - คุณ${cust} (${j.service || 'บริการ'}) ${boqTag}</option>`;
                });
                sel.innerHTML = html;
                sel.value = selectedVal;
            },

            setProjectViewMode(mode) {
                this.state.projectViewMode = mode;
                try { localStorage.setItem('pmt_project_view_mode', mode); } catch (e) {}
                this.updateProjectViewModeButtons();
                const jobFilterEl = document.getElementById('gantt-filter-job');
                const selectedJobFilter = jobFilterEl ? jobFilterEl.value : 'all';
                this.renderGanttProjectsStrip(selectedJobFilter);
            },

            updateProjectViewModeButtons() {
                const mode = this.state.projectViewMode || 'card';
                const btnCard = document.getElementById('btn-project-mode-card');
                const btnList = document.getElementById('btn-project-mode-list');
                const btnStripCard = document.getElementById('btn-project-strip-card');
                const btnStripList = document.getElementById('btn-project-strip-list');

                if (btnCard && btnList) {
                    if (mode === 'card') {
                        btnCard.className = 'px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnList.className = 'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    } else {
                        btnList.className = 'px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnCard.className = 'px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    }
                }

                if (btnStripCard && btnStripList) {
                    if (mode === 'card') {
                        btnStripCard.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer bg-card text-foreground shadow-xs';
                        btnStripList.className = 'px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground';
                    } else {
                        btnStripList.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer bg-card text-foreground shadow-xs';
                        btnStripCard.className = 'px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground';
                    }
                }
            },

            filterGanttProjectTable(query) {
                const q = (query || '').toLowerCase().trim();
                const rows = document.querySelectorAll('.gantt-project-list-row');
                rows.forEach(row => {
                    const text = row.innerText.toLowerCase();
                    row.style.display = (!q || text.includes(q)) ? '' : 'none';
                });
            },

            formatDateDMY(dateStr) {
                if (!dateStr) return '-';
                const parts = String(dateStr).split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return dateStr;
            },

            calculateQCBookingDate(endDateStr, daysBefore = 5) {
                if (!endDateStr) return '';
                const d = new Date(endDateStr);
                if (isNaN(d.getTime())) return endDateStr;
                d.setDate(d.getDate() - daysBefore);
                return d.toISOString().slice(0, 10);
            },

            syncQCBookingsFromTasks() {
                if (!DB.qcBookings) DB.qcBookings = [];
                const tasks = DB.tasks || [];
                const validTaskIds = new Set();

                tasks.forEach(t => {
                    if (!t.id) return;
                    validTaskIds.add(String(t.id));
                    const job = (DB.jobs || []).find(j => j.id === t.jobId) || {};
                    const custName = job.customer || 'ลูกค้า';
                    const endDateStr = t.end || t.start || '2026-09-05';
                    const qcDate = this.calculateQCBookingDate(endDateStr, 5);

                    let booking = DB.qcBookings.find(b => String(b.taskId) === String(t.id));
                    if (booking) {
                        booking.taskName = t.name;
                        booking.taskStart = t.start;
                        booking.taskEnd = endDateStr;
                        booking.qcBookingDate = qcDate;
                        booking.assignedTech = t.tech || job.tech || 'Team A (สมศักดิ์)';
                        booking.customerName = custName;
                        booking.taskStatus = t.status;
                        if (!booking.assignedQCTech) booking.assignedQCTech = 'วิชัย ตรวจดี (ช่าง QC Lead)';
                    } else {
                        booking = {
                            id: `QCB_${t.id}`,
                            taskId: t.id,
                            jobId: t.jobId,
                            taskName: t.name,
                            customerName: custName,
                            taskStart: t.start || '2026-09-05',
                            taskEnd: endDateStr,
                            qcBookingDate: qcDate,
                            daysBefore: 5,
                            assignedTech: t.tech || job.tech || 'Team A (สมศักดิ์)',
                            assignedQCTech: 'วิชัย ตรวจดี (ช่าง QC Lead)',
                            status: 'PENDING_CONFIRM',
                            confirmedAt: null,
                            confirmedBy: null,
                            remarks: '',
                            createdAt: new Date().toISOString()
                        };
                        DB.qcBookings.push(booking);
                    }
                });

                // Clean up orphan bookings whose tasks were deleted
                DB.qcBookings = DB.qcBookings.filter(b => validTaskIds.has(String(b.taskId)));
                this.persistJobs();
                this.updateQCBadges();
            },

            updateQCBadges() {
                const bookings = DB.qcBookings || [];
                const pendingBookings = bookings.filter(b => b.status !== 'CONFIRMED').length;
                const qcJobs = (DB.jobs || []).filter(j => j.status === 'QC_PENDING').length;
                const totalQCAlerts = pendingBookings + qcJobs;

                const sbBadge = document.getElementById('sidebar-qc-count');
                if (sbBadge) {
                    sbBadge.innerText = totalQCAlerts;
                    sbBadge.style.display = totalQCAlerts > 0 ? '' : 'none';
                }
                const bBadge = document.getElementById('qc-bookings-badge');
                if (bBadge) bBadge.innerText = bookings.length;
                const qBadge = document.getElementById('qc-queue-count');
                if (qBadge) qBadge.innerText = qcJobs.length;
            },

            openQCFromTask(taskId) {
                this.syncQCBookingsFromTasks();
                this.state.qcTab = 'bookings';
                const booking = (DB.qcBookings || []).find(b => String(b.taskId) === String(taskId));
                if (booking) {
                    this.state.selectedQCBookingId = booking.id;
                }
                this.navigate('qc');
            },

            switchQCTab(tab) {
                this.state.qcTab = tab;
                const btnBookings = document.getElementById('tab-qc-bookings');
                const btnInspect = document.getElementById('tab-qc-inspection');
                if (btnBookings && btnInspect) {
                    if (tab === 'bookings') {
                        btnBookings.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnInspect.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    } else {
                        btnInspect.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-card text-foreground shadow-xs';
                        btnBookings.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground';
                    }
                }
                this.renderQC();
            },

            updateQCBookingInspector(bookingId, newInspector) {
                const booking = (DB.qcBookings || []).find(b => b.id === bookingId);
                if (!booking) return;
                booking.assignedQCTech = newInspector;
                this.persistJobs();
                this.showToast(`👤 มอบหมายช่าง QC: ${newInspector} เรียบร้อย`);
                fetch(`/api/v1/qc/bookings/${bookingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assigned_qc_tech: newInspector })
                }).catch(() => {});
            },

            updateQCBookingDate(bookingId, newDate) {
                const booking = (DB.qcBookings || []).find(b => b.id === bookingId);
                if (!booking) return;
                booking.qcBookingDate = newDate;
                this.persistJobs();
                this.showToast(`📅 อัปเดตวันนัดตรวจ QC เป็น ${this.formatDateDMY(newDate)} เรียบร้อย`);
                fetch(`/api/v1/qc/bookings/${bookingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ qc_booking_date: newDate })
                }).catch(() => {});
                if (this.state.currentView === 'gantt') this.renderGantt();
            },

            saveQCBookingRemarks(bookingId) {
                const booking = (DB.qcBookings || []).find(b => b.id === bookingId);
                if (!booking) return;
                const txt = document.getElementById(`qc-remarks-input-${bookingId}`);
                if (txt) booking.remarks = txt.value;
                this.persistJobs();
                this.showToast('💾 บันทึกหมายเหตุการจอง QC เรียบร้อย');
                fetch(`/api/v1/qc/bookings/${bookingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ remarks: booking.remarks })
                }).catch(() => {});
            },

            confirmQCBooking(bookingId) {
                const booking = (DB.qcBookings || []).find(b => b.id === bookingId);
                if (!booking) return;
                const inspectorEl = document.getElementById(`qc-inspector-input-${bookingId}`);
                if (inspectorEl) booking.assignedQCTech = inspectorEl.value;
                const remarksEl = document.getElementById(`qc-remarks-input-${bookingId}`);
                if (remarksEl) booking.remarks = remarksEl.value;

                booking.status = 'CONFIRMED';
                booking.confirmedAt = new Date().toISOString();
                booking.confirmedBy = (typeof auth !== 'undefined' && auth.user ? auth.user.name : 'เจ้าหน้าที่ PMT');

                this.persistJobs();
                this.showToast(`✅ ยืนยันการจองช่าง QC (${booking.assignedQCTech}) เรียบร้อยแล้ว`);

                fetch(`/api/v1/qc/bookings/${bookingId}/confirm`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        qc_tech: booking.assignedQCTech,
                        confirmed_by: booking.confirmedBy,
                        remarks: booking.remarks
                    })
                }).catch(() => {});

                this.renderQC();
                if (this.state.currentView === 'gantt') this.renderGantt();
            },

            startQCInspectionFromBooking(jobId) {
                this.state.qcTab = 'inspection';
                this.switchQCTab('inspection');
                this.selectQCJob(jobId);
            },

            renderGanttProjectsStrip(selectedFilter = 'all') {
                const stripEl = document.getElementById('gantt-projects-strip');
                if (!stripEl) return;

                if (!DB.jobs || DB.jobs.length === 0) {
                    stripEl.className = 'w-full';
                    stripEl.innerHTML = `
                    <div class="col-span-full p-6 rounded-2xl border border-dashed border-border bg-card/50 text-center space-y-2">
                        <div class="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground mx-auto">
                            <i class="ph ph-folder-dashed text-xl"></i>
                        </div>
                        <p class="text-xs font-semibold text-foreground">ยังไม่มีข้อมูลโครงการในระบบ</p>
                        <p class="text-[11px] text-muted-foreground">กดปุ่ม "รับ Order ใหม่ (INT)" หรือ "จำลอง 10 งาน (INT)" เพื่อเริ่มต้นโครงการ</p>
                    </div>
                    `;
                    return;
                }

                const isListView = (this.state.projectViewMode === 'list');

                if (isListView) {
                    const jobsHtml = DB.jobs.map(job => {
                        const isSelected = selectedFilter === job.id;
                        const boqCount = (job.boq_items || []).length;
                        const taskCount = (DB.tasks || []).filter(t => t.jobId === job.id).length;
                        const boqSum = (job.boq_items || []).reduce((acc, it) => acc + ((it.qty || 0) * (it.price || 0)), 0);
                        const discount = job.boq_discount !== undefined ? job.boq_discount : 500;
                        const grandTotal = Math.max(0, boqSum - discount) * 1.07;
                        const hasBOQ = boqCount > 0;
                        const custName = job.customer || `${job.firstName || ''} ${job.lastName || ''}`.trim() || 'ลูกค้าทั่วไป';

                        return `
                        <tr onclick="app.selectGanttJob('${job.id}')" 
                            class="gantt-project-list-row transition-colors cursor-pointer group ${isSelected ? 'bg-brand-500/15 ring-1 ring-inset ring-brand-500/50' : 'hover:bg-muted/40'}">
                            <td class="py-2.5 px-3">
                                <div class="flex items-center gap-2">
                                    <span class="font-mono text-xs font-bold ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-foreground'} flex items-center gap-1 group-hover:text-brand-500 transition">
                                        <i class="ph ph-folder-open text-xs text-brand-500"></i> ${job.id}
                                    </span>
                                    <span class="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground max-w-[200px] truncate" title="${job.service || '-'}">${job.service || '-'}</span>
                                </div>
                            </td>
                            <td class="py-2.5 px-3">
                                <div class="text-xs font-semibold text-foreground truncate max-w-[160px]" title="${custName}">
                                    ${custName}
                                </div>
                                <div class="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">${job.phone || '-'}</div>
                            </td>
                            <td class="py-2.5 px-3 text-center">
                                <span class="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full ${hasBOQ ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20'}">
                                    <i class="ph ${hasBOQ ? 'ph-check-circle text-emerald-500' : 'ph-warning-circle text-amber-500'}"></i> ${hasBOQ ? `${boqCount} รายการ` : 'ยังไม่มี BOQ'}
                                </span>
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono font-bold text-xs ${hasBOQ ? 'text-brand-600 dark:text-brand-400' : 'text-muted-foreground'}">
                                ${hasBOQ ? `฿${Math.round(grandTotal).toLocaleString('th-TH')}` : '฿0'}
                            </td>
                            <td class="py-2.5 px-3 text-center font-mono text-xs">
                                ${hasBOQ ? (taskCount > 0 ? `
                                    <span class="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                        <i class="ph ph-chart-bar-horizontal"></i> ${taskCount} Tasks
                                    </span>
                                ` : `
                                    <span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        0 Tasks (รอกำหนดวัน/ช่าง)
                                    </span>
                                `) : `
                                    <span class="text-muted-foreground text-[10px]">-</span>
                                `}
                            </td>
                            <td class="py-2.5 px-3 text-center">
                                ${!hasBOQ ? `
                                    <button type="button" onclick="event.stopPropagation(); app.openImportBOQModal('${job.id}')" 
                                            class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition" title="นำเข้า BOQ เพื่อเริ่มวางแผนงาน">
                                        <i class="ph ph-file-arrow-up text-xs"></i> นำเข้า BOQ
                                    </button>
                                ` : (taskCount === 0 ? `
                                    <button type="button" onclick="event.stopPropagation(); app.openConvertBOQToTasksModal('${job.id}')" 
                                            class="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition" title="กรอกวันเริ่ม-สิ้นสุด และเลือกช่าง เพื่อแปลงเป็น Gantt Chart">
                                        <i class="ph ph-calendar-plus text-xs"></i> กำหนดวัน & ช่าง (แปลงเป็น Gantt)
                                    </button>
                                ` : `
                                    <div class="inline-flex items-center gap-1.5">
                                        ${isSelected ? `
                                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-[11px] font-bold shadow-xs">
                                                <i class="ph ph-eye text-xs"></i> กำลังแสดงผัง
                                            </span>
                                        ` : `
                                            <button type="button" onclick="event.stopPropagation(); app.selectGanttJob('${job.id}')" 
                                                    class="px-2.5 py-1 rounded-lg border border-border hover:border-brand-500 hover:text-brand-500 hover:bg-brand-500/5 bg-card text-[11px] font-medium transition cursor-pointer inline-flex items-center gap-1 shadow-2xs">
                                                <i class="ph ph-chart-bar-horizontal"></i> ดูผัง Gantt
                                            </button>
                                        `}
                                        <button type="button" onclick="event.stopPropagation(); app.openConvertBOQToTasksModal('${job.id}')" 
                                                class="px-2 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-medium transition cursor-pointer inline-flex items-center gap-1" title="แก้ไขวันเริ่ม-สิ้นสุดและทีมช่างของ Task">
                                            <i class="ph ph-pencil-simple text-xs"></i> ปรับวัน/ช่าง
                                        </button>
                                    </div>
                                `)}
                            </td>
                            <td class="py-2.5 px-3 text-right">
                                ${hasBOQ ? `
                                    <button type="button" onclick="event.stopPropagation(); app.openJobDetailBOQ('${job.id}')" 
                                            class="px-2.5 py-1 rounded-lg text-[11px] text-brand-600 dark:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 font-medium cursor-pointer inline-flex items-center gap-1 transition" title="เปิดดูรายละเอียด BOQ">
                                        <i class="ph ph-receipt"></i> ดู BOQ
                                    </button>
                                ` : `
                                    <span class="text-muted-foreground text-[10px] font-mono pr-2">-</span>
                                `}
                            </td>
                        </tr>
                        `;
                    }).join('');

                    const boqReadyCount = DB.jobs.filter(j => (j.boq_items || []).length > 0).length;
                    const boqPendingCount = DB.jobs.length - boqReadyCount;

                    stripEl.className = 'w-full';
                    stripEl.innerHTML = `
                    <div class="artifact-card overflow-hidden border border-border rounded-xl shadow-xs">
                        <div class="p-2.5 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
                            <div class="relative flex-1 min-w-[220px] max-w-sm">
                                <i class="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"></i>
                                <input type="text" 
                                       id="gantt-project-list-search" 
                                       oninput="app.filterGanttProjectTable(this.value)" 
                                       placeholder="ค้นหาตามรหัส Job, ชื่อลูกค้า, หรืองานบริการ..." 
                                       class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-card border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-foreground" />
                            </div>
                            <div class="flex items-center gap-3 text-muted-foreground text-[11px]">
                                <span>โครงการทั้งหมด: <b class="text-foreground">${DB.jobs.length}</b></span>
                                <span>•</span>
                                <span class="text-emerald-600 dark:text-emerald-400 font-medium">มี BOQ: <b>${boqReadyCount}</b></span>
                                <span>•</span>
                                <span class="text-amber-600 dark:text-amber-400 font-medium">รอ BOQ: <b>${boqPendingCount}</b></span>
                            </div>
                        </div>
                        <div class="overflow-x-auto max-h-[340px] overflow-y-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground font-semibold border-b border-border text-[11px] z-10 shadow-2xs">
                                    <tr>
                                        <th class="py-2.5 px-3">รหัสโครงการ / งาน</th>
                                        <th class="py-2.5 px-3">ลูกค้า</th>
                                        <th class="py-2.5 px-3 text-center">สถานะ BOQ</th>
                                        <th class="py-2.5 px-3 text-right">ยอดรวม (Grand Total)</th>
                                        <th class="py-2.5 px-3 text-center">Tasks แผนงาน</th>
                                        <th class="py-2.5 px-3 text-center">การวางแผนงาน & Gantt (Action)</th>
                                        <th class="py-2.5 px-3 text-right">เอกสาร BOQ</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border/60">
                                    ${jobsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    `;
                    return;
                }

                // Default: Card View
                stripEl.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3';
                const cardsHtml = DB.jobs.map(job => {
                    const isSelected = selectedFilter === job.id;
                    const boqCount = (job.boq_items || []).length;
                    const taskCount = (DB.tasks || []).filter(t => t.jobId === job.id).length;
                    const boqSum = (job.boq_items || []).reduce((acc, it) => acc + ((it.qty || 0) * (it.price || 0)), 0);
                    const discount = job.boq_discount !== undefined ? job.boq_discount : 500;
                    const grandTotal = Math.max(0, boqSum - discount) * 1.07;
                    const hasBOQ = boqCount > 0;
                    
                    return `
                    <div onclick="app.selectGanttJob('${job.id}')" 
                         class="artifact-card p-3 rounded-xl border transition-all cursor-pointer group hover:scale-[1.02] hover:shadow-md ${isSelected ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30' : 'border-border hover:border-brand-500/50 bg-card'}"
                         title="คลิกเพื่อเลือกโครงการ ${job.id} และกำหนดตารางงาน (Gantt Schedule)">
                        <div class="flex items-center justify-between gap-1 mb-1.5">
                            <span class="font-mono text-xs font-bold text-brand-500 flex items-center gap-1 group-hover:text-purple-600 transition">
                                <i class="ph ph-folder-open text-xs"></i> ${job.id}
                            </span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">${job.service}</span>
                        </div>
                        <div class="text-xs font-semibold text-foreground group-hover:text-brand-500 transition truncate" title="${job.customer}">
                            ${job.customer}
                        </div>
                        <div class="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                            <span class="flex items-center gap-1 font-mono ${hasBOQ ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-medium'}">
                                <i class="ph ${hasBOQ ? 'ph-check-circle text-emerald-500' : 'ph-warning-circle text-amber-500'}"></i> ${hasBOQ ? `${boqCount} รายการ BOQ` : 'ยังไม่มี BOQ'}
                            </span>
                            <span class="font-mono font-bold text-brand-600 dark:text-brand-400">
                                ${hasBOQ ? `฿${Math.round(grandTotal).toLocaleString('th-TH')}` : '฿0'}
                            </span>
                        </div>
                        <div class="mt-2 pt-1 flex items-center justify-between text-[10px] gap-1">
                            ${!hasBOQ ? `
                                <span class="text-amber-600 dark:text-amber-400 text-[10px] font-medium">รอการนำเข้า BOQ</span>
                                <button type="button" onclick="event.stopPropagation(); app.openImportBOQModal('${job.id}')" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium cursor-pointer shadow-xs flex items-center gap-1">
                                    <i class="ph ph-file-arrow-up"></i> นำเข้า BOQ
                                </button>
                            ` : (taskCount === 0 ? `
                                <button type="button" onclick="event.stopPropagation(); app.openConvertBOQToTasksModal('${job.id}')" class="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white text-[10px] font-bold cursor-pointer shadow-xs flex items-center justify-center gap-1">
                                    <i class="ph ph-calendar-plus text-xs"></i> กำหนดวัน & ช่าง
                                </button>
                            ` : `
                                <span class="text-purple-600 dark:text-purple-400 font-mono font-semibold flex items-center gap-1">
                                    <i class="ph ph-chart-bar-horizontal"></i> ${taskCount} Tasks
                                </span>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" onclick="event.stopPropagation(); app.openConvertBOQToTasksModal('${job.id}')" class="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium text-[10px]" title="ปรับวันเริ่ม-สิ้นสุดและทีมช่าง">
                                        <i class="ph ph-pencil-simple text-xs"></i> ปรับวัน/ช่าง
                                    </button>
                                    <span class="text-muted-foreground">•</span>
                                    <button type="button" onclick="event.stopPropagation(); app.openJobDetailBOQ('${job.id}')" class="text-brand-500 hover:underline flex items-center gap-0.5 cursor-pointer font-medium text-[10px]" title="เปิดดูตาราง BOQ">
                                        <span>ดู BOQ</span>
                                        <i class="ph ph-receipt text-xs"></i>
                                    </button>
                                </div>
                            `)}
                        </div>
                    </div>
                    `;
                }).join('');

                stripEl.innerHTML = cardsHtml;
            },

            setGanttViewMode(mode) {
                this.state.ganttViewMode = mode;
                try { localStorage.setItem('pmt_gantt_view_mode', mode); } catch (e) {}
                this.updateGanttViewModeButtons();
                this.renderGantt();
            },

            updateGanttViewModeButtons() {
                const mode = this.state.ganttViewMode || 'gantt';
                const btnGantt = document.getElementById('btn-gantt-mode-timeline');
                const btnList = document.getElementById('btn-gantt-mode-list');
                if (btnGantt && btnList) {
                    if (mode === 'gantt') {
                        btnGantt.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer bg-card text-foreground shadow-xs';
                        btnList.className = 'px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground';
                    } else {
                        btnList.className = 'px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer bg-card text-foreground shadow-xs';
                        btnGantt.className = 'px-2.5 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground';
                    }
                }
            },

            filterGanttListTable(query) {
                const q = (query || '').toLowerCase().trim();
                const rows = document.querySelectorAll('.gantt-list-row');
                rows.forEach(row => {
                    const text = row.innerText.toLowerCase();
                    row.style.display = (!q || text.includes(q)) ? '' : 'none';
                });
            },

            selectGanttJob(jobId) {
                this.state.selectedGanttJobId = jobId;
                const sel = document.getElementById('gantt-filter-job');
                if (sel && sel.value !== jobId) sel.value = jobId;
                
                if (jobId && jobId !== 'all') {
                    const job = (DB.jobs || []).find(j => j.id === jobId);
                    if (job && Array.isArray(job.boq_items) && job.boq_items.length > 0) {
                        const existing = (DB.tasks || []).filter(t => t.jobId === jobId);
                        if (existing.length === 0) {
                            this.renderGantt();
                            this.openConvertBOQToTasksModal(jobId);
                            return;
                        }
                    }
                }
                this.renderGantt();
            },

            ensureTasksFromBOQ(job) {
                if (!job || !Array.isArray(job.boq_items) || job.boq_items.length === 0) return;
                const baseDate = job.date || '2026-09-05';
                const defaultTech = job.tech || 'Team A (สมศักดิ์)';

                const isLaborItem = (item) => {
                    if (item.labor_price && Number(item.labor_price) > 0) return true;
                    if (item.mat_price && Number(item.mat_price) > 0 && (!item.labor_price || Number(item.labor_price) === 0)) {
                        const strongLabor = ['ค่าแรง', 'งานติดตั้ง', 'บริการ', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียมหน้างาน', 'ทดสอบระบบ', 'ล้าง', 'ซ่อม'];
                        return strongLabor.some(kw => (item.name || '').includes(kw));
                    }
                    const name = item.name || '';
                    const laborKeywords = ['ค่าแรง', 'งาน', 'บริการ', 'ช่าง', 'ติดตั้ง', 'สำรวจ', 'รื้อถอน', 'เดินท่อ', 'เดินสาย', 'เตรียม', 'ประกอบ', 'ทดสอบ', 'ซ่อม', 'ล้าง'];
                    const materialKeywords = ['ชุดท่อ', 'รางครอบ', 'ขาแขวน', 'เบรกเกอร์', 'ถังเก็บน้ำ', 'ปั๊มน้ำ', 'สายไฟ', 'วาล์ว', 'ฐานรอง', 'อุปกรณ์', 'อะไหล่', 'ทองแดง'];
                    const hasLabor = laborKeywords.some(kw => name.includes(kw));
                    const hasMaterial = materialKeywords.some(kw => name.includes(kw));
                    if (hasLabor && !hasMaterial) return true;
                    if (name.startsWith('ค่าแรง') || name.startsWith('งาน') || name.startsWith('บริการ')) return true;
                    return hasLabor;
                };

                const laborItems = job.boq_items.filter(isLaborItem);
                const targetItems = laborItems.length > 0 ? laborItems : job.boq_items;

                const newTasks = targetItems.map((item, idx) => {
                    const d = new Date(baseDate);
                    d.setDate(d.getDate() + idx);
                    const dateStr = d.toISOString().slice(0, 10);

                    let cleanName = item.name || `งานติดตั้ง ${idx + 1}`;
                    if (cleanName.startsWith('ค่าแรงช่าง')) {
                        cleanName = cleanName.replace(/^ค่าแรงช่าง/, 'งาน');
                    } else if (cleanName.startsWith('ค่าแรง')) {
                        cleanName = cleanName.replace(/^ค่าแรง/, 'งาน');
                    }

                    return {
                        id: `T_${job.id}_${Date.now()}_${idx + 1}`,
                        jobId: job.id,
                        name: cleanName,
                        tech: defaultTech,
                        start: dateStr,
                        end: dateStr,
                        days: 1,
                        status: 'IN_PROGRESS'
                    };
                });

                if (!DB.tasks) DB.tasks = [];
                DB.tasks = DB.tasks.filter(t => t.jobId !== job.id);
                DB.tasks.push(...newTasks);
                this.persistJobs();
                this.syncQCBookingsFromTasks();

                fetch(`/api/v1/jobs/${job.id}/tasks/import-boq`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: newTasks.map(t => ({
                            name: t.name,
                            start_date: t.start,
                            end_date: t.end,
                            duration_days: t.days,
                            assigned_tech: t.tech
                        }))
                    })
                }).catch(() => {});
            },

            updateGanttTaskField(taskId, field, value) {
                if (!DB.tasks) return;
                const task = DB.tasks.find(t => t.id === taskId);
                if (!task) return;

                if (field === 'start') {
                    task.start = value;
                    if (task.start) {
                        if (!task.end || new Date(task.end) < new Date(task.start)) {
                            const s = new Date(task.start);
                            s.setDate(s.getDate() + ((task.days || 1) - 1));
                            task.end = s.toISOString().slice(0, 10);
                        } else {
                            const s = new Date(task.start);
                            const e = new Date(task.end);
                            task.days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                        }
                    }
                } else if (field === 'end') {
                    task.end = value;
                    if (task.start && task.end) {
                        if (new Date(task.end) < new Date(task.start)) {
                            task.start = task.end;
                            task.days = 1;
                        } else {
                            const s = new Date(task.start);
                            const e = new Date(task.end);
                            task.days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                        }
                    }
                } else if (field === 'tech') {
                    task.tech = value;
                } else if (field === 'name') {
                    task.name = value;
                } else if (field === 'status') {
                    task.status = value;
                }

                // Auto sort tasks of this job by start date
                const jobTasks = DB.tasks.filter(t => t.jobId === task.jobId);
                jobTasks.sort((a, b) => {
                    const da = new Date(a.start || '9999-12-31').getTime();
                    const db = new Date(b.start || '9999-12-31').getTime();
                    if (da !== db) return da - db;
                    return (a.name || '').localeCompare(b.name || '');
                });

                this.persistJobs();
                this.syncQCBookingsFromTasks();

                if (field === 'end' || field === 'start') {
                    const qcD = this.calculateQCBookingDate(task.end || task.start, 5);
                    this.showToast(`📅 อัปเดต Task สำเร็จ พร้อมจองตรวจ QC วันที่ ${this.formatDateDMY(qcD)} (5 วันก่อนสิ้นสุด)`);
                }

                fetch(`/api/v1/jobs/${task.jobId}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: task.name,
                        start: task.start,
                        end: task.end,
                        days: task.days,
                        tech: task.tech,
                        status: task.status
                    })
                }).catch(() => {});

                this.renderGantt();
            },

            addGanttTask(jobId) {
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (!job) return;
                const jobTasks = (DB.tasks || []).filter(t => t.jobId === jobId);
                let newStart = job.date || '2026-09-05';
                if (jobTasks.length > 0) {
                    const last = jobTasks[jobTasks.length - 1];
                    if (last && last.end) {
                        const d = new Date(last.end);
                        d.setDate(d.getDate() + 1);
                        newStart = d.toISOString().slice(0, 10);
                    }
                }
                const newTask = {
                    id: `T_${jobId}_${Date.now()}`,
                    jobId: jobId,
                    name: 'งานบริการ / ติดตั้งเพิ่มเติม',
                    start: newStart,
                    end: newStart,
                    days: 1,
                    tech: job.tech || 'Team A (สมศักดิ์)',
                    status: 'IN_PROGRESS'
                };
                if (!DB.tasks) DB.tasks = [];
                DB.tasks.push(newTask);
                this.persistJobs();
                this.syncQCBookingsFromTasks();
                const qcD = this.calculateQCBookingDate(newTask.end, 5);
                this.showToast(`➕ เพิ่ม Task ใหม่สำหรับ ${jobId} พร้อมสร้างคิวจองช่าง QC (${this.formatDateDMY(qcD)})`);
                this.renderGantt();
            },

            deleteGanttTask(taskId) {
                if (!confirm('คุณต้องการลบ Task นี้ใช่หรือไม่?')) return;
                if (!DB.tasks) return;
                const task = DB.tasks.find(t => t.id === taskId);
                const jobId = task ? task.jobId : '';
                DB.tasks = DB.tasks.filter(t => t.id !== taskId);
                this.persistJobs();
                this.syncQCBookingsFromTasks();
                if (jobId) {
                    fetch(`/api/v1/jobs/${jobId}/tasks/${taskId}`, { method: 'DELETE' }).catch(() => {});
                }
                this.showToast('🗑️ ลบ Task และยกเลิกการจอง QC เรียบร้อย');
                this.renderGantt();
            },

            resetGanttTasksFromBOQ(jobId) {
                if (!confirm('คุณต้องการรีเซ็ต Task ทั้งหมดของโครงการนี้จาก BOQ ใช่หรือไม่? (ข้อมูลวันที่และช่างที่เคยตั้งค่าไว้จะถูกสร้างใหม่)')) return;
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (!job) return;
                this.ensureTasksFromBOQ(job);
                this.syncQCBookingsFromTasks();
                this.showToast(`🔄 รีเซ็ต Task จาก BOQ ของ ${jobId} และสร้างคิวจองช่าง QC ใหม่เรียบร้อย`);
                this.renderGantt();
            },

            renderGantt() {
                const jobFilterEl = document.getElementById('gantt-filter-job');
                let selectedJobFilter = this.state.selectedGanttJobId || (jobFilterEl ? jobFilterEl.value : 'all');
                if (!selectedJobFilter) selectedJobFilter = 'all';

                // Populate filter options dynamically
                this.renderGanttFilterOptions(selectedJobFilter);
                if (jobFilterEl && jobFilterEl.value !== selectedJobFilter) {
                    jobFilterEl.value = selectedJobFilter;
                }

                // Update project view mode buttons (Card vs List)
                this.updateProjectViewModeButtons();

                // Render Projects interactive strip/container (Card vs List)
                this.renderGanttProjectsStrip(selectedJobFilter);

                // Update Gantt schedule view mode buttons (Gantt vs Task Table)
                this.updateGanttViewModeButtons();

                const isListView = (this.state.ganttViewMode === 'list');
                const container = document.getElementById('gantt-container');
                if (!container) return;

                const availableTechs = [
                    'Team A (สมศักดิ์)',
                    'Team B (ประเสริฐ)',
                    'Team C (วิชัย)',
                    'ช่างอนุชา (ผู้ช่วยช่าง)',
                    'ช่างธนกฤต (ช่างแอร์)',
                    'ช่างกิตติพงษ์ (ช่างไฟฟ้า)',
                    'ช่างสมชาย (งานทั่วไป)'
                ];

                // ----------------------------------------------------
                // CASE 1: SINGLE PROJECT SELECTED
                // ----------------------------------------------------
                if (selectedJobFilter && selectedJobFilter !== 'all') {
                    const targetJob = (DB.jobs || []).find(j => j.id === selectedJobFilter);
                    if (!targetJob) {
                        container.innerHTML = `<div class="py-12 text-center text-muted-foreground text-xs">ไม่พบข้อมูลโครงการ ${selectedJobFilter}</div>`;
                        return;
                    }

                    const hasBOQ = Array.isArray(targetJob.boq_items) && targetJob.boq_items.length > 0;
                    if (!hasBOQ) {
                        // Project has NO BOQ yet
                        const countEl = document.getElementById('gantt-total-count');
                        if (countEl) countEl.innerText = '0';

                        container.innerHTML = `
                            <div class="py-12 text-center text-muted-foreground text-xs space-y-4">
                                <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto text-3xl">
                                    <i class="ph ph-warning-circle"></i>
                                </div>
                                <div class="space-y-1">
                                    <h3 class="font-display font-bold text-base text-foreground">ยังไม่มีรายการ Task ในแผนงานสำหรับ ${selectedJobFilter}</h3>
                                    <p class="text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ โครงการนี้ยังไม่มีการนำเข้า BOQ</p>
                                </div>
                                <div class="max-w-md mx-auto p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-2 text-xs text-amber-800 dark:text-amber-200">
                                    <div class="font-bold flex items-center gap-1.5">
                                        <i class="ph ph-info text-base"></i> กฎเกณฑ์ระบบ (Business Rule):
                                    </div>
                                    <p class="font-semibold text-foreground">"แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart นะครับ"</p>
                                    <p class="text-[11px] text-muted-foreground">ระบบจะดึงเฉพาะรายการค่าแรงและงานบริการติดตั้งจาก BOQ มากำหนดช่วงเวลาและทีมช่างเพื่อแสดงบน Gantt Timeline ดังนั้นจึงต้องมีรายการ BOQ ในระบบก่อนเสมอ</p>
                                </div>
                                <div class="flex items-center justify-center gap-2 pt-2">
                                    <button onclick="app.openImportBOQModal('${selectedJobFilter}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                                        <i class="ph ph-file-arrow-up text-sm"></i> 📥 นำเข้าไฟล์ BOQ (${selectedJobFilter})
                                    </button>
                                    <button onclick="app.openJobDetailBOQ('${selectedJobFilter}')" class="btn-artifact-secondary px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                                        <i class="ph ph-receipt text-sm"></i> เปิดหน้า BOQ ของโครงการ
                                    </button>
                                </div>
                            </div>
                        `;
                        return;
                    }

                    // Project HAS BOQ: Check if tasks exist
                    let jobTasks = (DB.tasks || []).filter(t => t.jobId === selectedJobFilter);
                    if (jobTasks.length === 0) {
                        const countEl = document.getElementById('gantt-total-count');
                        if (countEl) countEl.innerText = '0';

                        container.innerHTML = `
                            <div class="py-12 text-center text-muted-foreground text-xs space-y-4">
                                <div class="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 mx-auto text-3xl">
                                    <i class="ph ph-calendar-plus"></i>
                                </div>
                                <div class="space-y-1">
                                    <h3 class="font-display font-bold text-base text-foreground">โครงการ ${targetJob.id} นำเข้า BOQ เรียบร้อย (${targetJob.boq_items.length} รายการ)</h3>
                                    <p class="text-xs text-purple-600 dark:text-purple-400 font-medium">⚡ พร้อมสำหรับกำหนดวันเริ่ม-สิ้นสุด และเลือกช่าง เพื่อแปลงเป็น Gantt Chart</p>
                                </div>
                                <div class="max-w-md mx-auto p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-left space-y-2 text-xs text-purple-900 dark:text-purple-200">
                                    <div class="font-bold flex items-center gap-1.5">
                                        <i class="ph ph-info text-base"></i> ขั้นตอนการทำงาน:
                                    </div>
                                    <p class="font-semibold text-foreground">คลิกปุ่มด้านล่างเพื่อตรวจสอบรายการค่าแรง กำหนดวันเริ่ม-สิ้นสุด และเลือกทีมช่าง เพื่อแปลงเป็น Task ใน Gantt Chart</p>
                                </div>
                                <div class="flex items-center justify-center gap-2 pt-2">
                                    <button onclick="app.openConvertBOQToTasksModal('${selectedJobFilter}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white cursor-pointer">
                                        <i class="ph ph-calendar-check text-sm"></i> ⚡ กำหนดวัน & ช่าง (แปลงเป็น Gantt Chart)
                                    </button>
                                    <button onclick="app.ensureTasksFromBOQ(DB.jobs.find(j => j.id === '${selectedJobFilter}')); app.renderGantt();" class="btn-artifact-secondary px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer" title="แปลงรายการค่าแรงเป็น Task แบบด่วน">
                                        <i class="ph ph-lightning text-sm"></i> แปลงอัตโนมัติทันที
                                    </button>
                                    <button onclick="app.openJobDetailBOQ('${selectedJobFilter}')" class="btn-artifact-secondary px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer">
                                        <i class="ph ph-receipt text-sm"></i> ดูรายละเอียด BOQ
                                    </button>
                                </div>
                            </div>
                        `;
                        return;
                    }

                    const countEl = document.getElementById('gantt-total-count');
                    if (countEl) countEl.innerText = jobTasks.length;

                    // Build Task Rows for Table
                    const taskRowsHtml = jobTasks.map((t, idx) => {
                        const s = new Date(t.start || '2026-09-01');
                        const e = new Date(t.end || t.start || '2026-09-01');
                        const taskDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                        const curTech = t.tech || targetJob.tech || 'Team A (สมศักดิ์)';

                        let techOpts = availableTechs.map(tc => `<option value="${tc}" ${tc === curTech ? 'selected' : ''}>${tc}</option>`).join('');
                        if (!availableTechs.includes(curTech)) {
                            techOpts += `<option value="${curTech}" selected>${curTech}</option>`;
                        }

                        const cleanName = (t.name || '').replace(/"/g, '&quot;');
                        const qcBooking = (DB.qcBookings || []).find(b => String(b.taskId) === String(t.id));
                        const rawQcDate = qcBooking ? qcBooking.qcBookingDate : this.calculateQCBookingDate(t.end || t.start, 5);
                        const qcDateDisplay = this.formatDateDMY(rawQcDate);
                        const isQCConfirmed = qcBooking && qcBooking.status === 'CONFIRMED';
                        const qcBadgeHtml = isQCConfirmed 
                            ? `<button type="button" onclick="app.openQCFromTask('${t.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/25 transition cursor-pointer" title="จองตรวจ QC: ${qcDateDisplay} (ยืนยันช่าง QC แล้ว: ${qcBooking.assignedQCTech})">
                                <i class="ph ph-check-circle text-xs"></i>
                                <span>QC: ${qcDateDisplay} (Confirmed)</span>
                              </button>`
                            : `<button type="button" onclick="app.openQCFromTask('${t.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/25 transition cursor-pointer" title="จองช่าง QC ล่วงหน้า 5 วันก่อนวันสิ้นสุด - คลิกเพื่อยืนยันช่าง QC">
                                <i class="ph ph-calendar-check text-xs"></i>
                                <span>จอง QC: ${qcDateDisplay}</span>
                                <span class="underline font-bold ml-0.5">Confirm</span>
                              </button>`;

                        return `
                        <tr class="hover:bg-muted/20 transition gantt-list-row">
                            <td class="py-2.5 px-3 text-center font-mono text-muted-foreground font-semibold text-xs">${idx + 1}</td>
                            <td class="py-2.5 px-3">
                                <input type="text" value="${cleanName}" onchange="app.updateGanttTaskField('${t.id}', 'name', this.value)" class="w-full bg-card/60 hover:bg-card focus:bg-card border border-border/60 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition focus:outline-none" placeholder="ชื่องานบริการ / Task">
                            </td>
                            <td class="py-2.5 px-3">
                                <input type="date" value="${t.start || '2026-09-05'}" onchange="app.updateGanttTaskField('${t.id}', 'start', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none cursor-pointer">
                            </td>
                            <td class="py-2.5 px-3">
                                <input type="date" value="${t.end || t.start || '2026-09-05'}" onchange="app.updateGanttTaskField('${t.id}', 'end', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none cursor-pointer">
                            </td>
                            <td class="py-2.5 px-2 text-center">
                                <span class="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    ${taskDays} วัน
                                </span>
                            </td>
                            <td class="py-2.5 px-3 whitespace-nowrap">
                                ${qcBadgeHtml}
                            </td>
                            <td class="py-2.5 px-3">
                                <select onchange="app.updateGanttTaskField('${t.id}', 'tech', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none cursor-pointer">
                                    ${techOpts}
                                </select>
                            </td>
                            <td class="py-2.5 px-3">
                                <select onchange="app.updateGanttTaskField('${t.id}', 'status', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-[11px] font-medium focus:outline-none cursor-pointer">
                                    <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>กำลังทำ</option>
                                    <option value="DONE" ${t.status === 'DONE' ? 'selected' : ''}>เสร็จสิ้น</option>
                                    <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>รอดำเนินการ</option>
                                </select>
                            </td>
                            <td class="py-2.5 px-2 text-center">
                                <button type="button" onclick="app.deleteGanttTask('${t.id}')" class="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition cursor-pointer" title="ลบ Task นี้">
                                    <i class="ph ph-trash text-sm"></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    }).join('');

                    // --- IF LIST VIEW MODE ---
                    if (isListView) {
                        const doneCount = jobTasks.filter(t => t.status === 'DONE').length;
                        const inProgCount = jobTasks.filter(t => t.status === 'IN_PROGRESS').length;

                        container.innerHTML = `
                            <div class="space-y-4">
                                <!-- List View Header Toolbar -->
                                <div class="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-mono text-sm font-bold text-brand-500">${targetJob.id}</span>
                                            <span class="text-xs font-bold text-foreground">${targetJob.customer}</span>
                                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">✓ นำเข้า BOQ แล้ว (${targetJob.boq_items.length} รายการ)</span>
                                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">${jobTasks.length} Tasks</span>
                                        </div>
                                        <p class="text-[11px] text-muted-foreground mt-1">${targetJob.service} • มุมมองตารางรายการ (List View) กำหนดวันเริ่ม-สิ้นสุด และระบบจองช่าง QC ล่วงหน้า 5 วันอัตโนมัติ</p>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <button type="button" onclick="app.addGanttTask('${selectedJobFilter}')" class="btn-artifact-primary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white cursor-pointer">
                                            <i class="ph ph-plus-circle text-sm"></i>
                                            <span>+ แทรก Task งาน</span>
                                        </button>
                                        <button type="button" onclick="app.resetGanttTasksFromBOQ('${selectedJobFilter}')" class="btn-artifact-secondary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer" title="ดึงรายการค่าแรงจาก BOQ มาสร้าง Task ใหม่">
                                            <i class="ph ph-arrows-clockwise text-sm"></i>
                                            <span>รีเซ็ตจาก BOQ</span>
                                        </button>
                                        <button type="button" onclick="app.setGanttViewMode('gantt')" class="btn-artifact-secondary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/10 cursor-pointer" title="สลับเป็นแผนภูมิแท่ง Gantt Chart">
                                            <i class="ph ph-chart-bar-horizontal text-sm"></i>
                                            <span>ดูกราฟ Gantt</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Full-Width List View Table -->
                                <div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
                                    <table class="w-full text-left text-xs">
                                        <thead class="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                                            <tr>
                                                <th class="py-3 px-3.5 w-12 text-center font-bold">#</th>
                                                <th class="py-3 px-3.5 min-w-[220px] font-bold">ชื่องานบริการ / Task</th>
                                                <th class="py-3 px-3.5 w-36 font-bold">วันเริ่ม (Start)</th>
                                                <th class="py-3 px-3.5 w-36 font-bold">วันสิ้นสุด (End)</th>
                                                <th class="py-3 px-2.5 text-center w-20 font-bold">ระยะเวลา</th>
                                                <th class="py-3 px-3.5 w-44 font-bold text-brand-600 dark:text-brand-400">จองตรวจ QC (D-5)</th>
                                                <th class="py-3 px-3.5 w-48 font-bold">ช่างผู้รับผิดชอบ</th>
                                                <th class="py-3 px-3.5 w-28 font-bold">สถานะ</th>
                                                <th class="py-3 px-2.5 w-12 text-center font-bold">ลบ</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-border">
                                            ${taskRowsHtml || '<tr><td colspan="9" class="py-8 text-center text-muted-foreground text-xs">ยังไม่มีรายการ Task ในโครงการนี้</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>

                                <!-- List Summary Bar -->
                                <div class="flex items-center justify-between text-xs text-muted-foreground px-2 pt-1">
                                    <div class="flex items-center gap-3">
                                        <span>รวมทั้งหมด <strong class="text-foreground">${jobTasks.length}</strong> งาน</span>
                                        <span>•</span>
                                        <span class="text-emerald-600 dark:text-emerald-400 font-medium">เสร็จสิ้น ${doneCount} งาน</span>
                                        <span>•</span>
                                        <span class="text-brand-500 font-medium">กำลังทำ ${inProgCount} งาน</span>
                                    </div>
                                    <div>
                                        <span>ช่างรับผิดชอบหลัก: <strong class="text-foreground">${targetJob.tech || 'Team A'}</strong></span>
                                    </div>
                                </div>
                            </div>
                        `;
                        return;
                    }

                    // --- IF GANTT TIMELINE MODE ---
                    // Calculate timeline dates for Gantt Bars
                    let minTimestamp = Infinity;
                    let maxTimestamp = -Infinity;
                    jobTasks.forEach(t => {
                        const s = new Date(t.start || '2026-09-01').getTime();
                        let e = t.end ? new Date(t.end).getTime() : s;
                        if (s < minTimestamp) minTimestamp = s;
                        if (e > maxTimestamp) maxTimestamp = e;
                    });
                    if (minTimestamp === Infinity) {
                        minTimestamp = new Date('2026-09-01').getTime();
                        maxTimestamp = new Date('2026-09-10').getTime();
                    }

                    const oneDayMs = 1000 * 60 * 60 * 24;
                    const totalDays = Math.max(10, Math.round((maxTimestamp - minTimestamp) / oneDayMs) + 2);
                    const timelineDates = [];
                    const startDateObj = new Date(minTimestamp);
                    for (let i = 0; i < totalDays; i++) {
                        const cur = new Date(startDateObj);
                        cur.setDate(cur.getDate() + i);
                        timelineDates.push(cur);
                    }

                    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                    const dayHeaderHtml = timelineDates.map(d => {
                        const dayNum = String(d.getDate()).padStart(2, '0');
                        const monthStr = monthNames[d.getMonth()];
                        return `<div class="flex-1 text-center text-[10px] font-mono text-muted-foreground border-l border-border pb-1.5 px-0.5 truncate" title="${d.toISOString().slice(0, 10)}">${dayNum} ${monthStr}</div>`;
                    }).join('');

                    const dateRangeLabel = document.getElementById('gantt-date-range-label');
                    if (dateRangeLabel) {
                        const firstD = timelineDates[0];
                        const lastD = timelineDates[timelineDates.length - 1];
                        dateRangeLabel.innerText = `ช่วงเวลา: ${String(firstD.getDate()).padStart(2, '0')} ${monthNames[firstD.getMonth()]} - ${String(lastD.getDate()).padStart(2, '0')} ${monthNames[lastD.getMonth()]} ${lastD.getFullYear()}`;
                    }

                    const ganttRowsHtml = jobTasks.map(t => {
                        const taskStart = new Date(t.start || '2026-09-01').getTime();
                        let taskDays = t.days || 1;
                        if (t.end && t.start) {
                            const s = new Date(t.start);
                            const e = new Date(t.end);
                            taskDays = Math.max(1, Math.round((e - s) / oneDayMs) + 1);
                        }

                        const diffFromMin = Math.max(0, Math.round((taskStart - minTimestamp) / oneDayMs));
                        const offsetPercent = Math.min(95, (diffFromMin / totalDays) * 100);
                        const widthPercent = Math.max(4, Math.min(100 - offsetPercent, (taskDays / totalDays) * 100));

                        let bgClass = 'bg-muted text-muted-foreground border-border';
                        if (t.status === 'DONE') bgClass = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-semibold';
                        else if (t.status === 'IN_PROGRESS') bgClass = 'bg-gradient-to-r from-purple-500/20 to-brand-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-xs font-semibold';

                        const endDateStr = t.end || t.start;
                        const qcBooking = (DB.qcBookings || []).find(b => String(b.taskId) === String(t.id));
                        const rawQcDate = qcBooking ? qcBooking.qcBookingDate : this.calculateQCBookingDate(endDateStr, 5);
                        const qcDateDisplay = this.formatDateDMY(rawQcDate);

                        return `
                        <div class="flex items-center border-t border-border py-2.5 relative h-13 hover:bg-muted/20 transition group">
                            <div class="w-64 shrink-0 text-xs font-medium text-foreground truncate pr-4">
                                <div class="truncate font-semibold text-foreground">${t.name}</div>
                                <div class="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                                    <span>📅 ${this.formatDateDMY(t.start)} ถึง ${this.formatDateDMY(endDateStr)} (${taskDays} วัน)</span>
                                    <span onclick="app.openQCFromTask('${t.id}')" class="text-brand-500 hover:underline cursor-pointer flex items-center gap-0.5" title="คลิกเพื่อดูการจองช่าง QC"><i class="ph ph-shield-check text-[11px]"></i> จอง QC: ${qcDateDisplay}</span>
                                </div>
                            </div>
                            <div class="flex-1 relative h-full flex items-center">
                                <div class="${bgClass} border absolute h-8 rounded-lg text-[11px] px-2.5 flex items-center justify-between truncate shadow-xs transition hover:brightness-105 cursor-pointer hover:ring-2 hover:ring-brand-500/40" style="left: ${offsetPercent}%; width: ${widthPercent}%; min-width: 80px;" title="${t.name} (${this.formatDateDMY(t.start)} ถึง ${this.formatDateDMY(endDateStr)} - ${t.tech}) | จองตรวจ QC: ${qcDateDisplay}">
                                    <span class="truncate font-medium flex items-center gap-1"><i class="ph ph-user text-[11px]"></i> ${t.tech}</span>
                                    <span class="text-[10px] opacity-90 ml-1 font-mono font-bold bg-card/60 px-1 py-0.5 rounded">${taskDays}d</span>
                                </div>
                            </div>
                        </div>`;
                    }).join('');

                    container.innerHTML = `
                        <!-- Task Scheduler & Assignment Section -->
                        <div class="mb-6 p-4 rounded-2xl bg-card border border-border space-y-3.5 shadow-xs">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-mono text-sm font-bold text-brand-500">${targetJob.id}</span>
                                        <span class="text-xs font-bold text-foreground">${targetJob.customer}</span>
                                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">✓ นำเข้า BOQ แล้ว (${targetJob.boq_items.length} รายการ)</span>
                                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">${jobTasks.length} Tasks</span>
                                    </div>
                                    <p class="text-[11px] text-muted-foreground mt-1">${targetJob.service} • กำหนดวันเริ่ม-สิ้นสุด และเลือกช่างผู้รับผิดชอบในแต่ละ Task ได้โดยตรง ระบบจะสร้างงานจองช่าง QC ล่วงหน้า 5 วันอัตโนมัติ</p>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button type="button" onclick="app.addGanttTask('${selectedJobFilter}')" class="btn-artifact-primary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white cursor-pointer">
                                        <i class="ph ph-plus-circle text-sm"></i>
                                        <span>+ แทรก Task งาน</span>
                                    </button>
                                    <button type="button" onclick="app.resetGanttTasksFromBOQ('${selectedJobFilter}')" class="btn-artifact-secondary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer" title="ดึงรายการค่าแรงจาก BOQ มาสร้าง Task ใหม่">
                                        <i class="ph ph-arrows-clockwise text-sm"></i>
                                        <span>รีเซ็ตจาก BOQ</span>
                                    </button>
                                    <button type="button" onclick="app.setGanttViewMode('list')" class="btn-artifact-secondary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/10 cursor-pointer" title="สลับเป็นมุมมองตาราง List View">
                                        <i class="ph ph-list-bullets text-sm"></i>
                                        <span>สลับเป็น List View</span>
                                    </button>
                                </div>
                            </div>
                            <div class="overflow-x-auto rounded-xl border border-border bg-muted/10">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                                        <tr>
                                            <th class="py-2.5 px-3 w-10 text-center">#</th>
                                            <th class="py-2.5 px-3 min-w-[200px]">ชื่องานบริการ / Task</th>
                                            <th class="py-2.5 px-3 w-36">วันเริ่ม (Start Date)</th>
                                            <th class="py-2.5 px-3 w-36">วันสิ้นสุด (End Date)</th>
                                            <th class="py-2.5 px-2 text-center w-20">ระยะเวลา</th>
                                            <th class="py-2.5 px-3 w-44 font-bold text-brand-600 dark:text-brand-400">จองตรวจ QC (D-5)</th>
                                            <th class="py-2.5 px-3 w-48">ช่างผู้รับผิดชอบ</th>
                                            <th class="py-2.5 px-3 w-28">สถานะ</th>
                                            <th class="py-2.5 px-2 w-10 text-center">ลบ</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border">
                                        ${taskRowsHtml || '<tr><td colspan="9" class="py-6 text-center text-muted-foreground text-xs">ยังไม่มีรายการ Task ในโครงการนี้</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Gantt Visual Chart Section -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-xs text-muted-foreground px-1">
                                <span class="font-semibold text-foreground flex items-center gap-1.5">
                                    <i class="ph ph-chart-bar text-brand-500"></i> แผนภูมิแท่งแสดงช่วงเวลา (Gantt Timeline Chart):
                                </span>
                                <span class="text-[11px]">แถบสีจะเปลี่ยนตามวันเริ่ม-สิ้นสุด และสถานะงานอัตโนมัติ</span>
                            </div>
                            <div class="border border-border rounded-2xl p-4 bg-card">
                                <div class="flex border-b border-border mb-2 pb-1">
                                    <div class="w-64 shrink-0 text-xs font-bold text-muted-foreground">รายการงาน & วันเริ่ม-สิ้นสุด</div>
                                    <div class="flex-1 flex">${dayHeaderHtml}</div>
                                </div>
                                ${ganttRowsHtml}
                            </div>
                        </div>
                    `;
                    return;
                }

                // ----------------------------------------------------
                // CASE 2: ALL JOBS VIEW
                // ----------------------------------------------------
                let tasks = DB.tasks || [];
                const countEl = document.getElementById('gantt-total-count');
                if (countEl) countEl.innerText = tasks.length;

                if (tasks.length === 0) {
                    const firstJobWithBOQ = (DB.jobs || []).find(j => Array.isArray(j.boq_items) && j.boq_items.length > 0);
                    const firstPendingBOQ = (DB.jobs || []).find(j => !Array.isArray(j.boq_items) || j.boq_items.length === 0);

                    container.innerHTML = `
                        <div class="py-12 text-center text-muted-foreground text-xs space-y-4">
                            <div class="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground mx-auto text-3xl">
                                <i class="ph ph-calendar-blank"></i>
                            </div>
                            <div class="space-y-1">
                                <h3 class="font-display font-bold text-base text-foreground">เลือกโครงการด้านบนเพื่อเริ่มวางแผนงาน</h3>
                                <p class="text-xs text-muted-foreground">📌 คลิกที่โครงการที่มี BOQ เพื่อดูรายการ Task กำหนดวันเริ่ม-สิ้นสุด และมอบหมายช่างในแต่ละ Task ได้ทันที</p>
                            </div>
                            <p class="text-[11px] text-muted-foreground max-w-lg mx-auto">โครงการที่นำเข้า BOQ เรียบร้อยแล้ว สามารถคลิกปุ่ม <strong>"กำหนดวัน & ช่าง"</strong> เพื่อแปลงเป็นผัง Gantt Chart ได้ทันที</p>
                            <div class="flex items-center justify-center gap-2 pt-2 flex-wrap">
                                ${firstJobWithBOQ ? `
                                    <button onclick="app.openConvertBOQToTasksModal('${firstJobWithBOQ.id}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-purple-600 to-brand-600 hover:from-purple-700 hover:to-brand-700 text-white cursor-pointer">
                                        <i class="ph ph-calendar-check text-sm"></i> ⚡ กำหนดวัน & ช่าง: โครงการ ${firstJobWithBOQ.id} (${firstJobWithBOQ.customer})
                                    </button>
                                ` : (firstPendingBOQ ? `
                                    <button onclick="app.openImportBOQModal('${firstPendingBOQ.id}')" class="btn-artifact-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                                        <i class="ph ph-file-arrow-up text-sm"></i> 📥 นำเข้า BOQ (${firstPendingBOQ.id})
                                    </button>
                                ` : '')}
                                <button onclick="app.navigate('jobs')" class="btn-artifact-secondary px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                                    <i class="ph ph-list-dashes text-sm"></i> ไปที่รายการงานทั้งหมด
                                </button>
                            </div>
                        </div>
                    `;
                    return;
                }

                // --- ALL JOBS: IF LIST VIEW MODE ---
                if (isListView) {
                    const doneCount = tasks.filter(t => t.status === 'DONE').length;
                    const inProgCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
                    const todoCount = tasks.filter(t => t.status === 'TODO' || !t.status).length;

                    const allRowsHtml = tasks.map((t, idx) => {
                        const targetJob = (DB.jobs || []).find(j => j.id === t.jobId) || {};
                        const s = new Date(t.start || '2026-09-01');
                        const e = new Date(t.end || t.start || '2026-09-01');
                        const taskDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                        const curTech = t.tech || targetJob.tech || 'Team A (สมศักดิ์)';

                        let techOpts = availableTechs.map(tc => `<option value="${tc}" ${tc === curTech ? 'selected' : ''}>${tc}</option>`).join('');
                        if (!availableTechs.includes(curTech)) {
                            techOpts += `<option value="${curTech}" selected>${curTech}</option>`;
                        }

                        const cleanName = (t.name || '').replace(/"/g, '&quot;');
                        const custName = targetJob.customer || 'ลูกค้า';

                        const qcBooking = (DB.qcBookings || []).find(b => String(b.taskId) === String(t.id));
                        const rawQcDate = qcBooking ? qcBooking.qcBookingDate : this.calculateQCBookingDate(t.end || t.start, 5);
                        const qcDateDisplay = this.formatDateDMY(rawQcDate);
                        const isQCConfirmed = qcBooking && qcBooking.status === 'CONFIRMED';
                        const qcBadgeHtml = isQCConfirmed 
                            ? `<button type="button" onclick="app.openQCFromTask('${t.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/25 transition cursor-pointer" title="จองตรวจ QC: ${qcDateDisplay} (ยืนยันช่าง QC แล้ว: ${qcBooking.assignedQCTech})">
                                <i class="ph ph-check-circle text-xs"></i>
                                <span>QC: ${qcDateDisplay} (Confirmed)</span>
                              </button>`
                            : `<button type="button" onclick="app.openQCFromTask('${t.id}')" class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/25 transition cursor-pointer" title="จองช่าง QC ล่วงหน้า 5 วันก่อนวันสิ้นสุด - คลิกเพื่อยืนยันช่าง QC">
                                <i class="ph ph-calendar-check text-xs"></i>
                                <span>จอง QC: ${qcDateDisplay}</span>
                                <span class="underline font-bold ml-0.5">Confirm</span>
                              </button>`;

                        return `
                        <tr class="hover:bg-muted/20 transition gantt-list-row">
                            <td class="py-2.5 px-3 text-center font-mono text-muted-foreground font-semibold text-xs">${idx + 1}</td>
                            <td class="py-2.5 px-3">
                                <button type="button" onclick="app.selectGanttJob('${t.jobId}')" class="font-mono text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-xs transition cursor-pointer flex items-center gap-1 inline-flex" title="คลิกเพื่อเลือกโครงการ ${t.jobId}">
                                    <i class="ph ph-folder text-xs"></i> ${t.jobId}
                                </button>
                                <div class="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title="${custName}">คุณ${custName}</div>
                            </td>
                            <td class="py-2.5 px-3">
                                <input type="text" value="${cleanName}" onchange="app.updateGanttTaskField('${t.id}', 'name', this.value)" class="w-full bg-card/60 hover:bg-card focus:bg-card border border-border/60 focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition focus:outline-none" placeholder="ชื่องานบริการ / Task">
                            </td>
                            <td class="py-2.5 px-3">
                                <input type="date" value="${t.start || '2026-09-05'}" onchange="app.updateGanttTaskField('${t.id}', 'start', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none cursor-pointer">
                            </td>
                            <td class="py-2.5 px-3">
                                <input type="date" value="${t.end || t.start || '2026-09-05'}" onchange="app.updateGanttTaskField('${t.id}', 'end', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none cursor-pointer">
                            </td>
                            <td class="py-2.5 px-2 text-center">
                                <span class="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    ${taskDays} วัน
                                </span>
                            </td>
                            <td class="py-2.5 px-3 whitespace-nowrap">
                                ${qcBadgeHtml}
                            </td>
                            <td class="py-2.5 px-3">
                                <select onchange="app.updateGanttTaskField('${t.id}', 'tech', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-xs text-foreground font-medium focus:outline-none cursor-pointer">
                                    ${techOpts}
                                </select>
                            </td>
                            <td class="py-2.5 px-3">
                                <select onchange="app.updateGanttTaskField('${t.id}', 'status', this.value)" class="w-full bg-card border border-border focus:border-brand-500 rounded-lg px-2 py-1.5 text-[11px] font-medium focus:outline-none cursor-pointer">
                                    <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>กำลังทำ</option>
                                    <option value="DONE" ${t.status === 'DONE' ? 'selected' : ''}>เสร็จสิ้น</option>
                                    <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>รอดำเนินการ</option>
                                </select>
                            </td>
                            <td class="py-2.5 px-2 text-center">
                                <button type="button" onclick="app.deleteGanttTask('${t.id}')" class="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition cursor-pointer" title="ลบ Task นี้">
                                    <i class="ph ph-trash text-sm"></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    }).join('');

                    container.innerHTML = `
                        <div class="space-y-4">
                            <!-- All Jobs List View Toolbar -->
                            <div class="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center text-lg font-bold">
                                        <i class="ph ph-list-bullets"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h3 class="font-display font-bold text-sm text-foreground">รายการแผนงานติดตั้งทั้งหมด (All Tasks List View)</h3>
                                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold">${tasks.length} Tasks</span>
                                        </div>
                                        <div class="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                            <span class="text-emerald-600 dark:text-emerald-400 font-medium">✓ เสร็จสิ้น ${doneCount}</span>
                                            <span>•</span>
                                            <span class="text-brand-500 font-medium">⚡ กำลังทำ ${inProgCount}</span>
                                            <span>•</span>
                                            <span>⏳ รอดำเนินการ ${todoCount}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="relative w-56">
                                        <i class="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"></i>
                                        <input type="text" oninput="app.filterGanttListTable(this.value)" placeholder="ค้นหางาน, โครงการ, ช่าง..." class="w-full bg-muted/40 border border-border focus:border-brand-500 rounded-xl pl-7 pr-3 py-1.5 text-xs text-foreground focus:outline-none transition">
                                    </div>
                                    <button type="button" onclick="app.setGanttViewMode('gantt')" class="btn-artifact-secondary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/10 cursor-pointer" title="สลับเป็นแผนภูมิแท่ง Gantt Chart">
                                        <i class="ph ph-chart-bar-horizontal text-sm"></i>
                                        <span>ดูกราฟ Gantt</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Master Tasks Table -->
                            <div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                                        <tr>
                                            <th class="py-3 px-3 w-10 text-center font-bold">#</th>
                                            <th class="py-3 px-3 w-36 font-bold">โครงการ</th>
                                            <th class="py-3 px-3 min-w-[200px] font-bold">ชื่องานบริการ / Task</th>
                                            <th class="py-3 px-3 w-36 font-bold">วันเริ่ม (Start)</th>
                                            <th class="py-3 px-3 w-36 font-bold">วันสิ้นสุด (End)</th>
                                            <th class="py-3 px-2 text-center w-20 font-bold">ระยะเวลา</th>
                                            <th class="py-3 px-3 w-44 font-bold text-brand-600 dark:text-brand-400">จองตรวจ QC (D-5)</th>
                                            <th class="py-3 px-3 w-48 font-bold">ช่างผู้รับผิดชอบ</th>
                                            <th class="py-3 px-3 w-28 font-bold">สถานะ</th>
                                            <th class="py-3 px-2 w-10 text-center font-bold">ลบ</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-border">
                                        ${allRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                    return;
                }

                // --- ALL JOBS: IF GANTT TIMELINE MODE ---
                // Calculate timeline dates for All Jobs
                let minTimestamp = Infinity;
                let maxTimestamp = -Infinity;
                tasks.forEach(t => {
                    const s = new Date(t.start || '2026-09-01').getTime();
                    let e = t.end ? new Date(t.end).getTime() : s;
                    if (s < minTimestamp) minTimestamp = s;
                    if (e > maxTimestamp) maxTimestamp = e;
                });
                if (minTimestamp === Infinity) {
                    minTimestamp = new Date('2026-09-01').getTime();
                    maxTimestamp = new Date('2026-09-10').getTime();
                }

                const oneDayMs = 1000 * 60 * 60 * 24;
                const totalDays = Math.max(10, Math.round((maxTimestamp - minTimestamp) / oneDayMs) + 2);
                const timelineDates = [];
                const startDateObj = new Date(minTimestamp);
                for (let i = 0; i < totalDays; i++) {
                    const cur = new Date(startDateObj);
                    cur.setDate(cur.getDate() + i);
                    timelineDates.push(cur);
                }

                const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                const dayHeaderHtml = timelineDates.map(d => {
                    const dayNum = String(d.getDate()).padStart(2, '0');
                    const monthStr = monthNames[d.getMonth()];
                    return `<div class="flex-1 text-center text-[10px] font-mono text-muted-foreground border-l border-border pb-1.5 px-0.5 truncate" title="${d.toISOString().slice(0, 10)}">${dayNum} ${monthStr}</div>`;
                }).join('');

                const dateRangeLabel = document.getElementById('gantt-date-range-label');
                if (dateRangeLabel) {
                    const firstD = timelineDates[0];
                    const lastD = timelineDates[timelineDates.length - 1];
                    dateRangeLabel.innerText = `ช่วงเวลา: ${String(firstD.getDate()).padStart(2, '0')}/${String(firstD.getMonth() + 1).padStart(2, '0')}/${firstD.getFullYear()} - ${String(lastD.getDate()).padStart(2, '0')}/${String(lastD.getMonth() + 1).padStart(2, '0')}/${lastD.getFullYear()}`;
                }

                const rowsHtml = tasks.map(t => {
                    const taskStart = new Date(t.start || '2026-09-01').getTime();
                    let taskDays = t.days || 1;
                    if (t.end && t.start) {
                        const s = new Date(t.start);
                        const e = new Date(t.end);
                        taskDays = Math.max(1, Math.round((e - s) / oneDayMs) + 1);
                    }

                    const diffFromMin = Math.max(0, Math.round((taskStart - minTimestamp) / oneDayMs));
                    const offsetPercent = Math.min(95, (diffFromMin / totalDays) * 100);
                    const widthPercent = Math.max(4, Math.min(100 - offsetPercent, (taskDays / totalDays) * 100));

                    let bgClass = 'bg-muted text-muted-foreground border-border';
                    if (t.status === 'DONE') bgClass = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-semibold';
                    else if (t.status === 'IN_PROGRESS') bgClass = 'bg-gradient-to-r from-purple-500/20 to-brand-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-xs font-semibold';

                    const endDateStr = t.end || t.start;
                    const qcBooking = (DB.qcBookings || []).find(b => String(b.taskId) === String(t.id));
                    const rawQcDate = qcBooking ? qcBooking.qcBookingDate : this.calculateQCBookingDate(endDateStr, 5);
                    const qcDateDisplay = this.formatDateDMY(rawQcDate);

                    return `
                    <div class="flex items-center border-t border-border py-2.5 relative h-13 hover:bg-muted/20 transition group">
                        <div class="w-64 shrink-0 text-xs font-medium text-foreground truncate pr-4">
                            <div class="flex items-center gap-1.5">
                                <button onclick="app.selectGanttJob('${t.jobId}')" class="font-mono text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-[11px] transition cursor-pointer flex items-center gap-1" title="คลิกเพื่อเปิดดูและแก้ไข Task ของ ${t.jobId}">
                                    <i class="ph ph-folder text-[10px]"></i> ${t.jobId}
                                </button>
                                <span onclick="app.selectGanttJob('${t.jobId}')" class="truncate font-medium text-foreground hover:text-brand-500 cursor-pointer transition" title="คลิกเพื่อเลือก ${t.jobId}">${t.name}</span>
                            </div>
                            <div class="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                                <span>📅 ${this.formatDateDMY(t.start)} ถึง ${this.formatDateDMY(endDateStr)} (${taskDays} วัน)</span>
                                <span onclick="app.openQCFromTask('${t.id}')" class="text-brand-500 hover:underline cursor-pointer flex items-center gap-0.5" title="คลิกเพื่อดูการจองช่าง QC"><i class="ph ph-shield-check text-[11px]"></i> จอง QC: ${qcDateDisplay}</span>
                            </div>
                        </div>
                        <div class="flex-1 relative h-full flex items-center">
                            <div onclick="app.selectGanttJob('${t.jobId}')" class="${bgClass} border absolute h-8 rounded-lg text-[11px] px-2.5 flex items-center justify-between truncate shadow-xs transition hover:brightness-105 cursor-pointer hover:ring-2 hover:ring-brand-500/40" style="left: ${offsetPercent}%; width: ${widthPercent}%; min-width: 80px;" title="${t.name} (${this.formatDateDMY(t.start)} ถึง ${this.formatDateDMY(endDateStr)} - ${t.tech}) | จองตรวจ QC: ${qcDateDisplay}">
                                <span class="truncate font-medium flex items-center gap-1"><i class="ph ph-user text-[11px]"></i> ${t.tech}</span>
                                <span class="text-[10px] opacity-90 ml-1 font-mono font-bold bg-card/60 px-1 py-0.5 rounded">${taskDays}d</span>
                            </div>
                        </div>
                    </div>`;
                }).join('');

                const html = `
                    <div class="flex border-b border-border mb-2 pb-1">
                        <div class="w-64 shrink-0 text-xs font-bold text-muted-foreground">รายการงาน & วันเริ่ม-สิ้นสุด (คลิกเพื่อแก้ไข)</div>
                        <div class="flex-1 flex">${dayHeaderHtml}</div>
                    </div>
                    ${rowsHtml}
                `;
                container.innerHTML = html;
            },

            renderQC() {
                this.updateQCBadges();
                const currentTab = this.state.qcTab || 'bookings';

                if (currentTab === 'bookings') {
                    const bookings = DB.qcBookings || [];
                    const listHtml = bookings.map(b => {
                        const isConfirmed = b.status === 'CONFIRMED';
                        const statusBadge = isConfirmed
                            ? `<span class="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold flex items-center gap-1"><i class="ph ph-check-circle"></i> ยืนยันแล้ว</span>`
                            : `<span class="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-bold flex items-center gap-1"><i class="ph ph-clock"></i> รอ Confirm</span>`;

                        const isSelected = this.state.selectedQCBookingId === b.id;
                        const cardBg = isSelected 
                            ? 'bg-brand-500/10 border-brand-500 ring-1 ring-brand-500/40' 
                            : 'bg-muted/40 border-border hover:border-brand-500/40';

                        return `
                        <div class="p-3.5 rounded-xl ${cardBg} border transition-all cursor-pointer group" onclick="app.selectQCBooking('${b.id}')">
                            <div class="flex items-center justify-between mb-1">
                                <div class="flex items-center gap-1.5">
                                    <span class="font-mono text-xs font-bold text-brand-500">${b.jobId}</span>
                                    <span class="text-[10px] text-muted-foreground font-mono truncate max-w-[90px]" title="${b.taskId}">(${b.taskId})</span>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="text-xs font-semibold text-foreground group-hover:text-brand-500 transition truncate">${b.taskName}</div>
                            <div class="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                                <span class="truncate">ลูกค้า: ${b.customerName || 'ลูกค้า'}</span>
                                <span class="font-mono text-[10px] text-brand-600 dark:text-brand-400 font-bold">📅 ${this.formatDateDMY(b.qcBookingDate)}</span>
                            </div>
                            <div class="text-[10px] text-muted-foreground/80 mt-1 flex items-center justify-between border-t border-border/50 pt-1">
                                <span>ช่างหน้างาน: ${b.assignedTech}</span>
                                <span class="text-foreground/80 font-medium">QC: ${b.assignedQCTech.split(' ')[0]}</span>
                            </div>
                        </div>
                        `;
                    }).join('');

                    document.getElementById('qc-queue-list').innerHTML = listHtml || `
                        <div class="text-xs text-muted-foreground text-center py-12 space-y-2">
                            <i class="ph ph-calendar-x text-2xl text-muted-foreground/60 block"></i>
                            <div>ยังไม่มีรายการจองคิวช่าง QC</div>
                            <button onclick="app.navigate('gantt')" class="text-brand-500 hover:underline text-[11px] font-medium cursor-pointer">+ ไปยัง Gantt Chart เพื่อสร้าง Task</button>
                        </div>
                    `;

                    // Auto-select first booking if none selected or selected not in list
                    if (bookings.length > 0) {
                        const targetId = this.state.selectedQCBookingId && bookings.some(b => b.id === this.state.selectedQCBookingId)
                            ? this.state.selectedQCBookingId
                            : bookings[0].id;
                        this.selectQCBooking(targetId);
                    } else {
                        document.getElementById('qc-form-container').innerHTML = `
                            <div class="h-full flex flex-col items-center justify-center text-center p-8">
                                <div class="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground mb-4">
                                    <i class="ph ph-calendar-blank text-3xl"></i>
                                </div>
                                <h4 class="font-display font-medium text-foreground text-base mb-1">ยังไม่มีรายการจองช่าง QC</h4>
                                <p class="text-xs text-muted-foreground max-w-sm">เมื่อมีการสร้างหรือบันทึก End Date ของแต่ละ Task ใน Gantt Timeline ระบบจะสร้างงานจองคิวตรวจคุณภาพล่วงหน้า 5 วันอัตโนมัติ</p>
                            </div>
                        `;
                    }
                } else {
                    // Pending Inspection Tab
                    const qcJobs = DB.jobs.filter(j => j.status === 'QC_PENDING');
                    const listHtml = qcJobs.map(j => `
                        <div class="p-3.5 rounded-xl bg-muted/40 border border-border hover:border-brand-500/40 transition-all cursor-pointer group" onclick="app.selectQCJob('${j.id}')">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-mono text-xs font-bold text-brand-500">${j.id}</span>
                                <span class="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">รอตรวจ</span>
                            </div>
                            <div class="text-xs font-medium text-foreground group-hover:text-brand-500 transition">${j.customer}</div>
                            <div class="text-[11px] text-muted-foreground mt-1">${j.service} • ${j.tech}</div>
                        </div>
                    `).join('');

                    document.getElementById('qc-queue-list').innerHTML = listHtml || '<div class="text-xs text-muted-foreground text-center py-12 text-muted-foreground">ไม่มีรายการงานที่รอตรวจ QC ในขณะนี้</div>';
                    
                    if (qcJobs.length > 0) {
                        this.selectQCJob(qcJobs[0].id);
                    } else {
                        document.getElementById('qc-form-container').innerHTML = `
                            <div class="h-full flex flex-col items-center justify-center text-center p-8">
                                <div class="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground mb-4">
                                    <i class="ph ph-clipboard-text text-3xl"></i>
                                </div>
                                <h4 class="font-display font-medium text-foreground text-base mb-1">ไม่มีงานค้างรอตรวจประเมิน</h4>
                                <p class="text-xs text-muted-foreground max-w-sm">งานทั้งหมดได้รับการตรวจ QC เรียบร้อยแล้ว</p>
                            </div>
                        `;
                    }
                }
            },

            selectQCBooking(bookingId) {
                this.state.selectedQCBookingId = bookingId;
                const booking = (DB.qcBookings || []).find(b => b.id === bookingId);
                if (!booking) return;

                const qcTechOptions = [
                    'วิชัย ตรวจดี (ช่าง QC Lead)',
                    'สมเกียรติ มั่นคง (QC Renovate & Maintenance)',
                    'ช่างกิตติพงษ์ (QC งานระบบและไฟฟ้า)',
                    'ช่างธนกฤต (QC งานปรับอากาศ)',
                    'ช่างสมชาย (QC มาตรฐานทั่วไป)'
                ];

                const curQcTech = booking.assignedQCTech || qcTechOptions[0];
                let optsHtml = qcTechOptions.map(tc => `<option value="${tc}" ${tc === curQcTech ? 'selected' : ''}>${tc}</option>`).join('');
                if (!qcTechOptions.includes(curQcTech)) {
                    optsHtml += `<option value="${curQcTech}" selected>${curQcTech}</option>`;
                }

                const isConfirmed = booking.status === 'CONFIRMED';
                const container = document.getElementById('qc-form-container');
                if (!container) return;

                container.innerHTML = `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border mb-6">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">${booking.jobId}</span>
                                <h3 class="font-display font-bold text-lg text-foreground">ใบนัดหมายจองช่างตรวจคุณภาพ (QC Booking)</h3>
                            </div>
                            <p class="text-xs text-muted-foreground mt-0.5">Task: <strong class="text-foreground">${booking.taskName}</strong> • ลูกค้า: ${booking.customerName || 'ลูกค้า'}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            ${isConfirmed 
                                ? `<span class="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 shadow-xs"><i class="ph ph-check-circle text-base"></i> ยืนยันช่าง QC แล้ว</span>`
                                : `<span class="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 shadow-xs"><i class="ph ph-clock text-base"></i> รอยืนยันช่าง QC</span>`
                            }
                        </div>
                    </div>

                    <!-- Booking Key Facts Banner -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
                            <div class="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1">
                                <i class="ph ph-calendar-blank text-brand-500"></i> วันสิ้นสุด Task ใน Gantt
                            </div>
                            <div class="text-sm font-bold font-mono text-foreground">${this.formatDateDMY(booking.taskEnd)}</div>
                            <div class="text-[10px] text-muted-foreground mt-1">เริ่ม: ${this.formatDateDMY(booking.taskStart)}</div>
                        </div>

                        <div class="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20 shadow-xs">
                            <div class="text-[11px] text-brand-600 dark:text-brand-400 flex items-center gap-1.5 font-semibold mb-1">
                                <i class="ph ph-shield-check text-brand-500"></i> วันนัดตรวจ QC (ล่วงหน้า 5 วัน)
                            </div>
                            <div class="text-base font-bold font-mono text-brand-600 dark:text-brand-400">${this.formatDateDMY(booking.qcBookingDate)}</div>
                            <div class="text-[10px] text-muted-foreground mt-1">คำนวณอัตโนมัติจาก Task End - 5 วัน</div>
                        </div>

                        <div class="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
                            <div class="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1">
                                <i class="ph ph-wrench text-brand-500"></i> ช่างผู้รับผิดชอบหน้างาน
                            </div>
                            <div class="text-xs font-bold text-foreground truncate">${booking.assignedTech}</div>
                            <div class="text-[10px] text-muted-foreground mt-1">สถานะ Task: <span class="font-semibold text-brand-500">${booking.taskStatus}</span></div>
                        </div>
                    </div>

                    <!-- Inspector Assignment & Scheduling Form -->
                    <div class="p-5 rounded-2xl bg-card border border-border space-y-4 mb-6 shadow-xs">
                        <h4 class="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <i class="ph ph-user-gear text-brand-500 text-sm"></i>
                            กำหนดข้อมูลการตรวจ & ช่าง QC ผู้ตรวจสอบ
                        </h4>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-foreground mb-1.5">ช่าง QC ผู้รับผิดชอบ (Inspector):</label>
                                <select id="qc-inspector-input-${booking.id}" onchange="app.updateQCBookingInspector('${booking.id}', this.value)" class="w-full bg-muted/40 border border-border focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none transition cursor-pointer">
                                    ${optsHtml}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-foreground mb-1.5">วันที่นัดตรวจ QC (Booking Date):</label>
                                <input type="date" value="${booking.qcBookingDate}" onchange="app.updateQCBookingDate('${booking.id}', this.value)" class="w-full bg-muted/40 border border-border focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-foreground focus:outline-none transition cursor-pointer">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-foreground mb-1.5">หมายเหตุ / เงื่อนไขการตรวจพิเศษ (Special Notes):</label>
                            <textarea id="qc-remarks-input-${booking.id}" onblur="app.saveQCBookingRemarks('${booking.id}')" rows="2.5" class="w-full bg-muted/40 border border-border focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none transition" placeholder="เช่น ต้องใช้อุปกรณ์วัดแรงดันพิเศษ, ลูกค้าจะอยู่ตรวจช่วงบ่าย, ตรวจสอบงานสีและขอบบัว...">${booking.remarks || ''}</textarea>
                        </div>
                    </div>

                    ${isConfirmed ? `
                        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 flex items-start gap-3">
                            <i class="ph ph-check-circle text-emerald-500 text-xl shrink-0 mt-0.5"></i>
                            <div class="text-xs space-y-1">
                                <div class="font-bold text-emerald-700 dark:text-emerald-300">ยืนยันการจองช่าง QC เรียบร้อยแล้ว</div>
                                <div class="text-muted-foreground">ยืนยันโดย: <strong>${booking.confirmedBy || 'เจ้าหน้าที่'}</strong> • เมื่อ: ${booking.confirmedAt ? new Date(booking.confirmedAt).toLocaleString('th-TH') : '-'}</div>
                                <div class="text-[11px] text-muted-foreground">ช่างตรวจคุณภาพจะเข้าตรวจสอบตามวันนัดหมาย และลงบันทึกในแท็บ "รอตรวจ (Pending)"</div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Actions Toolbar -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="app.navigate('gantt')" class="btn-artifact-secondary px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer">
                                <i class="ph ph-arrow-left"></i> กลับไป Gantt Chart
                            </button>
                            <button type="button" onclick="app.startQCInspectionFromBooking('${booking.jobId}')" class="btn-artifact-secondary px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400 border-brand-500/20 hover:bg-brand-500/10 cursor-pointer" title="เปิดหน้าแบบฟอร์ม Checklist ตรวจรับ">
                                <i class="ph ph-clipboard-text text-sm"></i> เปิดฟอร์ม Checklist
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" onclick="app.saveQCBookingRemarks('${booking.id}')" class="btn-artifact-secondary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer">
                                💾 บันทึกแบบร่าง
                            </button>
                            <button type="button" onclick="app.confirmQCBooking('${booking.id}')" class="btn-artifact-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white cursor-pointer">
                                <i class="ph ph-check-circle text-base"></i>
                                <span>${isConfirmed ? 'อัปเดตการยืนยันช่าง QC' : '✓ Confirm จองช่าง QC'}</span>
                            </button>
                        </div>
                    </div>
                `;
            },

            selectQCJob(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(!job) return;

                let formHtml = `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border mb-6">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-display font-bold text-lg text-foreground">แบบฟอร์มตรวจสอบ QC: <span class="text-brand-500 font-mono">${id}</span></h3>
                            </div>
                            <p class="text-xs text-muted-foreground">ลูกค้า: ${job.customer} • บริการ: ${job.service}</p>
                        </div>
                        <button class="btn-artifact-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" onclick="app.viewQCPhotos('${id}')">
                            <i class="ph ph-camera text-sm"></i> ดูรูปภาพหน้างาน (${5 + (job.photos?.length || 0)} รูป)
                        </button>
                    </div>

                    <div class="space-y-3 mb-6">
                        <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Checklist มาตรฐานความปลอดภัยและคุณภาพ</div>
                `;

                DB.qcChecklist.forEach(q => {
                    formHtml += `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                            <div class="text-xs text-foreground">
                                ${q.text} ${q.mandatory ? '<span class="text-rose-500 font-bold">*</span>' : ''}
                            </div>
                            <div class="flex items-center gap-3 shrink-0">
                                <label class="flex items-center gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition">
                                    <input type="radio" name="${q.id}" value="PASS" class="accent-emerald-500" checked>
                                    <span>PASS</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer text-rose-600 dark:text-rose-400 text-xs bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition">
                                    <input type="radio" name="${q.id}" value="FAIL" class="accent-rose-500">
                                    <span>FAIL</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer text-muted-foreground text-xs bg-card px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition">
                                    <input type="radio" name="${q.id}" value="NA" class="accent-zinc-500">
                                    <span>N/A</span>
                                </label>
                            </div>
                        </div>
                    `;
                });

                formHtml += `
                    </div>

                    <div class="p-4 rounded-xl bg-muted/30 border border-border mb-6">
                        <label class="block text-xs font-medium text-muted-foreground mb-1.5">หมายเหตุการตรวจ QC (Inspector Remarks)</label>
                        <textarea class="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-brand-500" rows="2" placeholder="ระบุความคิดเห็นหรือข้อสังเกตเพิ่มเติม..."></textarea>
                    </div>

                    <div class="flex flex-wrap justify-end gap-3 pt-2">
                        <button class="btn-artifact-secondary px-4 py-2 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 border-rose-500/20" onclick="app.showToast('บันทึกผล QC: FAIL - ส่งเรื่องกลับให้ช่างแก้ไข')">FAIL - ส่งกลับแก้ไข (Rework)</button>
                        <button class="btn-artifact-primary px-5 py-2 rounded-lg text-xs font-medium" onclick="app.passQC('${id}')">PASS - ผ่านเกณฑ์และส่งต่อ CSAT</button>
                    </div>
                `;

                document.getElementById('qc-form-container').innerHTML = formHtml;
            },

            passQC(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(job) {
                    job.status = 'QC_PASSED';
                    this.showToast(`บันทึกผล QC: ผ่านเกณฑ์สำหรับ ${id} แล้ว ส่งต่อไปยัง Contact Center เรียบร้อย`);
                    this.renderQC();
                    document.getElementById('qc-form-container').innerHTML = `
                        <div class="h-full flex flex-col items-center justify-center text-center p-8">
                            <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3">
                                <i class="ph ph-check-circle text-2xl"></i>
                            </div>
                            <h4 class="font-display font-medium text-foreground text-sm mb-1">บันทึกผล QC ผ่านเกณฑ์สำเร็จ</h4>
                            <p class="text-xs text-muted-foreground mb-4">ระบบได้ส่งต่อไปยัง Contact Center เพื่อโทรประเมินความพึงพอใจ (CSAT) เรียบร้อยแล้ว</p>
                            <button class="btn-artifact-primary px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 mx-auto" onclick="app.navigate('csat')">
                                <i class="ph ph-star"></i> ไปยังหน้าความพึงพอใจลูกค้า (CSAT) ➔
                            </button>
                        </div>
                    `;
                }
            },

            setCSATFilter(filter) {
                this.state.csatFilter = filter;
                ['all', 'pending', 'completed'].forEach(f => {
                    const btn = document.getElementById(`csat-tab-${f}`);
                    if (btn) {
                        if (f === filter) {
                            btn.classList.add('bg-card', 'text-foreground', 'shadow-sm');
                            btn.classList.remove('text-muted-foreground');
                        } else {
                            btn.classList.remove('bg-card', 'text-foreground', 'shadow-sm');
                            btn.classList.add('text-muted-foreground');
                        }
                    }
                });
                this.renderCSAT();
            },

            renderCSAT() {
                const allEligible = (DB.jobs || []).filter(j => j.status === 'QC_PASSED' || j.status === 'AFTER_SALE' || j.status === 'CLOSED');
                const pendingJobs = (DB.jobs || []).filter(j => j.status === 'QC_PASSED');
                const completedJobs = (DB.jobs || []).filter(j => j.status === 'AFTER_SALE' || j.status === 'CLOSED');

                // Update KPI stats on CSAT page
                const elPending = document.getElementById('csat-stat-pending');
                if (elPending) elPending.innerText = pendingJobs.length;
                const elCompleted = document.getElementById('csat-stat-completed');
                if (elCompleted) elCompleted.innerText = completedJobs.length;
                const elAvg = document.getElementById('csat-stat-avg');
                if (elAvg) elAvg.innerText = '4.92';

                // Update sidebar badge
                const sidebarCsat = document.getElementById('sidebar-csat-count');
                if (sidebarCsat) {
                    sidebarCsat.innerText = pendingJobs.length;
                    sidebarCsat.style.display = pendingJobs.length > 0 ? '' : 'none';
                }

                const curFilter = this.state.csatFilter || 'all';
                let filtered = allEligible;
                if (curFilter === 'pending') filtered = pendingJobs;
                else if (curFilter === 'completed') filtered = completedJobs;

                const summaryEl = document.getElementById('csat-count-summary');
                if (summaryEl) {
                    summaryEl.innerText = `แสดง ${filtered.length} รายการ (รอโทรประเมิน ${pendingJobs.length} งาน)`;
                }

                const container = document.getElementById('csat-table-body');
                if (!container) return;

                if (filtered.length === 0) {
                    container.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-muted-foreground">ไม่มีรายการในหมวดนี้</td></tr>';
                    return;
                }

                container.innerHTML = filtered.map(j => {
                    const isEvaluated = (j.status === 'AFTER_SALE' || j.status === 'CLOSED');
                    return `
                        <tr class="hover:bg-muted/40 transition-colors">
                            <td class="px-5 py-4 font-mono font-semibold text-brand-500 cursor-pointer" onclick="app.navigate('job-detail', '${j.id}')">${j.id}</td>
                            <td class="px-5 py-4">
                                <div class="text-foreground font-medium">${j.customer}</div>
                                <div class="text-[11px] text-muted-foreground font-mono">${j.phone}</div>
                            </td>
                            <td class="px-5 py-4 text-muted-foreground">${j.service}</td>
                            <td class="px-5 py-4 text-muted-foreground font-mono">${j.date}</td>
                            <td class="px-5 py-4">
                                ${isEvaluated ? 
                                '<div class="flex items-center gap-1.5"><div class="flex text-amber-400 text-sm gap-0.5"><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i><i class="ph ph-star-fill"></i></div><span class="text-[11px] font-bold text-amber-500 font-mono">5.0</span></div>' : 
                                '<span class="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[11px] font-medium inline-flex items-center gap-1"><i class="ph ph-phone"></i> รอโทรสัมภาษณ์</span>'}
                            </td>
                            <td class="px-5 py-4 text-right">
                                ${j.status === 'CLOSED' ? 
                                '<div class="flex items-center justify-end gap-2"><span class="text-emerald-500 text-xs font-medium"><i class="ph ph-check"></i> ปิดงาน (BMT)</span><button class="btn-artifact-secondary px-2.5 py-1 text-[11px] rounded" onclick="app.navigate(\'ma-contracts\')">บริการหลังการขาย ➔</button></div>' :
                                (j.status === 'AFTER_SALE' ? 
                                '<div class="flex items-center justify-end gap-2"><button class="btn-artifact-primary px-3 py-1.5 rounded-lg text-xs" onclick="app.closeJob(\''+j.id+'\')">Close & ส่ง BMT</button><button class="btn-artifact-secondary px-2.5 py-1.5 rounded-lg text-xs" onclick="app.navigate(\'ma-contracts\')">บริการหลังการขาย ➔</button></div>' : 
                                '<button class="btn-artifact-primary px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ml-auto font-medium" onclick="app.markCSAT(\''+j.id+'\')"><i class="ph ph-phone-call"></i> บันทึกโทร (5 ดาว)</button>')
                                }
                            </td>
                        </tr>
                    `;
                }).join('');
            },

            markCSAT(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(job) {
                    job.status = 'AFTER_SALE';
                    this.showToast(`บันทึกผลการประเมิน CSAT 5 ดาว สำหรับ ${id} แล้ว ส่งต่องานเข้าสู่บริการหลังการขาย`);
                    this.renderCSAT();
                    if(this.state.currentView === 'job-detail') this.renderJobDetail();
                    if(this.state.currentView === 'dashboard') this.renderDashboard();
                }
            },

            closeJob(id) {
                const job = DB.jobs.find(j => j.id === id);
                if(job) {
                    job.status = 'CLOSED';
                    const bmtRef = `BMT-REF-2026-${Math.floor(100000 + Math.random() * 900000)}`;
                    job.bmt_ref = bmtRef;
                    // Background call to server if available
                    fetch(`/api/v1/jobs/${id}/close-and-export-bmt`, { method: 'POST' }).catch(() => {});
                    this.showToast(`✅ ปิดงาน ${id} สำเร็จ! อ้างอิง ${bmtRef} ส่งข้อมูลไประบบ BMT เรียบร้อยแล้ว`);
                    this.renderCSAT();
                    if(this.state.currentView === 'job-detail') this.renderJobDetail();
                    if(this.state.currentView === 'dashboard') this.renderDashboard();
                }
            },

            setMATab(tab) {
                this.state.maTab = tab;
                const tabContractsBtn = document.getElementById('ma-tab-btn-contracts');
                const tabAfterSaleBtn = document.getElementById('ma-tab-btn-aftersale');
                const sectionContracts = document.getElementById('ma-section-contracts');
                const sectionAfterSale = document.getElementById('ma-section-aftersale');
                
                if (tab === 'aftersale') {
                    if (tabContractsBtn) {
                        tabContractsBtn.classList.remove('bg-card', 'text-foreground', 'shadow-sm');
                        tabContractsBtn.classList.add('text-muted-foreground');
                    }
                    if (tabAfterSaleBtn) {
                        tabAfterSaleBtn.classList.add('bg-card', 'text-foreground', 'shadow-sm');
                        tabAfterSaleBtn.classList.remove('text-muted-foreground');
                    }
                    if (sectionContracts) sectionContracts.classList.add('hidden');
                    if (sectionAfterSale) sectionAfterSale.classList.remove('hidden');
                    this.renderAfterSaleJobs();
                } else {
                    if (tabContractsBtn) {
                        tabContractsBtn.classList.add('bg-card', 'text-foreground', 'shadow-sm');
                        tabContractsBtn.classList.remove('text-muted-foreground');
                    }
                    if (tabAfterSaleBtn) {
                        tabAfterSaleBtn.classList.remove('bg-card', 'text-foreground', 'shadow-sm');
                        tabAfterSaleBtn.classList.add('text-muted-foreground');
                    }
                    if (sectionContracts) sectionContracts.classList.remove('hidden');
                    if (sectionAfterSale) sectionAfterSale.classList.add('hidden');
                    this.renderMAContracts();
                }
            },

            renderAfterSaleJobs() {
                const afterSaleJobs = (DB.jobs || []).filter(j => j.status === 'AFTER_SALE' || j.status === 'CLOSED');
                const pendingBMT = afterSaleJobs.filter(j => j.status === 'AFTER_SALE').length;
                const closedBMT = afterSaleJobs.filter(j => j.status === 'CLOSED').length;

                // Update After-Sale Stats
                const asTotal = document.getElementById('as-stat-total');
                if (asTotal) asTotal.innerText = afterSaleJobs.length;
                const asPending = document.getElementById('as-stat-pending');
                if (asPending) asPending.innerText = pendingBMT;
                const asClosed = document.getElementById('as-stat-closed');
                if (asClosed) asClosed.innerText = closedBMT;

                const container = document.getElementById('ma-aftersale-container');
                if (!container) return;

                if (afterSaleJobs.length === 0) {
                    container.innerHTML = `
                        <div class="artifact-card p-12 text-center text-muted-foreground rounded-2xl border border-border bg-card">
                            <div class="text-4xl mb-2">🛡️</div>
                            <div class="font-semibold text-sm text-foreground">ยังไม่มีรายการงานในสถานะบริการหลังการขาย</div>
                            <p class="text-xs text-muted-foreground mt-1">งานที่ผ่านการประเมิน CSAT แล้วจะปรากฏที่นี่ เพื่อติดตามการรับประกัน หรือเปิดสัญญาบำรุงรักษา MA ต่อเนื่อง</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = afterSaleJobs.map(j => {
                    const isClosed = j.status === 'CLOSED';
                    return `
                        <div class="artifact-card p-5 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-brand-500/40 transition">
                            <div class="space-y-1.5 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-mono font-bold text-sm text-brand-500 cursor-pointer" onclick="app.navigate('job-detail', '${j.id}')">${j.id}</span>
                                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${isClosed ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : 'text-sky-600 bg-sky-500/10 border-sky-500/20'}">
                                        ${isClosed ? 'Closed & ส่ง BMT แล้ว' : 'บริการหลังการขาย (After Sale)'}
                                    </span>
                                    ${j.bmt_ref ? '<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">Ref: ' + j.bmt_ref + '</span>' : ''}
                                </div>
                                <div class="text-xs text-foreground font-medium flex items-center gap-2">
                                    <span><i class="ph ph-user text-muted-foreground"></i> ${j.customer}</span>
                                    <span class="text-muted-foreground font-mono text-[11px]">(${j.phone})</span>
                                </div>
                                <div class="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                                    <span><i class="ph ph-wrench text-muted-foreground"></i> ${j.service}</span>
                                    <span>·</span>
                                    <span><i class="ph ph-calendar text-muted-foreground"></i> ส่งมอบ: ${j.date}</span>
                                    <span>·</span>
                                    <span class="text-amber-500 font-medium inline-flex items-center gap-0.5">
                                        <i class="ph ph-star-fill text-xs"></i> CSAT: 5.0
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                ${!isClosed ? `
                                    <button class="btn-artifact-secondary px-3 py-1.5 rounded-lg text-xs" onclick="app.closeJob('${j.id}')">
                                        Close & ส่ง BMT
                                    </button>
                                ` : ''}
                                <button class="btn-artifact-primary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm" onclick="app.openCreateMAForJob('${j.id}')">
                                    <i class="ph ph-plus-circle"></i>
                                    <span>เปิดสัญญา MA</span>
                                </button>
                                <button class="btn-artifact-secondary px-2.5 py-1.5 rounded-lg text-xs" onclick="app.navigate('job-detail', '${j.id}')" title="ดูข้อมูลงาน">
                                    <i class="ph ph-arrow-square-out"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            },

            openCreateMAForJob(jobId) {
                const job = DB.jobs.find(j => j.id === jobId);
                this.openCreateMAModal();
                if (job) {
                    const custName = document.getElementById('ma-cust-name');
                    if (custName) custName.value = job.customer || '';
                    const custPhone = document.getElementById('ma-cust-phone');
                    if (custPhone) custPhone.value = job.phone || '';
                    const siteAddr = document.getElementById('ma-site-address');
                    if (siteAddr) siteAddr.value = job.location || '';
                    const servType = document.getElementById('ma-service-type');
                    if (servType) servType.value = (job.service && job.service.includes('แอร์')) ? 'ล้างแอร์' : 'บำรุงรักษาทั่วไป';
                    const notes = document.getElementById('ma-notes');
                    if (notes) notes.value = `อ้างอิงงานติดตั้ง: ${job.id}\nบริการเดิม: ${job.service || ''}\nCSAT: 5 ดาว`;
                    this.showToast(`ดึงข้อมูลจากงาน ${job.id} มาสร้างสัญญา MA แล้ว`);
                }
            },


            // =========================================================
            // RECURRING MAINTENANCE / MA CONTRACTS METHODS
            // =========================================================
            async fetchMAFromApi() {
                try {
                    const [resContracts, resTemplates] = await Promise.all([
                        fetch('/api/ma-contracts').then(r => r.ok ? r.json() : null),
                        fetch('/api/ma-checklist-templates').then(r => r.ok ? r.json() : null)
                    ]);
                    if (Array.isArray(resContracts) && resContracts.length > 0) {
                        DB.maContracts = resContracts;
                    }
                    if (Array.isArray(resTemplates) && resTemplates.length > 0) {
                        DB.maChecklistTemplates = resTemplates;
                    }
                    if (this.state.currentView === 'ma-contracts') {
                        this.renderMAContracts();
                    }
                    const sidebarMa = document.getElementById('sidebar-ma-count');
                    if (sidebarMa) sidebarMa.innerText = DB.maContracts.length;
                } catch (err) {
                    // local fallback
                }
            },

            formatDate(d) {
                if (!d) return '—';
                try {
                    const p = d.split('T')[0].split('-');
                    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
                    return d;
                } catch(e) { return d; }
            },

            renderMAContracts() {
                const contracts = DB.maContracts || [];
                const totalContracts = contracts.length;
                const activeContracts = contracts.filter(c => c.status === 'Active').length;
                const totalRounds = contracts.reduce((s, c) => s + (parseInt(c.total_rounds_count) || parseInt(c.total_rounds) || 0), 0);
                const completedRounds = contracts.reduce((s, c) => s + (parseInt(c.completed_rounds) || 0), 0);

                // Update Stat Cards
                const statTotal = document.getElementById('ma-stat-total');
                if (statTotal) statTotal.innerText = totalContracts;
                const statActive = document.getElementById('ma-stat-active');
                if (statActive) statActive.innerText = activeContracts;
                const statRounds = document.getElementById('ma-stat-rounds');
                if (statRounds) statRounds.innerText = totalRounds;
                const statComp = document.getElementById('ma-stat-completed');
                if (statComp) statComp.innerText = completedRounds;

                this.renderAfterSaleJobs();

                const container = document.getElementById('ma-contracts-list');
                if (!container) return;

                if (contracts.length === 0) {
                    container.innerHTML = `
                        <div class="artifact-card p-12 text-center text-muted-foreground rounded-2xl border border-border bg-card">
                            <div class="text-4xl mb-2">📋</div>
                            <div class="font-semibold text-sm text-foreground">ยังไม่มีสัญญา MA — กด "สร้างสัญญา MA" เพื่อเริ่มต้น</div>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = contracts.map(c => {
                    const isExpanded = (this.state.maExpandedId === c.id);
                    const tRounds = parseInt(c.total_rounds_count) || parseInt(c.total_rounds) || 0;
                    const cRounds = parseInt(c.completed_rounds) || 0;
                    const pct = tRounds ? Math.round((cRounds / tRounds) * 100) : 0;
                    const isFullyCompleted = (pct === 100);

                    // Extract customer and site names from direct fields or notes
                    let custName = c.customer_name || '';
                    let siteName = c.site_name || '';
                    if (!custName && c.notes) {
                        const m = c.notes.split('\n').find(l => l.startsWith('ลูกค้า:'));
                        if (m) custName = m.replace('ลูกค้า:', '').trim();
                    }
                    if (!siteName && c.notes) {
                        const m = c.notes.split('\n').find(l => l.startsWith('ไซต์:'));
                        if (m) siteName = m.replace('ไซต์:', '').trim();
                    }
                    if (!custName) custName = 'ลูกค้าทั่วไป';

                    // Rounds for this contract
                    const rounds = (c.rounds && c.rounds.length > 0) 
                        ? c.rounds 
                        : (DB.maRounds.filter(r => r.contract_id === c.id).sort((a, b) => a.round_number - b.round_number));

                    // Equipment items
                    const items = Array.isArray(c.service_items) ? c.service_items : [];

                    // Status Badge
                    let statusBadgeClass = 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
                    if (c.status === 'Completed') statusBadgeClass = 'text-blue-600 bg-blue-500/10 border-blue-500/20';
                    else if (c.status === 'Cancelled') statusBadgeClass = 'text-rose-600 bg-rose-500/10 border-rose-500/20';

                    return `
                        <div class="artifact-card rounded-2xl border border-border bg-card overflow-hidden transition-all shadow-sm">
                            <!-- Card Header (Click to Toggle) -->
                            <div class="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition select-none" onclick="app.toggleMAContract('${c.id}')">
                                <div class="flex-1 min-w-0 space-y-1.5">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-extrabold text-sm sm:text-base text-foreground tracking-tight">${c.contract_no || c.id}</span>
                                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeClass}">${c.status}</span>
                                        <span class="text-[11px] text-muted-foreground bg-muted border border-border/80 px-2 py-0.5 rounded-full">🔧 ${c.service_type}</span>
                                    </div>
                                    <div class="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-muted-foreground">
                                        <span class="text-foreground font-medium flex items-center gap-1"><i class="ph ph-user text-muted-foreground"></i> ${custName}${siteName ? ' · ' + siteName : ''}</span>
                                        <span>·</span>
                                        <span class="flex items-center gap-1"><i class="ph ph-calendar text-muted-foreground"></i> ทุก ${c.frequency_months || 3} เดือน · ${c.total_rounds || 4} รอบ</span>
                                        ${Number(c.contract_value) > 0 ? `
                                            <span>·</span>
                                            <span class="text-emerald-600 dark:text-emerald-400 font-semibold">฿${Number(c.contract_value).toLocaleString()}</span>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Progress Gauge & Chevron -->
                                <div class="flex items-center gap-4 shrink-0">
                                    <div class="text-right">
                                        <div class="text-xl font-extrabold ${isFullyCompleted ? 'text-emerald-500' : 'text-foreground'}">${cRounds}/${tRounds}</div>
                                        <div class="text-[10px] text-muted-foreground">รอบที่เสร็จ</div>
                                        <div class="w-20 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                            <div class="h-full ${isFullyCompleted ? 'bg-emerald-500' : 'bg-brand-500'} rounded-full transition-all duration-300" style="width: ${pct}%"></div>
                                        </div>
                                    </div>
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground">
                                        ${isExpanded ? '<i class="ph ph-caret-up text-lg"></i>' : '<i class="ph ph-caret-down text-lg"></i>'}
                                    </div>
                                </div>
                            </div>

                            <!-- Expanded Details -->
                            ${isExpanded ? `
                                <div class="border-t border-border p-5 space-y-4 bg-muted/10">
                                    <!-- Equipment Items -->
                                    ${items.length > 0 ? `
                                        <div>
                                            <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">อุปกรณ์ในสัญญา</div>
                                            <div class="flex flex-wrap gap-2">
                                                ${items.map((it, idx) => `
                                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-xs text-foreground shadow-2xs">
                                                        <span class="text-muted-foreground font-mono font-medium">${idx + 1}.</span>
                                                        <span class="font-medium">${it.name}</span>
                                                        ${it.brand ? `<span class="text-muted-foreground">(${it.brand}${it.btu ? ' ' + it.btu + ' BTU' : ''})</span>` : ''}
                                                        ${it.location ? `<span class="text-muted-foreground">· ${it.location}</span>` : ''}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        </div>
                                    ` : ''}

                                    <!-- QC Checklist Button -->
                                    <div>
                                        <button onclick="app.showMAChecklist('${c.service_type}')" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 text-xs font-semibold transition cursor-pointer">
                                            <i class="ph ph-clipboard-text text-sm"></i>
                                            <span>ดู QC Checklist — ${c.service_type}</span>
                                        </button>
                                    </div>

                                    <!-- Service Rounds Table -->
                                    <div>
                                        <div class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">ตารางรอบบริการ</div>
                                        <div class="space-y-2">
                                            ${rounds.map(r => {
                                                const statusMap = {
                                                    'Scheduled': { label: '🗓 กำหนดการ', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
                                                    'InProgress': { label: '🔧 กำลังทำ', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
                                                    'Completed': { label: '✅ เสร็จสิ้น', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
                                                    'Rescheduled': { label: '🔁 เลื่อนนัด', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
                                                    'Skipped': { label: '⏭ ข้าม', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' }
                                                };
                                                const st = statusMap[r.status] || statusMap.Scheduled;
                                                const canAction = (r.status === 'Scheduled' || r.status === 'InProgress');

                                                return `
                                                    <div class="flex items-center justify-between p-3 rounded-xl bg-card border border-border/80 hover:border-border transition flex-wrap gap-3">
                                                        <div class="flex items-center gap-3 flex-wrap">
                                                            <span class="font-extrabold text-xs sm:text-sm text-foreground min-w-[50px]">รอบ ${r.round_number}</span>
                                                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}">${st.label}</span>
                                                            <span class="text-xs text-muted-foreground">
                                                                นัด: <strong class="text-foreground font-mono">${app.formatDate(r.scheduled_date)}</strong>
                                                                ${r.actual_date ? ` · จริง: <strong class="text-foreground font-mono">${app.formatDate(r.actual_date)}</strong>` : ''}
                                                            </span>
                                                        </div>

                                                        ${canAction ? `
                                                            <div class="flex items-center gap-2">
                                                                <button onclick="app.completeMARound('${r.id}', ${r.round_number})" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer">
                                                                    <i class="ph ph-check-bold text-xs"></i>
                                                                    <span>เสร็จ</span>
                                                                </button>
                                                                <button onclick="app.rescheduleMARound('${r.id}', ${r.round_number}, '${r.scheduled_date}')" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition cursor-pointer">
                                                                    <i class="ph ph-arrows-clockwise text-xs"></i>
                                                                    <span>เลื่อน</span>
                                                                </button>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            },

            async toggleMAContract(id) {
                if (this.state.maExpandedId === id) {
                    this.state.maExpandedId = null;
                } else {
                    this.state.maExpandedId = id;
                    // fetch latest detail for this contract
                    try {
                        const res = await fetch(`/api/ma-contracts/${id}`);
                        if (res.ok) {
                            const detail = await res.json();
                            const idx = DB.maContracts.findIndex(c => c.id === id);
                            if (idx !== -1) {
                                DB.maContracts[idx] = detail;
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                this.renderMAContracts();
            },

            openCreateMAModal() {
                // Reset form fields
                document.getElementById('ma-cust-search').value = '';
                document.getElementById('ma-cust-name').value = '';
                document.getElementById('ma-cust-phone').value = '';
                document.getElementById('ma-site-name').value = '';
                document.getElementById('ma-site-address').value = '';
                document.getElementById('ma-service-type').value = 'ล้างแอร์';
                document.getElementById('ma-interval').value = '3';
                document.getElementById('ma-rounds').value = '4';
                document.getElementById('ma-value').value = '12000';
                document.getElementById('ma-notes').value = '';

                // Default date: tomorrow
                const d = new Date();
                d.setDate(d.getDate() + 1);
                document.getElementById('ma-start-date').value = d.toISOString().split('T')[0];

                // Reset equipment items
                this.state.maEquipment = [
                    { id: 'si_' + Date.now(), name: 'เครื่องที่ 1', brand: '', btu: '', location: '' }
                ];
                this.renderMAEquipmentRows();
                this.hideMACustomerSuggestions();

                this.showModal('modal-create-ma');
            },

            renderMAEquipmentRows() {
                const container = document.getElementById('ma-equipment-container');
                if (!container) return;
                container.innerHTML = this.state.maEquipment.map((item, idx) => `
                    <div class="grid grid-cols-12 gap-2 items-center bg-card p-2 rounded-lg border border-border/80">
                        <div class="col-span-12 sm:col-span-4">
                            <input type="text" value="${item.name || ''}" oninput="app.updateMAEquipmentItem('${item.id}', 'name', this.value)" placeholder="รายการ ${idx + 1}" class="w-full bg-muted border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-brand-500">
                        </div>
                        <div class="col-span-4 sm:col-span-3">
                            <input type="text" value="${item.brand || ''}" oninput="app.updateMAEquipmentItem('${item.id}', 'brand', this.value)" placeholder="ยี่ห้อ" class="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-brand-500">
                        </div>
                        <div class="col-span-3 sm:col-span-2">
                            <input type="text" value="${item.btu || ''}" oninput="app.updateMAEquipmentItem('${item.id}', 'btu', this.value)" placeholder="BTU" class="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-brand-500">
                        </div>
                        <div class="col-span-4 sm:col-span-2">
                            <input type="text" value="${item.location || ''}" oninput="app.updateMAEquipmentItem('${item.id}', 'location', this.value)" placeholder="ห้อง/ตำแหน่ง" class="w-full bg-muted border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-brand-500">
                        </div>
                        <div class="col-span-1 text-center">
                            <button type="button" onclick="app.removeMAEquipmentRow('${item.id}')" class="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition" title="ลบเครื่อง">
                                <i class="ph ph-trash text-sm"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            },

            addMAEquipmentRow() {
                const count = this.state.maEquipment.length + 1;
                this.state.maEquipment.push({
                    id: 'si_' + Date.now(),
                    name: `เครื่องที่ ${count}`,
                    brand: '',
                    btu: '',
                    location: ''
                });
                this.renderMAEquipmentRows();
            },

            removeMAEquipmentRow(id) {
                if (this.state.maEquipment.length <= 1) {
                    this.showToast('สัญญาต้องมีอุปกรณ์อย่างน้อย 1 รายการ');
                    return;
                }
                this.state.maEquipment = this.state.maEquipment.filter(item => item.id !== id);
                this.renderMAEquipmentRows();
            },

            updateMAEquipmentItem(id, field, value) {
                const item = this.state.maEquipment.find(it => it.id === id);
                if (item) item[field] = value;
            },

            onMACustomerSearchFocus() {
                this.onMACustomerSearchInput(document.getElementById('ma-cust-search').value || '');
            },

            onMACustomerSearchInput(query) {
                const term = (query || '').trim().toLowerCase();
                const sugBox = document.getElementById('ma-cust-suggestions');
                const closeBtn = document.getElementById('ma-btn-close-suggest');
                if (!sugBox) return;

                const pool = (DB.jobs || []).map(j => ({
                    id: j.id,
                    name: j.customer || `${j.firstName || ''} ${j.lastName || ''}`.trim(),
                    phone: j.phone || '',
                    address: j.address || '',
                    service: j.service || ''
                }));

                const matches = pool.filter(p => {
                    if (!term) return true;
                    return p.name.toLowerCase().includes(term) || p.phone.includes(term) || p.address.toLowerCase().includes(term);
                }).slice(0, 6);

                if (matches.length === 0) {
                    sugBox.innerHTML = `<div class="p-3 text-center text-xs text-muted-foreground">ไม่พบข้อมูลลูกค้า</div>`;
                } else {
                    sugBox.innerHTML = matches.map(m => `
                        <div class="p-2.5 hover:bg-muted/60 transition cursor-pointer flex items-center justify-between" onclick="app.selectMACustomer('${m.id}')">
                            <div>
                                <div class="text-xs font-semibold text-foreground">${m.name}</div>
                                <div class="text-[11px] text-muted-foreground">${m.phone ? '📞 ' + m.phone : ''} ${m.address ? '· 📍 ' + m.address : ''}</div>
                            </div>
                            <span class="text-[11px] text-brand-500 font-semibold">เลือก ➔</span>
                        </div>
                    `).join('');
                }

                sugBox.classList.remove('hidden');
                if (closeBtn) closeBtn.classList.remove('hidden');
            },

            hideMACustomerSuggestions() {
                const sugBox = document.getElementById('ma-cust-suggestions');
                const closeBtn = document.getElementById('ma-btn-close-suggest');
                if (sugBox) sugBox.classList.add('hidden');
                if (closeBtn) closeBtn.classList.add('hidden');
            },

            selectMACustomer(jobId) {
                const job = (DB.jobs || []).find(j => j.id === jobId);
                if (job) {
                    document.getElementById('ma-cust-name').value = job.customer || `${job.firstName || ''} ${job.lastName || ''}`.trim();
                    document.getElementById('ma-cust-phone').value = job.phone || '';
                    document.getElementById('ma-site-name').value = job.address ? job.address.split(',')[0] : 'สถานที่หลัก';
                    document.getElementById('ma-site-address').value = job.address || '';
                    const clearBtn = document.getElementById('ma-btn-clear-customer');
                    if (clearBtn) clearBtn.classList.remove('hidden');
                }
                this.hideMACustomerSuggestions();
            },

            clearMACustomerSelection() {
                document.getElementById('ma-cust-search').value = '';
                document.getElementById('ma-cust-name').value = '';
                document.getElementById('ma-cust-phone').value = '';
                document.getElementById('ma-site-name').value = '';
                document.getElementById('ma-site-address').value = '';
                const clearBtn = document.getElementById('ma-btn-clear-customer');
                if (clearBtn) clearBtn.classList.add('hidden');
            },

            async submitCreateMA(e) {
                e.preventDefault();
                const custName = document.getElementById('ma-cust-name').value.trim();
                const custPhone = document.getElementById('ma-cust-phone').value.trim();
                const siteName = document.getElementById('ma-site-name').value.trim();
                const siteAddr = document.getElementById('ma-site-address').value.trim();
                const serviceType = document.getElementById('ma-service-type').value;
                const interval = parseInt(document.getElementById('ma-interval').value) || 3;
                const totalRounds = parseInt(document.getElementById('ma-rounds').value) || 4;
                const startDate = document.getElementById('ma-start-date').value;
                const contractValue = parseFloat(document.getElementById('ma-value').value) || 0;
                const notes = document.getElementById('ma-notes').value.trim();

                if (!custName) {
                    alert('กรุณากรอกชื่อลูกค้า');
                    return;
                }
                if (!startDate) {
                    alert('กรุณาระบุวันเริ่มต้นสัญญา');
                    return;
                }

                // Calculate end date
                const dEnd = new Date(startDate);
                dEnd.setMonth(dEnd.getMonth() + (interval * totalRounds));
                const endDate = dEnd.toISOString().split('T')[0];

                const serviceItems = this.state.maEquipment.filter(item => item.name && item.name.trim());

                const payload = {
                    customer_name: custName,
                    customer_phone: custPhone,
                    site_name: siteName,
                    site_address: siteAddr,
                    service_type: serviceType,
                    service_items: serviceItems,
                    frequency_months: interval,
                    total_rounds: totalRounds,
                    contract_start_date: startDate,
                    contract_end_date: endDate,
                    contract_value: contractValue,
                    notes: [
                        `ลูกค้า: ${custName}`,
                        custPhone ? `โทร: ${custPhone}` : '',
                        siteName ? `ไซต์: ${siteName}` : '',
                        siteAddr ? `ที่อยู่: ${siteAddr}` : '',
                        notes
                    ].filter(Boolean).join('\n'),
                    status: 'Active'
                };

                // Submit to backend API
                try {
                    const res = await fetch('/api/ma-contracts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        const newContract = await res.json();
                        this.state.maExpandedId = newContract.id;
                        this.showToast(`สร้างสัญญา MA สำเร็จ (${newContract.contract_no || newContract.id})`);
                    } else {
                        throw new Error('API request failed');
                    }
                } catch (err) {
                    // Fallback to local DB
                    const count = DB.maContracts.length + 1;
                    const year = new Date().getFullYear();
                    const newId = `mac_${Date.now()}`;
                    const localContract = {
                        ...payload,
                        id: newId,
                        contract_no: `MAC-${year}-${String(count).padStart(4, '0')}`,
                        total_rounds_count: totalRounds,
                        completed_rounds: 0
                    };
                    DB.maContracts.unshift(localContract);

                    // Add rounds
                    const sDate = new Date(startDate);
                    for (let i = 1; i <= totalRounds; i++) {
                        const rDate = new Date(sDate);
                        rDate.setMonth(rDate.getMonth() + (interval * (i - 1)));
                        DB.maRounds.push({
                            id: `mar_${Date.now()}_${i}`,
                            contract_id: newId,
                            round_number: i,
                            scheduled_date: rDate.toISOString().split('T')[0],
                            actual_date: null,
                            status: 'Scheduled'
                        });
                    }

                    this.state.maExpandedId = newId;
                    this.showToast(`สร้างสัญญา MA เรียบร้อยแล้ว (+${totalRounds} รอบ)`);
                }

                this.hideModal('modal-create-ma');
                await this.fetchMAFromApi();
                this.renderMAContracts();
            },

            async completeMARound(roundId, roundNum) {
                if (!confirm(`ยืนยันปิดรอบที่ ${roundNum} เป็น "เสร็จสิ้น"?`)) return;
                const today = new Date().toISOString().split('T')[0];

                try {
                    await fetch(`/api/ma-rounds/${roundId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'Completed',
                            actual_date: today
                        })
                    });
                } catch (e) {
                    // fallback local
                    const r = DB.maRounds.find(item => item.id === roundId);
                    if (r) {
                        r.status = 'Completed';
                        r.actual_date = today;
                    }
                }

                this.showToast(`บันทึกผลรอบที่ ${roundNum} เสร็จสิ้นเรียบร้อยแล้ว`);
                await this.fetchMAFromApi();
                this.renderMAContracts();
            },

            async rescheduleMARound(roundId, roundNum, curDate) {
                const newDate = prompt(`วันใหม่สำหรับรอบที่ ${roundNum} (YYYY-MM-DD):`, curDate || '');
                if (!newDate) return;

                try {
                    await fetch(`/api/ma-rounds/${roundId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'Rescheduled',
                            scheduled_date: newDate
                        })
                    });
                } catch (e) {
                    const r = DB.maRounds.find(item => item.id === roundId);
                    if (r) {
                        r.status = 'Rescheduled';
                        r.scheduled_date = newDate;
                    }
                }

                this.showToast(`เลื่อนนัดรอบที่ ${roundNum} เป็นวันที่ ${this.formatDate(newDate)} แล้ว`);
                await this.fetchMAFromApi();
                this.renderMAContracts();
            },

            showMAChecklist(serviceType) {
                const templates = DB.maChecklistTemplates || [];
                const tpl = templates.find(t => t.service_type === serviceType) || templates[0];
                if (!tpl) {
                    alert(`ไม่พบ Checklist สำหรับ ${serviceType}`);
                    return;
                }

                const titleEl = document.getElementById('ma-checklist-modal-title');
                if (titleEl) titleEl.innerText = tpl.template_name || `Checklist ${serviceType}`;

                const container = document.getElementById('ma-checklist-items-container');
                if (container) {
                    const items = Array.isArray(tpl.checklist_items) ? tpl.checklist_items : [];
                    container.innerHTML = items.map((it, idx) => `
                        <div class="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/80">
                            <div class="flex items-center gap-2.5">
                                <div class="w-5 h-5 rounded border border-border bg-card flex items-center justify-center shrink-0">
                                    <i class="ph ph-check text-xs text-muted-foreground/50"></i>
                                </div>
                                <span class="text-xs text-foreground font-medium">${idx + 1}. ${it.label}</span>
                            </div>
                            ${it.required ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">จำเป็น</span>` : ''}
                        </div>
                    `).join('');
                }

                this.showModal('modal-ma-checklist');
            }
        };

        // Initialize on load
        document.addEventListener('DOMContentLoaded', () => {
            app.init();
        });
window.app = app;

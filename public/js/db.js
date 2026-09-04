// DB Store & Seed Data
const DB = {
            jobs: [],
            blueprints: [],
            tickets: [],
            tasks: [],
            qcBookings: [],
            qcChecklist: [
                { id: 'Q1', text: 'ความสะอาดพื้นที่หน้างาน (Site Cleanliness)', mandatory: true },
                { id: 'Q2', text: 'ระบบน้ำไม่รั่วซึม และแรงดันน้ำปกติ (Pressure Test)', mandatory: true },
                { id: 'Q3', text: 'การเก็บรอยต่อซิลิโคนและงานผิวสัมผัสเรียบร้อย', mandatory: false },
                { id: 'Q4', text: 'ส่งมอบคู่มือการใช้งาน & ใบรับประกันให้ลูกค้า', mandatory: true }
            ],
            maContracts: [
                {
                    id: "mac_1788397202685",
                    contract_no: "MAC-2026-0001",
                    customer_name: "สมควร กระจ่าง",
                    customer_phone: "0896292111",
                    site_name: "dfdfsdfsfdsdf",
                    site_address: "123/45 สุขุมวิท กรุงเทพฯ",
                    service_type: "ล้างแอร์",
                    service_items: [
                        { id: "si_1", btu: "", name: "เครื่องที่ 1", brand: "", location: "" }
                    ],
                    frequency_months: 3,
                    total_rounds: 4,
                    total_rounds_count: 4,
                    completed_rounds: 0,
                    contract_start_date: "2026-09-04",
                    contract_end_date: "2027-09-04",
                    contract_value: 12000,
                    status: "Active",
                    notes: "ลูกค้า: สมควร กระจ่าง\nโทร: 0896292111\nไซต์: dfdfsdfsfdsdf\nที่อยู่: 123/45 สุขุมวิท กรุงเทพฯ"
                }
            ],
            maRounds: [
                { id: "mar_1788397202746", contract_id: "mac_1788397202685", round_number: 1, scheduled_date: "2026-09-04", actual_date: null, status: "Scheduled" },
                { id: "mar_1788397202801", contract_id: "mac_1788397202685", round_number: 2, scheduled_date: "2026-12-04", actual_date: null, status: "Scheduled" },
                { id: "mar_1788397202856", contract_id: "mac_1788397202685", round_number: 3, scheduled_date: "2027-03-04", actual_date: null, status: "Scheduled" },
                { id: "mar_1788397202908", contract_id: "mac_1788397202685", round_number: 4, scheduled_date: "2027-06-04", actual_date: null, status: "Scheduled" }
            ],
            maChecklistTemplates: [
                {
                    id: "mact_ac_wash",
                    service_type: "ล้างแอร์",
                    template_name: "Checklist ล้างแอร์มาตรฐาน",
                    checklist_items: [
                        { id: "ac1", label: "ถอดและทำความสะอาดแผ่นกรองอากาศ (Filter)", required: true },
                        { id: "ac2", label: "ล้างคอยล์เย็น (Evaporator Coil) ด้วยน้ำยาล้างคอยล์", required: true },
                        { id: "ac3", label: "ล้างและเป่าท่อระบายน้ำทิ้ง (Drain Pipe)", required: true },
                        { id: "ac4", label: "ล้างคอยล์ร้อน (Condensing Unit ภายนอก)", required: true },
                        { id: "ac5", label: "วัดแรงดันน้ำยาแอร์ (Refrigerant Pressure)", required: true },
                        { id: "ac6", label: "วัดกระแสไฟฟ้าคอมเพรสเซอร์ (Operating Current)", required: true },
                        { id: "ac7", label: "ทดสอบการทำงานระบบปรับอากาศและวัดอุณหภูมิลมออก", required: true },
                        { id: "ac8", label: "ถ่ายภาพ Before/After", required: true }
                    ]
                },
                {
                    id: "mact_electrical",
                    service_type: "ตรวจระบบไฟฟ้า",
                    template_name: "Checklist ตรวจระบบไฟฟ้ามาตรฐาน",
                    checklist_items: [
                        { id: "el1", label: "ตรวจสภาพตู้ MDB / ตู้ควบคุมไฟหลัก", required: true },
                        { id: "el2", label: "วัดแรงดันไฟฟ้า (Voltage Check)", required: true },
                        { id: "el3", label: "ตรวจสายดิน (Ground/Earth Check)", required: true },
                        { id: "el4", label: "ทดสอบ RCD/ELCB (ตัดไฟรั่ว)", required: true },
                        { id: "el5", label: "ตรวจสภาพสายไฟและเต้ารับ", required: true },
                        { id: "el6", label: "ถ่ายภาพ Before/After", required: true }
                    ]
                },
                {
                    id: "mact_plumbing",
                    service_type: "ตรวจระบบประปา",
                    template_name: "Checklist ตรวจระบบประปา",
                    checklist_items: [
                        { id: "pl1", label: "ตรวจท่อน้ำและข้อต่อ (หารอยรั่ว)", required: true },
                        { id: "pl2", label: "เช็คแรงดันน้ำ (Water Pressure)", required: true },
                        { id: "pl3", label: "ตรวจวาล์วปิด-เปิด (Shut-off Valves)", required: true },
                        { id: "pl4", label: "ตรวจถังแรงดันน้ำ (Pressure Tank)", required: false },
                        { id: "pl5", label: "ถ่ายภาพ Before/After", required: true }
                    ]
                },
                {
                    id: "mact_cctv",
                    service_type: "ตรวจ CCTV",
                    template_name: "Checklist ตรวจระบบ CCTV",
                    checklist_items: [
                        { id: "cc1", label: "ตรวจสภาพกล้องและมุมมอง (Camera Position)", required: true },
                        { id: "cc2", label: "ทดสอบภาพ Daytime (ความชัดเจน)", required: true },
                        { id: "cc3", label: "ทดสอบ Night Vision / IR", required: true },
                        { id: "cc4", label: "เช็คพื้นที่จัดเก็บ HDD/NVR", required: true },
                        { id: "cc5", label: "ทดสอบการ Playback ย้อนหลัง", required: true },
                        { id: "cc6", label: "ถ่ายภาพ Before/After", required: true }
                    ]
                }
            ]
        };
window.DB = DB;

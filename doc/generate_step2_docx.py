# -*- coding: utf-8 -*-
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_color):
    """Set background color of a cell (hex string without #, e.g. 'F1F5F9')"""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=180, right=180):
    """Set cell padding in dxa (1 pt = 20 dxa)"""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    """Set subtle table borders"""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def format_run(run, font_name="TH Sarabun New", size_pt=14, bold=False, color_rgb=None, italic=False):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb
    # Thai font support
    rPr = run._r.get_or_add_rPr()
    rFonts = parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{font_name}" w:hAnsi="{font_name}" w:cs="{font_name}"/>')
    rPr.append(rFonts)

def add_callout(doc, text, title="คำแนะนำพิเศษ", border_color="3B82F6", bg_color="EFF6FF"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border only
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    if title:
        r_t = p.add_run(f"📌 {title}\n")
        format_run(r_t, size_pt=14, bold=True, color_rgb=RGBColor(30, 58, 138))
    r_c = p.add_run(text)
    format_run(r_c, size_pt=13, bold=False, color_rgb=RGBColor(30, 41, 59))
    doc.add_paragraph() # Spacing

def create_document():
    doc = docx.Document()
    
    # Page setup - Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
    # Document Metadata Table
    meta_tbl = doc.add_table(rows=3, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(meta_tbl, color="CBD5E1", sz="4")
    
    meta_data = [
        [("รหัสหลักสูตร / SOP:", True, "F1F5F9"), ("TRN-PMT-STEP02 / SOP-PMT-002", False, "FFFFFF"),
         ("ชื่อระบบ:", True, "F1F5F9"), ("PMT Flow Enterprise Operations", False, "FFFFFF")],
        [("โมดูล / ขั้นตอน:", True, "F1F5F9"), ("Step 2: บันทึก Design & แบบแปลน (Blueprints)", False, "FFFFFF"),
         ("เวอร์ชันระบบ:", True, "F1F5F9"), ("v2.0 (Pipeline Architecture)", False, "FFFFFF")],
        [("กลุ่มเป้าหมายผู้เรียน:", True, "F1F5F9"), ("สถาปนิก, มัณฑนากร, วิศวกร, BOQ Officer, Trainer", False, "FFFFFF"),
         ("ระบบใช้งานจริง:", True, "F1F5F9"), ("https://vibepmt.online", False, "FFFFFF")]
    ]
    
    for r_idx, row in enumerate(meta_data):
        for c_idx, (txt, is_bold, bg) in enumerate(row):
            cell = meta_tbl.cell(r_idx, c_idx)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(txt)
            format_run(r, size_pt=11.5, bold=is_bold, color_rgb=RGBColor(15, 23, 42) if is_bold else RGBColor(51, 65, 85))

    doc.add_paragraph()

    # Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("🎓 คู่มือฝึกอบรมการใช้งานหน้าจอระบบ PMT Flow")
    format_run(r_title, size_pt=20, bold=True, color_rgb=RGBColor(15, 23, 42))

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("โมดูลที่ 2: เจาะลึกหน้าจอ Step 2 — บันทึก Design & แบบแปลนติดตั้ง (Blueprints & CAD Training Screen Guide)")
    format_run(r_sub, size_pt=15, bold=True, color_rgb=RGBColor(99, 102, 241))

    # Lead text
    p_lead = doc.add_paragraph()
    r_lead = p_lead.add_run(
        "คู่มือฉบับสมบูรณ์สำหรับวิทยากรผู้ฝึกอบรม (Trainer) สถาปนิก มัณฑนากร และวิศวกร ในการทำความเข้าใจโครงสร้างหน้าจอ "
        "ระบบการจัดการแบบแปลนหลายโซน/ห้อง (Multi-Zone) การตรวจสอบความถูกต้องผ่าน Lightbox "
        "การติดตามเวลา SLA และการส่งต่องานเข้าสู่ Step 3 (นำ BOQ เข้าระบบ)"
    )
    format_run(r_lead, size_pt=13, italic=True, color_rgb=RGBColor(71, 85, 105))

    # Image
    img_path = r"c:\atgv\pmt_flow\doc\img\step2_screen.png"
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(2)
        run_img = p_img.add_run()
        run_img.add_picture(img_path, width=Inches(6.4))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_after = Pt(16)
        r_cap = p_cap.add_run("ภาพที่ 2.1: ภาพรวมหน้าจอ Step 2: บันทึก Design & แบบแปลนติดตั้ง (ขณะชี้ปุ่ม ยืนยันย้ายไป Step 3)")
        format_run(r_cap, size_pt=11, italic=True, color_rgb=RGBColor(100, 116, 139))

    # Section 1: Objectives
    p_h1 = doc.add_paragraph()
    p_h1.paragraph_format.space_before = Pt(14)
    p_h1.paragraph_format.space_after = Pt(6)
    r_h1 = p_h1.add_run("1. วัตถุประสงค์และบทบาทของหน้าจอ (Purpose & Learning Objectives)")
    format_run(r_h1, size_pt=16, bold=True, color_rgb=RGBColor(30, 58, 138))

    doc.add_paragraph(
        "หน้าจอ Step 2 เป็นศูนย์กลางด้านงานออกแบบและวิศวกรรม (Engineering & Design Center) มีเป้าหมายหลักในการฝึกอบรมดังนี้:",
        style=None
    )
    objectives = [
        ("เข้าใจสถาปัตยกรรมคิวงาน (Single State Queue): ", "กรองเฉพาะงานที่กำลังรอทำแบบ หรือแนบแบบแล้วรอส่งต่อ เพื่อลดความสับสน"),
        ("จัดการงานแบบหลายโซนห้อง (Multi-Zone / Multi-Room): ", "รองรับงาน Renovate ขนาดใหญ่ เช่น 1 โครงการมีทั้งงานครัว, ห้องน้ำ, ห้องนอนใหญ่"),
        ("ควบคุมและจัดเก็บไฟล์มาตรฐาน (CAD & PDF Management): ", "รองรับไฟล์ .DWG, .DXF, .PDF, 3D Render และควบคุมประวัติเวอร์ชัน (v1 Draft, v2 Approved, v3 Final)"),
        ("วิเคราะห์แดชบอร์ดสถิติ และควบคุม SLA (24 ชั่วโมง): ", "ติดตามเวลานับถอยหลัง SLA เพื่อป้องกันงานออกแบบคั่งค้างเกินกำหนด"),
        ("ขั้นตอนการส่งต่องาน (Hand-off to Step 3): ", "การตรวจสอบความพร้อมและกดยืนยันย้ายไป Step 3 เพื่อให้ฝ่ายประเมินราคาเริ่มคีย์ BOQ ทันที")
    ]
    for bold_prefix, text in objectives:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_before = Pt(1)
        bp.paragraph_format.space_after = Pt(2)
        r_b = bp.add_run(bold_prefix)
        format_run(r_b, size_pt=13, bold=True, color_rgb=RGBColor(15, 23, 42))
        r_t = bp.add_run(text)
        format_run(r_t, size_pt=13, color_rgb=RGBColor(51, 65, 85))

    # Section 2: Screen Anatomy
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(18)
    p_h2.paragraph_format.space_after = Pt(6)
    r_h2 = p_h2.add_run("2. โครงสร้างองค์ประกอบบนหน้าจอ (Screen Anatomy Breakdown)")
    format_run(r_h2, size_pt=16, bold=True, color_rgb=RGBColor(30, 58, 138))

    # 2.1 Pipeline Sidebar
    p_sub1 = doc.add_paragraph()
    r_sub1 = p_sub1.add_run("2.1 แถบกระบวนการทำงานหลัก 5 สเต็ป (Left Pipeline Sidebar)")
    format_run(r_sub1, size_pt=14, bold=True, color_rgb=RGBColor(79, 70, 229))

    pipe_tbl = doc.add_table(rows=6, cols=3)
    pipe_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(pipe_tbl)
    
    pipe_headers = ["ขั้นตอน (5 STEPS PIPELINE)", "ตัวเลขในภาพ", "บทบาทหน้าที่ในการปฏิบัติงาน"]
    for i, h in enumerate(pipe_headers):
        c = pipe_tbl.cell(0, i)
        set_cell_background(c, "F1F5F9")
        set_cell_margins(c, 80, 80, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(h)
        format_run(r, size_pt=12, bold=True, color_rgb=RGBColor(15, 23, 42))

    pipe_rows = [
        ("Step 1: บันทึกงาน / รับ Order", "7", "งานใหม่ที่ส่งต่อมาจากระบบ INT รอการคัดกรองและกดรับเข้าระบบ PMT"),
        ("Step 2: บันทึก Design (หน้าจอปัจจุบัน)", "9 (Active)", "งานที่อยู่ในมือทีมออกแบบเพื่อจัดทำแบบแปลน CAD/PDF และแยกโซนห้อง"),
        ("Step 3: นำ BOQ เข้าระบบ", "0", "คิวงานรอถอดรายการวัสดุ-ค่าแรง และนำเข้าไฟล์ใบเสนอราคา BOQ"),
        ("Step 4: บันทึก Ticket & ใบเสร็จ", "1", "งานที่อยู่ระหว่างชำระเงิน เปิดใบสั่งงาน (Ticket) และแนบใบเสร็จ"),
        ("Step 5: บันทึก BOQ เข้า Project", "0", "การแปลงรายการ BOQ เข้าสู่แผนงานช่างบน Gantt Timeline")
    ]
    for r_i, (step, count, desc) in enumerate(pipe_rows, start=1):
        bg = "EDE9FE" if "Step 2" in step else ("FFFFFF" if r_i % 2 == 1 else "F8FAFC")
        for c_i, val in enumerate([step, count, desc]):
            c = pipe_tbl.cell(r_i, c_i)
            set_cell_background(c, bg)
            set_cell_margins(c, 80, 80, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            is_b = (c_i < 2) or ("Step 2" in step)
            format_run(r, size_pt=12, bold=is_b, color_rgb=RGBColor(91, 33, 182) if "Step 2" in step else RGBColor(51, 65, 85))

    doc.add_paragraph()

    # 2.2 Segment Distribution
    p_sub2 = doc.add_paragraph()
    r_sub2 = p_sub2.add_run("2.2 สัดส่วนประเภทงานใน Step 2 (Segment Distribution Summary)")
    format_run(r_sub2, size_pt=14, bold=True, color_rgb=RGBColor(79, 70, 229))

    dist_tbl = doc.add_table(rows=5, cols=3)
    dist_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(dist_tbl)

    dist_headers = ["หมวดหมู่ประเภทบริการ", "สถิติในภาพ", "ความสำคัญและการนำไปใช้"]
    for i, h in enumerate(dist_headers):
        c = dist_tbl.cell(0, i)
        set_cell_background(c, "F1F5F9")
        set_cell_margins(c, 80, 80, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(h)
        format_run(r, size_pt=12, bold=True, color_rgb=RGBColor(15, 23, 42))

    dist_rows = [
        ("Quick Services (ติดตั้งด่วน)", "0 รายการ (0%)", "งานติดตั้งด่วน เช่น แอร์/ปั๊มน้ำ (มักใช้แบบมาตรฐานและ Fast-track ข้ามไป Step 4 ได้ทันที)"),
        ("Renovate (งานปรับปรุง)", "2 รายการ (100%)", "กลุ่มงานหลักของ Step 2 ต้องมีแบบแปลนเฉพาะ เช่น งานครัว Built-in, งานระบบประปา, ปูกระเบื้อง"),
        ("MA & Maintenance (บำรุงรักษา)", "0 รายการ (0%)", "งานสัญญาบำรุงรักษาเชิงป้องกันตามรอบ"),
        ("มีแบบ Design แล้ว (ความคืบหน้า)", "1 รายการ (10%)", "ความคืบหน้าของงานที่มีแบบแปลนแล้วและพร้อมส่งต่อเข้าสู่ Step 3")
    ]
    for r_i, (cat, stat, desc) in enumerate(dist_rows, start=1):
        bg = "FFFFFF" if r_i % 2 == 1 else "F8FAFC"
        for c_i, val in enumerate([cat, stat, desc]):
            c = dist_tbl.cell(r_i, c_i)
            set_cell_background(c, bg)
            set_cell_margins(c, 80, 80, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            format_run(r, size_pt=12, bold=(c_i < 2), color_rgb=RGBColor(15, 23, 42) if c_i == 0 else RGBColor(51, 65, 85))

    doc.add_paragraph()

    # 2.3 Main Table & Action Buttons
    p_sub3 = doc.add_paragraph()
    r_sub3 = p_sub3.add_run("2.3 ตารางคิวงานหลักและปุ่มดำเนินการ (Single State Queue Table)")
    format_run(r_sub3, size_pt=14, bold=True, color_rgb=RGBColor(79, 70, 229))

    doc.add_paragraph(
        "ตารางคิวงานหลักทำหน้าที่แสดงงานที่ต้องดำเนินการใน Step 2 โดยในภาพตัวอย่างปรากฏ 2 รายการสำคัญ:",
        style=None
    )
    
    q_tbl = doc.add_table(rows=3, cols=4)
    q_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(q_tbl)
    
    q_headers = ["รหัสงาน & ลูกค้า", "ประเภทบริการ", "สถานะ & SLA", "ปุ่มคำสั่งและการทำงาน"]
    for i, h in enumerate(q_headers):
        c = q_tbl.cell(0, i)
        set_cell_background(c, "F1F5F9")
        set_cell_margins(c, 80, 80, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(h)
        format_run(r, size_pt=12, bold=True, color_rgb=RGBColor(15, 23, 42))

    q_rows = [
        ("JOB202609002\nคุณสมศรี สุขใจ", "RENOVATE\nห้องครัว Built-in & ท่อประปา", "In Progress\n✓ ในเกณฑ์ (เหลือ 23:59 ชม.)", 
         "• [ดู/เพิ่มแบบ (1)]: ดูแบบเดิมหรือเพิ่มห้องใหม่\n• [ยืนยันย้ายไป Step 3] (ปุ่มม่วงที่เมาส์ชี้): ส่งงานต่อไปคิวทำ BOQ ทันที"),
        ("JOB202609004\nคุณมาลี มีโชค", "RENOVATE\nปูกระเบื้อง 60x60 ซม. & สุขภัณฑ์", "In Progress\n✓ ในเกณฑ์ (เหลือ 23:59 ชม.)",
         "• [บันทึก Design]: เปิดแบบฟอร์มอัปโหลดแบบแปลนแรก (.dwg/.pdf/รูปภาพ) พร้อมเลือก Template ด่วนได้")
    ]
    for r_i, (j, s, st, act) in enumerate(q_rows, start=1):
        bg = "FFFFFF" if r_i % 2 == 1 else "F8FAFC"
        for c_i, val in enumerate([j, s, st, act]):
            c = q_tbl.cell(r_i, c_i)
            set_cell_background(c, bg)
            set_cell_margins(c, 80, 80, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            format_run(r, size_pt=11.5, bold=(c_i == 0), color_rgb=RGBColor(79, 70, 229) if c_i == 0 else RGBColor(51, 65, 85))

    doc.add_paragraph()

    # Section 3: SOP
    p_h3 = doc.add_paragraph()
    p_h3.paragraph_format.space_before = Pt(18)
    p_h3.paragraph_format.space_after = Pt(6)
    r_h3 = p_h3.add_run("3. ขั้นตอนการปฏิบัติงานมาตรฐาน (SOP: Standard Operating Procedure)")
    format_run(r_h3, size_pt=16, bold=True, color_rgb=RGBColor(30, 58, 138))

    sop_steps = [
        ("ขั้นตอนที่ 1: ตรวจสอบข้อมูลหน้างานและภาพถ่ายสำรวจ 5 จุด", 
         "คลิกที่เลขที่งาน (Job ID) เพื่อเปิดดูหน้าต่างรายละเอียดงาน ศึกษาภาพถ่ายสำรวจหน้างาน 5 จุดมาตรฐาน (พื้นที่ติดตั้ง, จุดยึด Plate, แนวท่อน้ำยา/ระบบไฟ) และคำสั่งพิเศษก่อนลงมือเขียนแบบ"),
        ("ขั้นตอนที่ 2: บันทึกและอัปโหลดแบบแปลนแรก (First Blueprint Entry)", 
         "คลิกปุ่ม '+ บันทึก Design' หรือ 'แนบไฟล์ด่วน' ระบุโซนงาน/ห้อง เช่น 'ห้องครัว Built-in' ลากไฟล์ CAD (.dwg) หรือ PDF มาวาง หรือคลิกเลือกตัวอย่างด่วน (Quick Sample) ระบุเวอร์ชันและชื่อผู้ออกแบบ จากนั้นกด 'บันทึกแบบแปลน'"),
        ("ขั้นตอนที่ 3: การเพิ่มแบบแยกห้อง/งานย่อย (Multi-Zone Extension)", 
         "สำหรับโครงการที่มีหลายห้อง ให้กดปุ่ม '+ เพิ่มงานย่อย/ห้อง' เปลี่ยนชื่อโซนเป็นห้องถัดไป (เช่น ห้องน้ำ) แล้วแนบไฟล์แปลนของห้องนั้น ระบบจะรวมแบบทุกห้องไว้ใต้ Job เดียวกันอย่างเป็นระเบียบ"),
        ("ขั้นตอนที่ 4: การตรวจสอบความถูกต้องผ่าน Lightbox Preview", 
         "คลิกที่ชื่อโซนห้องหรือรูปภาพ Thumbnail เพื่อเปิดหน้าต่าง Lightbox Preview ขยายดูรายละเอียด ลายเส้น และข้อกำหนดทางเทคนิคแบบเต็มตา"),
        ("ขั้นตอนที่ 5: การกดยืนยันส่งต่องานไปยัง Step 3 (Hand-off to BOQ)", 
         "เมื่อแนบแบบแปลนที่จำเป็นครบถ้วนแล้ว ให้คลิกปุ่มสีม่วง 'ยืนยันย้ายไป Step 3' ตรวจสอบรายการสรุปแบบแปลนทั้งหมด แล้วคลิก 'ยืนยันส่งต่อเพื่อสร้าง BOQ ➔' งานจะถูกย้ายเข้าสู่คิวถอดราคาของ Step 3 โดยอัตโนมัติ")
    ]
    for title, desc in sop_steps:
        p_s = doc.add_paragraph()
        p_s.paragraph_format.space_before = Pt(4)
        p_s.paragraph_format.space_after = Pt(2)
        r_st = p_s.add_run(f"📋 {title}\n")
        format_run(r_st, size_pt=13.5, bold=True, color_rgb=RGBColor(15, 23, 42))
        r_sd = p_s.add_run(desc)
        format_run(r_sd, size_pt=12.5, color_rgb=RGBColor(51, 65, 85))

    doc.add_paragraph()

    # Callout for Trainer
    add_callout(
        doc,
        title="เทคนิคการสาธิตสำหรับวิทยากร (Trainer's Demo Tips)",
        text="1. ชี้ให้ผู้เรียนเห็น JOB202609002 ซึ่งมีแบบแนบแล้ว 1 โซน ให้ทดลองคลิกปุ่ม 'ยืนยันย้ายไป Step 3' เพื่อดูหน้าต่างสรุป\n"
             "2. สำหรับ JOB202609004 ที่ยังไม่มีแบบ ให้คลิก 'บันทึก Design' แล้วเลือกปุ่มตัวอย่างด่วน '[แบบครัว Built-in]' เพื่อแสดงความรวดเร็วในการทำงาน\n"
             "3. ย้ำเตือนเรื่องเวลานับถอยหลัง SLA (24 ชม.) หากเลยเวลาจะขึ้นเตือนสีแดง เพื่อรักษามาตรฐานการส่งมอบงานแก่ลูกค้า",
        border_color="F59E0B",
        bg_color="FEF3C7"
    )

    # Section 4: FAQ
    p_h4 = doc.add_paragraph()
    p_h4.paragraph_format.space_before = Pt(18)
    p_h4.paragraph_format.space_after = Pt(6)
    r_h4 = p_h4.add_run("4. คำถามที่พบบ่อยและแนวทางปฏิบัติ (FAQ)")
    format_run(r_h4, size_pt=16, bold=True, color_rgb=RGBColor(30, 58, 138))

    faqs = [
        ("Q: กดย้ายไป Step 3 แล้ว ยังสามารถแก้ไขหรือเพิ่มแบบห้องใหม่ได้หรือไม่?",
         "A: ได้ตลอดเวลา สถาปนิกสามารถกลับมาที่ Step 2 เพื่อกด '+ เพิ่มงานย่อย/ห้อง' หรืออัปเดตเวอร์ชันใหม่ (เช่น v3 Final) ได้ ข้อมูลจะซิงค์ไปยังหน้า BOQ และหน้าช่างทันที"),
        ("Q: ช่างที่หน้างานจะสามารถเปิดดูแบบแปลนเหล่านี้ได้อย่างไร?",
         "A: แบบแปลนทั้งหมดจะเชื่อมโยงไปยังหน้ารายละเอียดงาน (Job Detail) และ Mobile App ของช่าง ช่างสามารถเปิดดูไฟล์ PDF หรือภาพขยายบนแท็บเล็ต/มือถือขณะปฏิบัติงานได้ทันที"),
        ("Q: ระบบรองรับไฟล์แบบแปลนประเภทใดบ้าง?",
         "A: รองรับ PDF (.pdf), AutoCAD (.dwg, .dxf), รูปภาพ (.png, .jpg, .webp) และไฟล์ ZIP/RAR โดยระบบมีฟังก์ชันปรับลดขนาดภาพอัตโนมัติเพื่อป้องกันไฟล์หนักเกินไป")
    ]
    for q, a in faqs:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(4)
        p_q.paragraph_format.space_after = Pt(1)
        r_q = p_q.add_run(q)
        format_run(r_q, size_pt=13, bold=True, color_rgb=RGBColor(15, 23, 42))
        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(0)
        p_a.paragraph_format.space_after = Pt(4)
        r_a = p_a.add_run(a)
        format_run(r_a, size_pt=12.5, color_rgb=RGBColor(51, 65, 85))

    # Footer note
    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_foot.paragraph_format.space_before = Pt(30)
    r_foot = p_foot.add_run("─" * 45 + "\nคู่มือฝึกอบรมระบบ PMT Flow Enterprise Operations | ปรับปรุงล่าสุด: กันยายน 2026")
    format_run(r_foot, size_pt=11, italic=True, color_rgb=RGBColor(148, 163, 184))

    out_path = r"c:\atgv\pmt_flow\doc\คู่มือการใช้งาน_Step2_บันทึกแบบแปลนติดตั้ง.docx"
    doc.save(out_path)
    print(f"Successfully created DOCX file size: {os.path.getsize(out_path)} bytes")

if __name__ == "__main__":
    create_document()

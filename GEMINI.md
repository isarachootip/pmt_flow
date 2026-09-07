# Antigravity Rules & Project Guidelines

## 🚨 CRITICAL RULE: PRODUCTION SERVER & HOSTINGER ENVIRONMENT
- **Environment**: The user deploys and runs this application on a **Remote Server / Hostinger (Cloud VPS / Coolify)** at **`https://vibepmt.online`**, **NOT for local machine use only**.
- **Always Commit & Push to Git**:
  - Whenever code changes are made and verified, always compile (`npm run build`).
  - Stage, commit with clear messages, and **`git push origin main`** immediately so Hostinger / Coolify auto-deploys to production.
  - Never stop after only editing local files; the live server must receive the update.
- **Production URL**: Always inform the user that changes are being deployed to `https://vibepmt.online` and advise hard refresh (`Ctrl + F5`) for web cache.

## 👥 USER MANAGEMENT & AUTHENTICATION SYSTEM SCOPE
- **Skill Specification Reference**: Always follow [pmt_flow_skill.md](file:///c:/atgv/pmt_flow/pmt_flow_skill.md) for complete requirements on RBAC, User Management, Log-in/Log-off authentication, and the 7-step pipeline.
- **Mandatory User Log-in & Logout System**:
  - **First-line Gatekeeper**: Unauthenticated access must be strictly blocked by `#login-overlay`, and all views must be protected via `app.navigate` auth guards.
  - **Strict Log-off Redirect**: All logout actions (`sidebar-auth-btn`, `topbar-auth-btn`, `modal-my-profile`, `window.handleLogout`) MUST wipe auth tokens and **hard redirect to `/` (`window.location.href = '/'`)** to cleanly return to the login screen without residual memory or background polling.
  - **DOM Integrity & Anti-Blank Screen**: `#login-overlay` MUST always be a top-level direct child of `<body>` (never nested inside any modal or container). All modals must have balanced closing `</div>` tags. Never set `display: none !important` on `#page-container` in `showLoginOverlay()` to avoid blank screen or Chart.js canvas crashes.
- **Mandatory User Management**: The system MUST retain and protect the User Management functionality:
  - 4 Roles: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER` with consistent `window.roleBadge(role)` UI.
  - User CRUD, Password Reset modal, Soft delete (is_active toggle), and Login Audit Logs.
  - Resilience: Always provide fallback seed data and isolated try/catch error boundaries.

## 📅 DATE FORMAT STANDARD: DD/MM/YYYY
- **Mandatory Across All Views**: ทุกหน้าจอ (All Screens & Views) ต้องแสดงผลวันที่ในรูปแบบ **`DD/MM/YYYY`** (เช่น `07/09/2026`) หากมีเวลาประกอบให้ใช้ `DD/MM/YYYY HH:mm` หรือ `DD/MM/YYYY HH:mm:ss`.
- **Prohibited Formats**: ห้ามแสดงผลเป็น `YYYY-MM-DD` หรือ `MM/DD/YYYY` บน UI ที่ผู้ใช้มองเห็นเด็ดขาด.

## ⏰ TIME FORMAT STANDARD: 24-HOUR FORMAT (STRICTLY NO AM/PM)
- **Mandatory 24-Hour Clock**: ทุกหน้าจอและฟอร์มบันทึกเวลาต้องใช้ระบบ **24 ชั่วโมง (`00:00 - 23:59 น.` หรือ `HH:mm`)** เช่น `07:00`, `08:30`, `12:00`, `13:00`, `17:00`
- **Prohibited Formats**: ห้ามแสดงผลหรือมีปุ่ม `AM` / `PM` บน UI เด็ดขาด (ห้ามใช้ Native `<input type="time">` ของเบราว์เซอร์ ให้ใช้ Custom 24-Hour Dropdown และปุ่ม Quick Shift Presets เสมอ).
- **Daily Technician Work Log**: ต้องรักษาหน้าจอทำงานประจำวันของช่าง (`page-daily-logs`) และโมดอลใน Gantt Chart พร้อมช่องแนบรูปถ่าย 5 รูปและ Lightbox Preview เสมอ.

## 📚 MANDATORY ONLINE SYSTEM MANUAL UPDATE UPON ANY PROCESS CHANGE
- **Strict Mandatory Rule**: ทุกครั้งที่มีการปรับปรุง แก้ไข หรือเพิ่มเติม Process / Workflow ในระบบ (เช่น Step 1 ถึง Step 7, Quick Services Jump, QC Online/On-site, Daily Work Logs) เมื่อโค้ดได้รับการแก้ไขและ Build ผ่านเรียบร้อยแล้ว **จะต้อง Update ตัวคู่มือระบบ Online (`doc/*.md` และหน้าจอ `page-faq` ใน `index.html`) ควบคู่ไปด้วยเสมอ** ห้ามปล่อยให้คู่มือระบบไม่สอดคล้องกับพฤติกรรมจริงของระบบ (100% Code & Documentation Sync).


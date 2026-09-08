# Antigravity Rules & Project Guidelines

## 🚨 CRITICAL RULE: TWO SEPARATE ENVIRONMENTS (DEV vs PRODUCTION)

This project runs on **two independent servers**. Each has its own Coolify instance and its own
PostgreSQL database. They are NOT the same machine and NOT the same data.

| | Dev / Staging | Production |
|---|---|---|
| URL | `https://vibepmt.online` | `https://prod.vibepmt.online` |
| Git branch | `main` | `production` |

- **Agents and developers deploy to DEV only.**
  - After changes are verified: `npm run build`, stage, commit with a clear message, then
    **`git push origin main`**.
  - Coolify on the dev server auto-deploys `main` to `https://vibepmt.online`.
  - Never stop after only editing local files - the dev server must receive the update.
- **🔒 Production is released by a human, never by an agent.**
  - The release command is **`git push origin main:production`**, and **only the user runs it**.
  - An agent MUST NOT push to the `production` branch, and MUST NOT force-push it, for any reason.
  - When work is ready to go live, report what is ready and let the user decide. Do not release
    on their behalf, and do not ask for credentials in order to do it.
  - **Automatic deployment is deliberately OFF on production.** Pushing the `production` branch
    only updates the branch on GitHub - nothing is built and nothing goes live. The user then
    triggers the build themselves in Coolify (Deploy), which is why its history shows
    `Source: Manual`. This is intended; do not suggest enabling auto-deploy there.
- **Never say "deployed to production".** An agent cannot cause a production deploy at all:
  pushing `main` moves the dev server only, and even the `production` branch does not go live
  until the user presses Deploy in Coolify.
- **Verify before reporting - do not assume a push means a deploy.**
  - What is still unreleased: `git log --oneline origin/production..origin/main`
  - Confirm what a site actually serves, by comparing hashes rather than trusting timing:
    `git show <sha>:public/js/app.js | sha256sum` against the `app.js` the site returns.
  - The `Last-Modified` header of a served asset tells you when that container was built - it is
    the fastest way to tell the two environments apart.
  - In the Coolify log, the first lines must name the expected branch and commit sha
    (`Starting deployment of isarachootip/pmt_flow:<branch>`).
- Deploys can take up to ~25 minutes to appear. Do not re-push or re-trigger on the assumption that
  it failed; check the Coolify deployment log first.
- Always advise the user to hard refresh (`Ctrl + F5`) after a deploy.

## 👥 USER MANAGEMENT & AUTHENTICATION SYSTEM SCOPE
- **Skill Specification Reference**: Always follow [pmt_flow_skill.md](file:///c:/atgv/pmt_flow/pmt_flow_skill.md) for complete requirements on RBAC, User Management, Log-in/Log-off authentication, and the 7-step pipeline.
- **Mandatory User Log-in & Logout System**:
  - **First-line Gatekeeper**: Unauthenticated access must be strictly blocked by `#login-overlay`, and all views must be protected via `app.navigate` auth guards.
  - **Strict Log-off Hard Reload**: All logout actions (`sidebar-auth-btn`, `topbar-auth-btn`, `modal-my-profile`, `window.handleLogout`, `auth.logout`) MUST wipe auth tokens, cancel all timers/polling, and **hard reload to `/` (`window.location.replace('/'); window.location.reload();`)** to cleanly return to the login screen without residual memory or background polling.
  - **DOM Integrity & Anti-Blank Screen**: `#login-overlay` MUST always be a top-level direct child of `<body>` (never nested inside any modal or container). All modals must have balanced closing `</div>` tags. Never set `display: none !important` on `#page-container` in `showLoginOverlay()` to avoid blank screen or Chart.js canvas crashes.
- **Mandatory User Management**: The system MUST retain and protect the User Management functionality:
  - 4 Roles: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER` with consistent `window.roleBadge(role)` UI.
  - User CRUD, Password Reset modal, Soft delete (is_active toggle), and Login Audit Logs.
  - Resilience: Always provide fallback seed data and isolated try/catch error boundaries.

## ☀️ THEME STANDARD: STRICT LIGHT THEME ONLY (NO DARK MODE)
- **Mandatory Pure Light Theme**: ทุกหน้าจอต้องแสดงผลใน **ธีมสว่าง (Light Theme) 100%** ห้ามมีปุ่มสลับธีมมืด (Dark Mode Toggle) และตัดการประมวลผลคลาส `.dark` ออกอย่างถาวร เพื่อให้อ่านตัวหนังสือ แผนงาน Gantt และแบบแปลนได้คมชัดสูงสุด และตัดปัญหาหน้าจอค้างหรือสีกลืนกับพื้นหลัง

## 📅 DATE FORMAT STANDARD: DD/MM/YYYY
- **Mandatory Across All Views**: ทุกหน้าจอ (All Screens & Views) ต้องแสดงผลวันที่ในรูปแบบ **`DD/MM/YYYY`** (เช่น `07/09/2026`) หากมีเวลาประกอบให้ใช้ `DD/MM/YYYY HH:mm` หรือ `DD/MM/YYYY HH:mm:ss`.
- **Prohibited Formats**: ห้ามแสดงผลเป็น `YYYY-MM-DD` หรือ `MM/DD/YYYY` บน UI ที่ผู้ใช้มองเห็นเด็ดขาด.

## ⏰ TIME FORMAT STANDARD: 24-HOUR FORMAT (STRICTLY NO AM/PM)
- **Mandatory 24-Hour Clock**: ทุกหน้าจอและฟอร์มบันทึกเวลาต้องใช้ระบบ **24 ชั่วโมง (`00:00 - 23:59 น.` หรือ `HH:mm`)** เช่น `07:00`, `08:30`, `12:00`, `13:00`, `17:00`
- **Prohibited Formats**: ห้ามแสดงผลหรือมีปุ่ม `AM` / `PM` บน UI เด็ดขาด (ห้ามใช้ Native `<input type="time">` ของเบราว์เซอร์ ให้ใช้ Custom 24-Hour Dropdown และปุ่ม Quick Shift Presets เสมอ).
- **Daily Technician Work Log**: ต้องรักษาหน้าจอทำงานประจำวันของช่าง (`page-daily-logs`) และโมดอลใน Gantt Chart พร้อมช่องแนบรูปถ่าย 5 รูปและ Lightbox Preview เสมอ.

## 📚 MANDATORY ONLINE SYSTEM MANUAL UPDATE UPON ANY PROCESS CHANGE
- **Strict Mandatory Rule**: ทุกครั้งที่มีการปรับปรุง แก้ไข หรือเพิ่มเติม Process / Workflow ในระบบ (เช่น Step 1 ถึง Step 7, Quick Services Jump, QC Online/On-site, Daily Work Logs) เมื่อโค้ดได้รับการแก้ไขและ Build ผ่านเรียบร้อยแล้ว **จะต้อง Update ตัวคู่มือระบบ Online (`doc/*.md` และหน้าจอ `page-faq` ใน `index.html`) ควบคู่ไปด้วยเสมอ** ห้ามปล่อยให้คู่มือระบบไม่สอดคล้องกับพฤติกรรมจริงของระบบ (100% Code & Documentation Sync).

## 📊 DEFAULT VIEW STANDARD: STRICTLY LIST VIEW (NO DEFAULT CARD VIEW)
- **Mandatory Default List View**: ทุกหน้าจอที่มีปุ่มสลับมุมมอง (Step 2 Design, Step 3 BOQ, Step 4 Tickets & Receipts, Step 5 Conversion, Gantt Projects) **ต้องเริ่มต้นการแสดงผลเป็น "แบบตารางรายการ (List View)" 100% เสมอ** ห้ามตั้งค่าเริ่มต้นเป็น Card View เพื่อให้เจ้าหน้าที่ (SA / Admin / AE / QC) สแกนข้อมูล, รหัสคำสั่งซื้อ, วันที่, และป้ายสถานะได้อย่างรวดเร็วในบรรทัดเดียว (Card View คงไว้เฉพาะการกดสลับด้วยความสมัครใจของผู้ใช้เท่านั้น).



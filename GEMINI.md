# Antigravity Rules & Project Guidelines

## 🚨 CRITICAL RULE: PRODUCTION SERVER & HOSTINGER ENVIRONMENT
- **Environment**: The user deploys and runs this application on a **Remote Server / Hostinger (Cloud VPS / Coolify)** at **`https://vibepmt.online`**, **NOT for local machine use only**.
- **Always Commit & Push to Git**:
  - Whenever code changes are made and verified, always compile (`npm run build`).
  - Stage, commit with clear messages, and **`git push origin main`** immediately so Hostinger / Coolify auto-deploys to production.
  - Never stop after only editing local files; the live server must receive the update.
- **Production URL**: Always inform the user that changes are being deployed to `https://vibepmt.online` and advise hard refresh (`Ctrl + F5`) for web cache.

## 👥 USER MANAGEMENT & CORE SYSTEM SCOPE
- **Skill Specification Reference**: Always follow [pmt_flow_skill.md](file:///c:/atgv/pmt_flow/pmt_flow_skill.md) for complete requirements on RBAC, User Management, and the 7-step pipeline.
- **Mandatory User Management**: The system MUST retain and protect the User Management functionality:
  - 4 Roles: `ADMIN`, `AE`, `QC`, `CONTACT_CENTER` with consistent `window.roleBadge(role)` UI.
  - User CRUD, Password Reset modal, Soft delete (is_active toggle), and Login Audit Logs.
  - Resilience: Always provide fallback seed data and isolated try/catch error boundaries.

## 📅 DATE FORMAT STANDARD: DD/MM/YYYY
- **Mandatory Across All Views**: ทุกหน้าจอ (All Screens & Views) ต้องแสดงผลวันที่ในรูปแบบ **`DD/MM/YYYY`** (เช่น `07/09/2026`) หากมีเวลาประกอบให้ใช้ `DD/MM/YYYY HH:mm` หรือ `DD/MM/YYYY HH:mm:ss`.
- **Prohibited Formats**: ห้ามแสดงผลเป็น `YYYY-MM-DD` หรือ `MM/DD/YYYY` บน UI ที่ผู้ใช้มองเห็นเด็ดขาด.

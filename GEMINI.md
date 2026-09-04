# Antigravity Rules & Project Guidelines

## 🚨 CRITICAL RULE: PRODUCTION SERVER & HOSTINGER ENVIRONMENT
- **Environment**: The user deploys and runs this application on a **Remote Server / Hostinger (Cloud VPS / Coolify)** at **`https://vibepmt.online`**, **NOT for local machine use only**.
- **Always Commit & Push to Git**:
  - Whenever code changes are made and verified, always compile (`npm run build`).
  - Stage, commit with clear messages, and **`git push origin main`** immediately so Hostinger / Coolify auto-deploys to production.
  - Never stop after only editing local files; the live server must receive the update.
- **Production URL**: Always inform the user that changes are being deployed to `https://vibepmt.online` and advise hard refresh (`Ctrl + F5`) for web cache.

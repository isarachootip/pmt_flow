---
name: hostinger-deployment
description: >-
  Directives and workflow for deploying to Hostinger / Remote Server (vibepmt.online).
  Ensures the agent builds, commits, and pushes to git main so live server gets updated,
  avoiding local-only execution.
---

# Hostinger / Remote Production Server Skill

## Context & Intent
The USER runs and tests this project on a **Hostinger / Remote Production Server** (`https://vibepmt.online`), **NOT on localhost**.

## Key Operational Rules
1. **Always Build & Push to Git**:
   - Whenever any task or modification is completed, compile with `npm run build`.
   - Stage modified files with `git add`.
   - Commit with a clear message and push to `git push origin main`.
2. **Never leave changes unpushed**:
   - Leaving changes only on the local machine causes the remote Hostinger / Coolify server to stay on an outdated build.
3. **Notify the User for Production Verification**:
   - Inform the user that changes are deployed to `https://vibepmt.online`.
   - Remind the user to do a hard refresh (`Ctrl + F5` or `Shift + F5`) to clear browser cache.

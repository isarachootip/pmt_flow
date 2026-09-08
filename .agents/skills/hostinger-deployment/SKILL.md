---
name: hostinger-deployment
description: >-
  Deployment rules for this project's two environments. Dev (vibepmt.online, branch main) is
  deployed by agents; production (prod.vibepmt.online, branch production) is released only by the
  user. Use whenever code changes are finished and need to reach a server.
---

# Deployment Skill - Dev vs Production

## The two environments

This project runs on **two independent servers**, each with its own Coolify instance and its own
PostgreSQL database. Work is tested on dev; production is a deliberate, human-triggered release.

| | Dev / Staging | Production |
|---|---|---|
| URL | `https://vibepmt.online` | `https://prod.vibepmt.online` |
| Git branch | `main` | `production` |
| Auto-deploy | on (push `main` and it builds) | **off, by design** |
| Who deploys | agent or developer | **the user, manually** |

Neither environment runs on localhost. Editing files locally changes nothing until it is pushed.

## Rules

1. **Finish every task by pushing to dev.**
   - `npm run build`, then `git add` the files you actually changed, commit with a clear message,
     then `git push origin main`.
   - Coolify auto-deploys `main` to `https://vibepmt.online`.
   - Leaving changes unpushed means the dev server keeps running an outdated build.

2. **Never push the `production` branch.**
   - The release command is `git push origin main:production` and it belongs to the user alone.
   - Do not run it, do not force-push `production`, and do not ask for credentials to do it.
   - When something is ready to go live, say so and let the user decide.

3. **Production has no auto-deploy, on purpose.** Pushing `production` only moves the branch on
   GitHub; the build runs when the user presses Deploy in Coolify. That is why production
   deployments show `Source: Manual`. Do not treat it as misconfiguration and do not suggest
   turning auto-deploy on.

4. **Do not confuse the two.** Pushing `main` deploys dev only. An agent cannot cause a production
   deploy at all. Saying "deployed to production" after pushing `main` is wrong and has already
   cost real debugging time.

5. **Verify, then report.**
   - Unreleased work: `git log --oneline origin/production..origin/main`
   - What a site really serves: compare `git show <sha>:public/js/app.js | sha256sum` with the
     `app.js` the site returns. Hashes, not assumptions.
   - `Last-Modified` on a served asset = when that container was built. Different values on the two
     URLs prove they are different containers.
   - Coolify's log must open with `Starting deployment of isarachootip/pmt_flow:<branch>`.

6. **Be patient with deploys.** A build can take up to ~25 minutes to go live. Check the Coolify
   deployment log before concluding anything failed; never re-push to "force" it.

7. **Tell the user to hard refresh** (`Ctrl + F5`) after a deploy.

## Release checklist for the user

```
git log --oneline origin/production..origin/main   # what is about to go live
git push origin main:production                    # update the branch
```
Then press **Deploy** on the production resource in Coolify - the push alone does not build.

Rollback, if ever needed: `git push origin <previous-sha>:production --force-with-lease`
(`--force-with-lease`, never plain `--force`).

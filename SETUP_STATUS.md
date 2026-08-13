# FDC Stock Opname - Setup Status & Final Steps

**Created:** August 13, 2026
**Status:** 85% Complete - Final manual steps required

---

## ✅ COMPLETED AUTOMATICALLY

- [x] **GitHub repo deleted** - Old project cleaned up
- [x] **Vercel project deleted** - Old project cleaned up
- [x] **GitHub repo created** - `https://github.com/abdulmughny-bot/fdc-opname`
- [x] **Code pushed** - All branches (main, staging, develop) pushed to GitHub
- [x] **Supabase project created** - `yjbifmdfmxwzpmvzpqwrw`
- [x] **Vercel project created** - `fdc-opname` (linked to GitHub)

---

## ⏳ REMAINING MANUAL STEPS (15 minutes)

### Step 1: Apply Migrations to Supabase Schemas

**Go to:** https://supabase.com/dashboard/project/yjbifmdfmxwzpmvzpqwrw/sql/new

**For each schema (dev, staging, prod) do:**

1. Click "New query"
2. Paste this at the TOP:
```sql
SET search_path TO dev;
```
(Change `dev` to `staging` then `prod` for subsequent runs)

3. Then paste the full migrations from:
```bash
cat "/Users/abdulmughny/FDC Asset/fdc-opname/PROD_MIGRATION.sql"
```

4. Click "Run"
5. ⏳ Wait 30-60 seconds
6. ✅ Done for that schema

**Repeat for:**
- dev schema ← RUN FIRST
- staging schema
- prod schema

---

### Step 2: Set Environment Variables in Vercel

**Go to:** https://vercel.com/dashboard/project/fdc-opname/settings/environment-variables

**Add these variables for PRODUCTION (main branch):**
```
VITE_SUPABASE_URL = https://yjbifmdfmxwzpmvzpqwrw.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqYmlmbWRmeHd6cG12enBxd3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjMwMjQsImV4cCI6MjEwMjE5OTAyNH0.aIs9G39Uixi3F4SEdA-rDNeQeUjrArs5mHTnpUuhldw
VITE_DB_SCHEMA = prod
```

For each variable:
- Enter Key and Value
- Select Target: **Production**
- Click "Save"

**Add these variables for PREVIEW (staging branch):**
```
VITE_SUPABASE_URL = https://yjbifmdfmxwzpmvzpqwrw.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqYmlmbWRmeHd6cG12enBxd3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjMwMjQsImV4cCI6MjEwMjE5OTAyNH0.aIs9G39Uixi3F4SEdA-rDNeQeUjrArs5mHTnpUuhldw
VITE_DB_SCHEMA = staging
```

For each variable:
- Enter Key and Value
- Select Target: **Preview**
- Click "Save"

---

### Step 3: Verify Deployments

1. **Go to:** https://vercel.com/dashboard/project/fdc-opname/deployments
2. **Check for deployments:**
   - ✅ main branch → Production
   - ✅ staging branch → Preview
   - ✅ develop branch → (optional)

If no deployments yet, Vercel will auto-deploy once env vars are set.

3. **Wait for builds to complete** (usually 2-3 minutes)

---

### Step 4: Test All Three Environments

**Production:**
```
https://fdc-opname.vercel.app
```
- Try to log in
- Check dashboard loads
- Test filters

**Staging/Preview:**
```
https://fdc-opname-[random-id].vercel.app
```
(Find URL in Vercel deployments)
- Try to log in
- Check dashboard loads

**Local Development:**
```bash
cd "/Users/abdulmughny/FDC Asset/fdc-opname"
npm run dev
# Go to http://localhost:5173
```

---

## 📋 YOUR CREDENTIALS

**Supabase:**
- Project Ref: `yjbifmdfmxwzpmvzpqwrw`
- Project URL: `https://yjbifmdfmxwzpmvzpqwrw.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqYmlmbWRmeHd6cG12enBxd3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjMwMjQsImV4cCI6MjEwMjE5OTAyNH0.aIs9G39Uixi3F4SEdA-rDNeQeUjrArs5mHTnpUuhldw`
- Database Password: `Mughy0212!`

**GitHub:**
- Repo: `https://github.com/abdulmughny-bot/fdc-opname`
- Branches: main, staging, develop

**Vercel:**
- Project: `fdc-opname`
- ID: `prj_rifPE0OhPyK1q9TpBGMDoMc663MU`

---

## 🚀 NEXT WORKFLOW

**Going forward:**

1. **Develop locally** on `develop` branch
   ```bash
   git checkout develop
   npm run dev
   ```

2. **Push to staging** to test
   ```bash
   git push origin staging
   # Wait for Vercel preview to build
   # Test at staging URL
   ```

3. **Merge to main** for production
   ```bash
   git checkout main
   git merge staging
   git push origin main
   # Wait for Vercel production to deploy
   ```

4. **Database migrations** (if needed)
   - Add files to `supabase/migrations/`
   - Manually apply to all 3 schemas via Supabase SQL editor
   - Push code to GitHub

---

**That's it! You now have a proper dev → staging → production setup! 🎉**

Let me know when you complete the 4 manual steps and I'll verify everything is working!

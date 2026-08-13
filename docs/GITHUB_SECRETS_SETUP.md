# GitHub Secrets Setup for Database Migrations

This guide explains how to configure GitHub Secrets for automatic Supabase migrations.

## Required Secrets

### 1. `SUPABASE_ACCESS_TOKEN`
This is your personal Supabase access token for authentication.

**How to get it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/account/tokens)
2. Click "Generate new token"
3. Name: `GitHub Actions`
4. Copy the token

**How to add to GitHub:**
1. Go to your repo: **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `SUPABASE_ACCESS_TOKEN`
4. Value: Paste the token you copied
5. Click **Add secret**

### 2. Optional: Database Passwords (for schema-specific operations)

If you need to target specific schemas separately, you may need:
- `SUPABASE_STAGING_DB_PASSWORD` - Password for staging database
- `SUPABASE_PROD_DB_PASSWORD` - Password for production database

**Note:** The current workflow uses the Supabase CLI's project linking, which automatically handles schema targeting based on your project configuration.

## Workflow Behavior

### On Pull Requests (staging):
- Triggers when migrations in `supabase/migrations/` are changed
- Runs `supabase db push --dry-run` to preview changes
- Does NOT apply changes (dry-run only for safety)

### On Main Branch (production):
- Triggers only when pushing to `main`
- Requires environment approval (GitHub will ask for confirmation)
- Runs migrations to production schema

## First-Time Setup

After adding the secret:

1. **Test the workflow:**
   ```bash
   git checkout -b test/migration-workflow
   echo "# test" >> supabase/migrations/test.md
   git add supabase/migrations/test.md
   git commit -m "test: trigger migration workflow"
   git push origin test/migration-workflow
   ```

2. **Check GitHub Actions:**
   - Go to **Actions** tab in your repo
   - Look for "Deploy Database Migrations" workflow
   - It should run and complete successfully

3. **Production approval:**
   - When you merge to main, the workflow will wait for approval
   - Go to the workflow run and click "Review deployments"
   - Approve the production migration

## Troubleshooting

### Workflow not triggering
- Check: Are you editing files in `supabase/migrations/`?
- Check: Did you push to a branch or main?
- Check: Is the workflow file at `.github/workflows/migrate-database.yml`?

### Secret not recognized
- Check: Did you add the secret to the correct repository?
- Check: Secret name matches exactly: `SUPABASE_ACCESS_TOKEN`

### Migration fails
- Check GitHub Actions logs for the specific error
- Common issue: Token expired → Generate a new one
- Common issue: Schema mismatch → Verify project reference is correct

## Cleanup

To remove a secret:
1. Go to **Settings → Secrets and variables → Actions**
2. Find the secret
3. Click the trash icon

## Reference

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Access Tokens](https://supabase.com/docs/guides/auth/managing-user-data#managing-user-sessions-with-tokens)

# Atomic CRM Production Deployment Guide

**Based on lessons learned from playground deployment**

This guide covers deploying Atomic CRM to a production Supabase environment that is **shared** with the Civisto application.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Database Schema Management](#database-schema-management)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Migration Conflict Resolution](#migration-conflict-resolution)

---

## Prerequisites

### Required Information

- **Supabase Project URL** (e.g., `https://xxxxx.supabase.co`)
- **Supabase Anon Key** (from project settings)
- **Supabase Service Role Key** (for migrations)
- **Supabase Access Token** (from https://supabase.com/dashboard/account/tokens)
- **Database Password** (set when creating the project)
- **GitHub Repository** (johanlido/civisto-atomic-crm)

### Tools Needed

- Node.js 22+ and pnpm
- Supabase CLI (`npm install -g supabase`)
- Git and GitHub CLI (`gh`)
- PostgreSQL client (optional, for direct DB access)

---

## Pre-Deployment Checklist

### 1. Create Production Supabase Project

✅ Create a new Supabase project or use existing production project  
✅ Note down the project reference ID (from URL)  
✅ Save database password securely  
✅ Generate and save access token  

### 2. Prepare Repository

✅ Clone the repository:
```bash
gh repo clone johanlido/civisto-atomic-crm
cd civisto-atomic-crm
```

✅ Install dependencies:
```bash
pnpm install
```

### 3. Check Existing Database State

**IMPORTANT:** Since the database is shared with Civisto, check what tables already exist:

```bash
# List all tables in public schema
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  -c "\dt public.*"
```

Or use Supabase Management API:
```bash
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY tablename;"}'
```

---

## Database Schema Management

### Understanding Shared Database

The production database will contain tables from:
- **Civisto application** (existing tables)
- **Atomic CRM** (new tables to be added)

### Table Naming Strategy

**Atomic CRM Tables:**
- `companies`
- `contacts`
- `contactNotes`
- `deals`
- `dealNotes`
- `sales`
- `tags`
- `tasks`
- `init_state` (view)
- `contacts_summary` (view)

**Potential Conflicts:**
- If Civisto already has tables with these names, you'll need to:
  - Use table prefixes (e.g., `crm_contacts`, `crm_companies`)
  - Use a separate schema (e.g., `crm.contacts`)
  - Merge the schemas if they're compatible

### Recommended Approach: Separate Schema

Create a dedicated schema for Atomic CRM:

```sql
-- Create CRM schema
CREATE SCHEMA IF NOT EXISTS crm;

-- Grant permissions
GRANT USAGE ON SCHEMA crm TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA crm TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT ALL ON TABLES TO authenticated;
```

Then modify all migrations to use `crm.` prefix instead of `public.`

---

## Step-by-Step Deployment

### Phase 1: Link Supabase Project

```bash
# Set environment variables
export SUPABASE_ACCESS_TOKEN="your_access_token"
export SUPABASE_DB_PASSWORD="your_db_password"

# Link to production project
supabase link --project-ref [PROJECT_REF]
```

### Phase 2: Review and Modify Migrations

**CRITICAL:** Before applying migrations, review each file:

```bash
ls -la supabase/migrations/
```

**Complete list of migrations (in order):**

1. `20240730075029_init_db.sql` - Creates all tables (companies, contacts, deals, sales, tasks, etc.)
2. `20240730075425_init_triggers.sql` - Creates triggers for user sync (handle_new_user)
3. `20240806124555_task_sales_id.sql` - **CRITICAL:** Adds sales_id column to tasks table
4. `20240807082449_remove-aquisition.sql` - Removes deprecated acquisition field
5. `20240808141826_init_state_configure.sql` - Creates init_state view
6. `20240813084010_tags_policy.sql` - Configures RLS policies for tags
7. `20241104153231_sales_policies.sql` - Configures RLS policies for sales table
8. `20250109152531_email_jsonb.sql` - **CRITICAL:** Adds email_jsonb column and migrates data
9. `20250113132531_phone_jsonb.sql` - **CRITICAL:** Adds phone_jsonb column and migrates data

**Note:** Migrations marked as **CRITICAL** must be applied or the application will fail with schema errors.

**If using separate schema**, modify each migration file:
```bash
# Replace 'public.' with 'crm.' in all migration files
find supabase/migrations -name "*.sql" -exec sed -i 's/public\./crm./g' {} \;
```

### Phase 3: Apply Database Migrations

**Option A: Using Supabase CLI (Recommended)**

```bash
# Push migrations to production
supabase db push

# Verify migrations were applied
supabase migration list
```

**Option B: Using Management API (If CLI fails)**

```bash
# Apply migrations one by one
for file in supabase/migrations/*.sql; do
  echo "Applying: $file"
  curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$(cat $file | jq -Rs .)\"}"
done
```

### Phase 4: Verify All Migrations Applied

**CRITICAL:** Check that these specific migrations were applied:

```bash
# Check for sales_id column in tasks table
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name FROM information_schema.columns WHERE table_name = '\''tasks'\'' AND column_name = '\''sales_id'\'';"}'

# Check for email_jsonb column in contacts table
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name FROM information_schema.columns WHERE table_name = '\''contacts'\'' AND column_name = '\''email_jsonb'\'';"}'

# Check for phone_jsonb column in contacts table
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name FROM information_schema.columns WHERE table_name = '\''contacts'\'' AND column_name = '\''phone_jsonb'\'';"}'
```

If any are missing, apply them manually using the Management API.

### Phase 5: Create Missing Triggers

**IMPORTANT:** The `on_auth_user_updated` trigger is NOT created by the migrations and must be added manually:

```sql
-- Create update user trigger
CREATE OR REPLACE FUNCTION public.handle_update_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.sales
  SET 
    first_name = NEW.raw_user_meta_data ->> 'first_name', 
    last_name = NEW.raw_user_meta_data ->> 'last_name', 
    email = NEW.email
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_update_user();
```

Apply this using:
```bash
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"[SQL_FROM_ABOVE]"}'
```

### Phase 6: Configure Row Level Security (RLS)

Verify RLS policies exist for all tables:

```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

If missing, create policies for `sales` table:

```sql
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.sales
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.sales
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for users based on user_id" ON public.sales
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable delete for users based on user_id" ON public.sales
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());
```

### Phase 7: Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy updatePassword
supabase functions deploy users
supabase functions deploy postmark

# Verify deployment
supabase functions list
```

### Phase 8: Reload PostgREST Schema Cache

**CRITICAL:** After migrations, reload the schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

Or via API:
```bash
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"NOTIFY pgrst, '\''reload schema'\'';"}'
```

### Phase 9: Build and Deploy Frontend

```bash
# Create production environment file
cat > .env.production.local << EOF
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
VITE_IS_DEMO=false
EOF

# Build with environment variables
export NODE_ENV=production
export VITE_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export VITE_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
export VITE_IS_DEMO="false"

pnpm run build

# Verify build contains environment variables
grep -o "[PROJECT_REF]" dist/assets/index-*.js | head -1
# Should output: [PROJECT_REF]

# Deploy to GitHub Pages
pnpm run ghpages:deploy
```

---

## Post-Deployment Configuration

### 1. Configure Authentication URLs

**REQUIRED:** Go to Supabase Dashboard:

https://supabase.com/dashboard/project/[PROJECT_REF]/auth/url-configuration

Set:
- **Site URL:** `https://johanlido.github.io/civisto-atomic-crm/`
- **Redirect URLs:** Add:
  - `https://johanlido.github.io/civisto-atomic-crm/auth-callback.html`
  - `https://johanlido.github.io/civisto-atomic-crm/`

### 2. Create First Admin User

**Option A: Via Supabase Dashboard**
1. Go to Authentication > Users
2. Click "Add User"
3. Enter email and temporary password
4. User will receive invitation email

**Option B: Via SQL**
```sql
-- This will be created automatically when first user signs up
-- The trigger will make them an admin if they're the first user
```

**Option C: Via API**
```bash
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"INSERT INTO public.sales (user_id, first_name, last_name, administrator, email) VALUES ('\''[USER_ID]'\'', '\''Admin'\'', '\''User'\'', true, '\''admin@example.com'\'');"}'
```

### 3. Optional: Configure SMTP

For email invitations and password resets:

1. Go to: https://supabase.com/dashboard/project/[PROJECT_REF]/settings/auth
2. Configure SMTP settings (recommended: Postmark, Resend, AWS SES)
3. Test by inviting a user

### 4. Enable GitHub Pages

1. Go to: https://github.com/johanlido/civisto-atomic-crm/settings/pages
2. Ensure it's enabled and set to `gh-pages` branch
3. Verify site is accessible at: https://johanlido.github.io/civisto-atomic-crm/

---

## Troubleshooting

### Issue: "supabaseUrl is required"

**Cause:** Environment variables not embedded in build

**Solution:**
```bash
# Rebuild with explicit environment variables
export VITE_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export VITE_SUPABASE_ANON_KEY="[YOUR_KEY]"
pnpm run build

# Verify
grep -o "[PROJECT_REF]" dist/assets/index-*.js
```

### Issue: 406 "Not Acceptable" errors

**Cause:** PostgREST schema cache is outdated

**Solution:**
```sql
NOTIFY pgrst, 'reload schema';
```

Wait 30 seconds, then hard refresh browser (Ctrl+Shift+R)

### Issue: "Could not find column 'email_jsonb'"

**Cause:** Migration not applied or schema cache outdated

**Solution:**
1. Check if column exists:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'contacts' AND column_name = 'email_jsonb';
```

2. If missing, apply migration:
```bash
# Apply 20250109152531_email_jsonb.sql
# Apply 20250113132531_phone_jsonb.sql
```

3. Reload schema cache (see above)

### Issue: User updates don't save

**Cause:** Missing `on_auth_user_updated` trigger

**Solution:** Apply the trigger creation SQL from Phase 5

### Issue: "sales_id is missing" when creating tasks

**Cause:** Migration `20240806124555_task_sales_id.sql` not applied

**Solution:**
```sql
ALTER TABLE public.tasks ADD COLUMN sales_id bigint;
```

Then reload schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

Wait 30-60 seconds and hard refresh browser.

### Issue: Duplicate sales records

**Cause:** Multiple records created for same user_id

**Solution:**
```sql
-- Find duplicates
SELECT user_id, COUNT(*) 
FROM public.sales 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Keep only the first record
DELETE FROM public.sales 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM public.sales 
  GROUP BY user_id
);
```

### Issue: "Access Denied" when creating contacts

**Cause:** No sales record for authenticated user

**Solution:**
```sql
-- Create sales record for user
INSERT INTO public.sales (user_id, first_name, last_name, administrator, email)
VALUES ('[USER_ID]', 'First', 'Last', false, 'user@example.com');
```

---

## Migration Conflict Resolution

### Scenario: Shared Database with Civisto

**Problem:** Both applications need to manage migrations independently

**Solution 1: Separate Schemas (Recommended)**

```sql
-- Civisto uses: public schema
-- Atomic CRM uses: crm schema

CREATE SCHEMA IF NOT EXISTS crm;
```

Modify all Atomic CRM migrations:
```bash
sed -i 's/public\./crm./g' supabase/migrations/*.sql
```

Update application code to use `crm` schema:
```typescript
// In dataProvider.ts or supabase config
const supabaseClient = createClient(url, key, {
  db: { schema: 'crm' }
});
```

**Solution 2: Table Prefixes**

Rename all Atomic CRM tables:
- `companies` → `crm_companies`
- `contacts` → `crm_contacts`
- etc.

**Solution 3: Separate Databases**

Use different Supabase projects:
- **Civisto:** One Supabase project
- **Atomic CRM:** Separate Supabase project

### Migration Tracking

Both applications use Supabase migrations with timestamps. To avoid conflicts:

1. **Use different migration prefixes:**
   - Civisto: `202501XX_civisto_*.sql`
   - Atomic CRM: `202501XX_crm_*.sql`

2. **Coordinate migration timestamps:**
   - Ensure no two migrations have the same timestamp
   - Use different date ranges if possible

3. **Use `supabase_migrations` table:**
```sql
-- Check applied migrations
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

### Deployment Workflow

**For Civisto:**
```bash
cd civisto
supabase db push
```

**For Atomic CRM:**
```bash
cd civisto-atomic-crm
supabase db push
```

Both will track their migrations independently in the `supabase_migrations.schema_migrations` table.

---

## Civisto-Specific Configuration

### Customized Settings

The CRM has been customized for Civisto's indoor/outdoor monitoring SaaS business:

**Deal Categories:**
- Indoor Air Quality Monitoring
- Outdoor Environmental Monitoring
- Energy Monitoring & Reporting
- Climate Data Analytics
- Compliance Reporting
- Custom Dashboard Development
- API Integration
- Consulting Services
- Training & Onboarding
- Other

**Company Sectors:**
- Hotels & Hospitality
- Office Buildings
- Commercial Real Estate
- Municipal & Government
- Healthcare Facilities
- Educational Institutions
- Data Centers
- Property Management
- Facility Management Services
- And 11 more relevant sectors

**Task Types:**
- Demo Call, Discovery Call
- Onboarding Call, Technical Setup, Training Session
- Check-in Call, Renewal Discussion, Upsell Meeting
- Site Visit, Sensor Installation, Data Review
- And more

**Deal Stages:**
- Lead → Qualified → Demo Scheduled → Demo Completed
- Proposal Sent → Negotiation → Contract Sent
- Won / Lost / On Hold

### Modifying Configuration

To customize these settings for production:

1. Edit `src/components/atomic-crm/root/defaultConfiguration.ts`
2. Modify the relevant arrays:
   - `defaultDealCategories`
   - `defaultCompanySectors`
   - `defaultTaskTypes`
   - `defaultDealStages`
   - `defaultNoteStatuses`
3. Rebuild and redeploy (see Phase 9)

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] Supabase production project created
- [ ] Database password saved securely
- [ ] Access token generated
- [ ] Existing database tables documented
- [ ] Schema strategy decided (separate schema vs shared)
- [ ] Repository cloned and dependencies installed

### Database Setup
- [ ] Migrations reviewed and modified if needed
- [ ] Migrations applied successfully
- [ ] Missing triggers created (`on_auth_user_updated`)
- [ ] RLS policies verified and created
- [ ] PostgREST schema cache reloaded
- [ ] Database connection tested

### Backend Deployment
- [ ] Edge functions deployed (`updatePassword`, `users`, `postmark`)
- [ ] Edge functions tested
- [ ] Service role key configured for edge functions

### Frontend Deployment
- [ ] Production environment variables configured
- [ ] Frontend built with correct environment variables
- [ ] Environment variables verified in build output
- [ ] Deployed to GitHub Pages
- [ ] GitHub Pages enabled and accessible

### Post-Deployment Configuration
- [ ] Authentication callback URLs configured in Supabase
- [ ] First admin user created
- [ ] SMTP configured (optional but recommended)
- [ ] Test login and user creation
- [ ] Test contact creation
- [ ] Test deal creation
- [ ] Verify all CRUD operations work

### Verification
- [ ] Can log in successfully
- [ ] Can create contacts without errors
- [ ] Can update user profile
- [ ] No 406 errors in browser console
- [ ] No schema cache errors
- [ ] All features working as expected

---

## Quick Reference Commands

### Check Database Connection
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -c "SELECT version();"
```

### Reload Schema Cache
```bash
curl -X POST "https://api.supabase.com/v1/projects/[PROJECT_REF]/database/query" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"query":"NOTIFY pgrst, '\''reload schema'\'';"}'
```

### Check Applied Migrations
```bash
supabase migration list
```

### Deploy Single Edge Function
```bash
supabase functions deploy [function-name]
```

### Rebuild and Redeploy Frontend
```bash
export VITE_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
export VITE_SUPABASE_ANON_KEY="[KEY]"
pnpm run build && pnpm run ghpages:deploy
```

---

## Support and Resources

- **Atomic CRM Documentation:** `/doc` directory in repository
- **Supabase Documentation:** https://supabase.com/docs
- **GitHub Repository:** https://github.com/johanlido/civisto-atomic-crm
- **Supabase Dashboard:** https://supabase.com/dashboard

---

## Deployment Summary

**Estimated Time:** 30-60 minutes (if following this guide)

**Key Lessons from Playground:**
1. ✅ Always reload PostgREST schema cache after migrations
2. ✅ Verify triggers are created (especially `on_auth_user_updated`)
3. ✅ Build frontend with explicit environment variables
4. ✅ Configure auth callback URLs immediately
5. ✅ Create sales records for all authenticated users
6. ✅ Test thoroughly before marking deployment complete

**Production Deployment Date:** _[To be filled]_

**Deployed By:** _[Your name]_

**Production URL:** https://johanlido.github.io/civisto-atomic-crm/

**Supabase Project:** _[Project name/ref]_

---

*This guide was created based on the actual deployment experience to the playground environment and includes all fixes and workarounds discovered during that process.*

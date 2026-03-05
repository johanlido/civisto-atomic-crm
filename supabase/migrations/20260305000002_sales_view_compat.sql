-- ============================================================================
-- Compatibility views for running CRM against the Civisto database.
--
-- The CRM auth provider expects a `sales` table with specific columns.
-- The Civisto database uses a `users` table instead.  This migration
-- creates a `sales` view that maps Civisto users into the shape the CRM
-- expects, plus an `init_state` view used by the auth check.
-- ============================================================================

-- Drop the CRM sales table if it exists (we replace it with a view)
DROP TABLE IF EXISTS public.sales CASCADE;

-- sales view: maps Civisto users → CRM "sales" shape
CREATE OR REPLACE VIEW public.sales
  WITH (security_invoker = on)
AS
SELECT
  -- The CRM expects a bigint id; generate one from row ordering
  ROW_NUMBER() OVER (ORDER BY u.created_at) AS id,
  -- Split full_name into first/last (best-effort)
  SPLIT_PART(COALESCE(u.full_name, u.username, ''), ' ', 1) AS first_name,
  CASE
    WHEN POSITION(' ' IN COALESCE(u.full_name, '')) > 0
      THEN SUBSTRING(u.full_name FROM POSITION(' ' IN u.full_name) + 1)
    ELSE ''
  END AS last_name,
  u.id AS user_id,
  -- Avatar as jsonb matching {src: url} shape the CRM expects
  CASE
    WHEN u.avatar_url IS NOT NULL
      THEN jsonb_build_object('src', u.avatar_url)
    ELSE NULL
  END AS avatar,
  -- Admin flag: reuse the is_crm_admin() function from the ticketing migration
  -- but here we check per-row so the view works for all users
  (
    SELECT au.email IN ('johan@civisto.com', 'daniel@civisto.com', 'admin@civisto.com')
    FROM auth.users au
    WHERE au.id = u.id
  ) AS administrator,
  FALSE AS disabled,
  u.created_at
FROM public.users u;

-- Grants so PostgREST can serve the view
GRANT SELECT ON public.sales TO authenticated;
GRANT SELECT ON public.sales TO anon;

-- init_state view: returns > 0 if there are any users (= system is initialized)
CREATE OR REPLACE VIEW public.init_state
  WITH (security_invoker = off)
AS
SELECT COUNT(id) AS is_initialized
FROM (
  SELECT id
  FROM public.users
  LIMIT 1
) AS sub;

GRANT SELECT ON public.init_state TO authenticated;
GRANT SELECT ON public.init_state TO anon;

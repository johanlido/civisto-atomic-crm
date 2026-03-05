-- Fix: the sales view's admin check accesses auth.users, which
-- authenticated users cannot read.  Use a SECURITY DEFINER function
-- so the check runs with elevated privileges.

CREATE OR REPLACE FUNCTION public.is_crm_admin_by_id(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email IN ('johan@civisto.com', 'daniel@civisto.com', 'admin@civisto.com')
    FROM auth.users
    WHERE id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the sales view using the SECURITY DEFINER function
CREATE OR REPLACE VIEW public.sales
  WITH (security_invoker = on)
AS
SELECT
  ROW_NUMBER() OVER (ORDER BY u.created_at) AS id,
  SPLIT_PART(COALESCE(u.full_name, u.username, ''), ' ', 1) AS first_name,
  CASE
    WHEN POSITION(' ' IN COALESCE(u.full_name, '')) > 0
      THEN SUBSTRING(u.full_name FROM POSITION(' ' IN u.full_name) + 1)
    ELSE ''
  END AS last_name,
  u.id AS user_id,
  CASE
    WHEN u.avatar_url IS NOT NULL
      THEN jsonb_build_object('src', u.avatar_url)
    ELSE NULL
  END AS avatar,
  public.is_crm_admin_by_id(u.id) AS administrator,
  FALSE AS disabled,
  u.created_at
FROM public.users u;

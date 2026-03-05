-- The handle_new_user / handle_update_user triggers try to INSERT/UPDATE
-- the sales table, which is now a view.  Drop them to prevent errors.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_update_user();

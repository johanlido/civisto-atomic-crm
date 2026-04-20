-- ============================================================================
-- Shared Civisto/Atomic CRM ticketing notification hardening
-- ============================================================================
-- Purpose:
--   The shared Civisto migration 20260305000001_crm_ticketing_integration.sql
--   redefines ticketing notification functions without SECURITY DEFINER.
--   In the shared database, inserts into public.notifications are protected by
--   RLS, so trigger-driven notification writes can fail unless the functions
--   execute with elevated privileges.
--
-- Scope:
--   This migration keeps the existing ticketing contract intact and only
--   hardens the trigger functions used by Atomic CRM ticketing.
--
-- Important:
--   We intentionally do NOT replace public.sales with a compatibility view in
--   the shared environment, because Atomic CRM still relies on a writable sales
--   table and foreign keys across CRM tables.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_owner_id UUID;
  report_title TEXT;
  commenter_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  SELECT user_id, title INTO report_owner_id, report_title
  FROM public.reports
  WHERE id = NEW.report_id;

  SELECT COALESCE(full_name, username, 'En användare') INTO commenter_name
  FROM public.users
  WHERE id = NEW.user_id;

  IF NEW.is_admin = TRUE THEN
    notification_title := 'Nytt svar från handläggare';
    notification_body := 'Handläggare svarade på din rapport "' || LEFT(report_title, 50) || '": "' || LEFT(NEW.content, 100) || '"';

    IF report_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, report_id, type, title, body, data)
      VALUES (
        report_owner_id,
        NEW.report_id,
        'new_comment',
        notification_title,
        notification_body,
        jsonb_build_object(
          'comment_id', NEW.id,
          'report_id', NEW.report_id,
          'commenter_id', NEW.user_id,
          'commenter_name', commenter_name,
          'is_admin', TRUE
        )
      );
    END IF;
  ELSIF NEW.is_system = TRUE THEN
    notification_title := 'Ny fråga om din rapport';
    notification_body := 'AI-assistenten ställde en fråga om din rapport "' || LEFT(report_title, 50) || '"';

    IF report_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, report_id, type, title, body, data)
      VALUES (
        report_owner_id,
        NEW.report_id,
        'new_comment',
        notification_title,
        notification_body,
        jsonb_build_object(
          'comment_id', NEW.id,
          'report_id', NEW.report_id,
          'commenter_id', NEW.user_id,
          'commenter_name', 'Civisto AI',
          'is_system', TRUE
        )
      );
    END IF;
  ELSE
    IF report_owner_id IS NOT NULL AND report_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, report_id, type, title, body, data)
      VALUES (
        report_owner_id,
        NEW.report_id,
        'new_comment',
        'Ny kommentar på din rapport',
        commenter_name || ' kommenterade: "' || LEFT(NEW.content, 50) || '"',
        jsonb_build_object(
          'comment_id', NEW.id,
          'report_id', NEW.report_id,
          'commenter_id', NEW.user_id,
          'commenter_name', commenter_name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF OLD.admin_status IS DISTINCT FROM NEW.admin_status THEN
    CASE NEW.admin_status
      WHEN 'new' THEN status_label := 'Ny';
      WHEN 'acknowledged' THEN status_label := 'Mottagen';
      WHEN 'in_progress' THEN status_label := 'Under behandling';
      WHEN 'resolved' THEN status_label := 'Åtgärdad';
      WHEN 'closed' THEN status_label := 'Avslutad';
      ELSE status_label := NEW.admin_status;
    END CASE;

    INSERT INTO public.notifications (user_id, report_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      NEW.id,
      'status_change',
      'Din rapport har uppdaterats',
      'Din rapport "' || LEFT(NEW.title, 50) || '" har nu status: ' || status_label,
      jsonb_build_object(
        'old_admin_status', OLD.admin_status,
        'new_admin_status', NEW.admin_status,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'report_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

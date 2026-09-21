// POST /functions/v1/call-result
// Body: { contact_id, phone?, disposition, duration_seconds?, call_sid? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISPOSITIONS = [
  "no_answer",
  "busy",
  "voicemail",
  "human_connected",
  "failed",
] as const;

type Disposition = (typeof DISPOSITIONS)[number];

const dispositionToDialStatus: Record<Disposition, string> = {
  no_answer: "no_answer",
  busy: "busy",
  voicemail: "voicemail",
  human_connected: "connected",
  failed: "failed",
};

const dispositionLabel: Record<Disposition, string> = {
  no_answer: "Inget svar",
  busy: "Upptaget",
  voicemail: "Röstbrevlåda",
  human_connected: "Människa kopplad",
  failed: "Misslyckades",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    contact_id?: number | string;
    phone?: string;
    disposition?: string;
    duration_seconds?: number;
    call_sid?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contactId = Number(body.contact_id);
  const disposition = body.disposition as Disposition | undefined;

  if (!contactId || Number.isNaN(contactId)) {
    return new Response(JSON.stringify({ error: "contact_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!disposition || !DISPOSITIONS.includes(disposition)) {
    return new Response(
      JSON.stringify({
        error: `disposition must be one of: ${DISPOSITIONS.join(", ")}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dialStatus = dispositionToDialStatus[disposition];
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("contacts")
    .update({
      dial_status: dialStatus,
      dialing_started_at: null,
      last_call_at: now,
      last_call_disposition: disposition,
      last_call_sid: body.call_sid ?? null,
      last_call_duration_seconds:
        typeof body.duration_seconds === "number"
          ? body.duration_seconds
          : null,
      last_call_phone: body.phone ?? undefined,
      last_seen: now,
    })
    .eq("id", contactId)
    .select("id, sales_id")
    .maybeSingle();

  if (updateError) {
    console.error("update contact", updateError);
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!updated) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const noteParts = [
    `Samtal: ${dispositionLabel[disposition]}`,
    body.phone ? `nummer ${body.phone}` : null,
    typeof body.duration_seconds === "number"
      ? `${body.duration_seconds}s`
      : null,
    body.call_sid ? `SID ${body.call_sid}` : null,
  ].filter(Boolean);

  const { error: noteError } = await supabase.from("contactNotes").insert({
    contact_id: contactId,
    text: noteParts.join(" · "),
    sales_id: updated.sales_id,
  });

  if (noteError) {
    console.error("contactNotes insert", noteError);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      contact_id: contactId,
      dial_status: dialStatus,
      disposition,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

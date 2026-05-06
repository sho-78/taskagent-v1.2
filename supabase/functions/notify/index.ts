// Notification Dispatcher Edge Function
// Endpoint: POST /functions/v1/notify
// Body: { user_id: string, event_type: string, payload: object }
// Returns: { delivered: { email: bool, line: bool, inapp: bool } }
//
// Implements F-009 / F-016 / F-018 / Flow 4 (chapter 8.5).
// Reads notification_config to determine which channels to use,
// then dispatches via Resend (email) and LINE Messaging API.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const LINE_CHANNEL_ACCESS_TOKEN =
  Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") ?? "";
const FROM_EMAIL = Deno.env.get("NOTIFY_FROM_EMAIL") ?? "noreply@example.com";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { user_id, event_type, payload } = await req.json();
  if (!user_id || !event_type) {
    return new Response("Missing user_id or event_type", { status: 400 });
  }

  // Look up user, configs, and LINE link
  const { data: appUser } = await supabase
    .from("app_user")
    .select("id, email, org_id, line_user_id")
    .eq("id", user_id)
    .single();
  if (!appUser) return new Response("User not found", { status: 404 });

  const { data: configs } = await supabase
    .from("notification_config")
    .select("channel, enabled")
    .eq("user_id", user_id)
    .eq("event_type", event_type)
    .eq("enabled", true);

  const channels = new Set((configs ?? []).map((c) => c.channel));
  const result = { email: false, line: false, inapp: false };

  // Email via Resend
  if (channels.has("email") && RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: appUser.email,
        subject: payload?.subject ?? `[TaskAgent] ${event_type}`,
        text: payload?.text ?? JSON.stringify(payload),
      }),
    });
    result.email = r.ok;
  }

  // LINE via Messaging API
  if (
    channels.has("line") &&
    appUser.line_user_id &&
    LINE_CHANNEL_ACCESS_TOKEN
  ) {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: appUser.line_user_id,
        messages: [
          {
            type: "text",
            text: payload?.text ?? `[TaskAgent] ${event_type}`,
          },
        ],
      }),
    });
    result.line = r.ok;
  }

  // In-app notification (always logs to notification_log)
  if (channels.has("inapp") || result.email || result.line) {
    await supabase.from("notification_log").insert({
      org_id: appUser.org_id,
      user_id,
      event_type,
      channel: result.line ? "line" : result.email ? "email" : "inapp",
      payload,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    result.inapp = channels.has("inapp");
  }

  return new Response(JSON.stringify({ delivered: result }), {
    headers: { "Content-Type": "application/json" },
  });
});

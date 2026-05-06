// LINE Messaging API Webhook
// Endpoint: POST /functions/v1/line-webhook
// Called by LINE when a user adds the Official Account or sends a message.
//
// Handles "follow" event by creating a line_link record (linked to a user
// after they enter a verification code in the app — simplified flow here).
//
// Verifies signature using LINE_CHANNEL_SECRET.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") ?? "";

async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!LINE_CHANNEL_SECRET) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  if (!(await verifySignature(body, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { events } = JSON.parse(body);

  for (const ev of events ?? []) {
    if (ev.type === "follow") {
      // User added the Official Account as friend.
      // Real implementation: store the line_user_id with status="pending"
      // and complete the link when the user enters a code in the app.
      await supabase.from("line_link").upsert(
        {
          // user_id is null until linked via verification code
          user_id: null as unknown as string,
          line_user_id: ev.source.userId,
          status: "pending",
        },
        { onConflict: "line_user_id" }
      );
    }
    // TODO: handle "message" event (e.g. user replies "完了" to mark a task done)
  }

  return new Response("ok");
});

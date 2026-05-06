// AI Task Decomposition Edge Function
// Endpoint: POST /functions/v1/ai-decompose
// Body: { input: string, projectId?: string }
// Returns: { tasks: Array<{ title, est_minutes, priority }> }
//
// Implements F-003 (AI タスク分解) from REQUIREMENTS_v0.5 chapter 5.
// Logs token usage to ai_session table for cost tracking.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `あなたは日本のビジネスチーム向けタスク管理アシスタントです。
ユーザーの自然言語入力を、実行可能なサブタスクに分解してください。
出力は JSON 配列のみで、各要素は { title, est_minutes, priority } を含みます。
priority は "low" | "medium" | "high" | "urgent" のいずれかです。
余計な説明や Markdown 装飾は禁止です。`;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Authenticate the caller via Supabase JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { input } = await req.json();
  if (!input || typeof input !== "string") {
    return new Response("Invalid input", { status: 400 });
  }

  // Call Anthropic
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: input }],
    }),
  });

  if (!response.ok) {
    return new Response(`AI provider error: ${response.status}`, {
      status: 502,
    });
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "[]";
  let tasks: unknown;
  try {
    tasks = JSON.parse(text);
  } catch {
    return new Response("AI returned invalid JSON", { status: 502 });
  }

  // Log usage for cost tracking
  const { data: appUser } = await supabase
    .from("app_user")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (appUser) {
    await supabase.from("ai_session").insert({
      org_id: appUser.org_id,
      user_id: user.id,
      kind: "decompose",
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens:
        (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      prompt: input,
      response: text,
    });
  }

  return new Response(JSON.stringify({ tasks }), {
    headers: { "Content-Type": "application/json" },
  });
});

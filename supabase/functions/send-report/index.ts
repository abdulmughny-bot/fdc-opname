// supabase/functions/send-report/index.ts
//
// Deploy with: supabase functions deploy send-report
// Requires secrets set first:
//   supabase secrets set RESEND_API_KEY=your_resend_key
//   supabase secrets set RESEND_FROM_EMAIL="Stock Opname <reports@yourdomain.com>"
//
// The PDF is generated client-side (browser jsPDF) and sent here as base64 —
// this function's only job is to hold the Resend API key server-side (never
// expose that key to the browser) and log the send.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Not authenticated.");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile) throw new Error("Your account is not provisioned for Stock Opname.");

    const { sessionId, clinicName, recipients, pdfBase64 } = await req.json();
    if (!sessionId || !clinicName || !recipients?.length || !pdfBase64) {
      throw new Error("Missing sessionId, clinicName, recipients, or pdfBase64.");
    }

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Stock Opname <onboarding@resend.dev>",
        to: recipients,
        subject: `Stock Opname Report — ${clinicName}`,
        html: `<p>Attached is the stock opname report for <b>${clinicName}</b>.</p><p>Sent via Stock Opname Control by ${profile.name}.</p>`,
        attachments: [
          { filename: `Opname_${clinicName.replace(/\s+/g, "_")}.pdf`, content: pdfBase64 },
        ],
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      throw new Error("Resend rejected the email: " + errText);
    }

    // Log the send using the USER's own auth context, so RLS applies as normal.
    const { error: insertErr } = await supabase
      .from("reports_sent")
      .insert({ session_id: sessionId, sent_by: profile.name, recipients });
    if (insertErr) throw insertErr;

    await supabase.from("audit_trail").insert({
      user_email: profile.email,
      action: "Sent report",
      detail: `${sessionId} to ${recipients.join(", ")}`,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message ?? err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

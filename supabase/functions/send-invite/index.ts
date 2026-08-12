// supabase/functions/send-invite/index.ts
//
// Sends a "you've been added" email when a Lead adds a brand-new person on
// the People & Access admin tab. Same shape/secrets as send-report — holds
// the Resend key server-side, never exposed to the browser.
//
// Deploy with: supabase functions deploy send-invite
// (Uses the same RESEND_API_KEY / RESEND_FROM_EMAIL secrets as send-report.)

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

    const { email, name, siteUrl, schema } = await req.json();
    if (!email || !name || !siteUrl || !schema) throw new Error("Missing email, name, siteUrl, or schema.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, db: { schema } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Not authenticated.");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile) throw new Error("Your account is not provisioned.");
    if (profile.role !== "Lead") throw new Error("Only Leads can send invites.");

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Stock Opname <onboarding@resend.dev>",
        to: [email],
        subject: "You've been added to FDC Stock Opname",
        html:
          `<p>Hi ${name},</p>` +
          `<p>You've been added to <b>FDC Stock Opname</b> by ${profile.name}.</p>` +
          `<p>Sign in with your FDC Google account (@fdcdentalclinic.co.id) at:</p>` +
          `<p><a href="${siteUrl}">${siteUrl}</a></p>`,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      throw new Error("Resend rejected the email: " + errText);
    }

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

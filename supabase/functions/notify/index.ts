// Supabase Edge Function "notify": sends Secret Spot emails via Resend.
// Body: { type: "booking" | "booking_status" | "message" | "order", id }.
// Safe to call from the browser: it only emails based on what is stored in the database,
// and each email is sent once (owner_notified / guest_notified_status flags).
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const OWNER = Deno.env.get("OWNER_EMAIL") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "Secret Spot <onboarding@resend.dev>";
const REPLY_TO = Deno.env.get("REPLY_TO") ?? OWNER;
const SITE = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const PHONE = "+34 613 528 535";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => `${Number(n).toFixed(2).replace(".", ",")} €`;

function fmtDate(iso: string, lang: "es" | "en") {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

function layout(title: string, inner: string, lang: "es" | "en" = "es") {
  const foot = lang === "es" ? "Nunca te pediremos contraseñas ni datos de tarjeta por email." : "We never ask for passwords or card details by email.";
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E14;padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141923;border-radius:16px;font-family:Arial,sans-serif;color:#E7E5E4">
<tr><td style="padding:24px 28px;border-bottom:1px solid #232B3B"><span style="font-size:20px;font-weight:900;color:#fff">SECRET </span><span style="font-size:20px;font-weight:900;color:#FF6B4A">SPOT</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:22px;color:#fff">${esc(title)}</h1>${inner}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #232B3B;font-size:12px;color:#78716C">Secret Spot · Avinguda dels Pescadors, 201 · 46530 Puçol · <a href="tel:+34613528535" style="color:#F59E0B">${PHONE}</a><br>${foot}</td></tr>
</table></td></tr></table>`;
}

const rows = (r: [string, string][]) =>
  `<table width="100%" style="background:#0B0E14;border-radius:12px;padding:12px 16px;margin:8px 0 20px">${r
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#A8A29E;font-size:14px;width:130px;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#fff;font-size:14px">${v}</td></tr>`)
    .join("")}</table>`;
const button = (href: string, label: string) =>
  href.startsWith("https://") ? `<a href="${esc(href)}" style="display:inline-block;background:#FF5722;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;font-size:14px">${esc(label)}</a>` : "";
const tel = (p: string) => `<a href="tel:${esc(p)}" style="color:#F59E0B">${esc(p)}</a>`;
const mail = (e: string) => `<a href="mailto:${esc(e)}" style="color:#F59E0B">${esc(e)}</a>`;

async function send(to: string, subject: string, html: string) {
  if (!to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, reply_to: REPLY_TO || undefined }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

const GUEST = {
  received: {
    es: ["Hemos recibido tu solicitud de reserva", "¡Solicitud recibida!", "Gracias, {n}. Tu reserva está <strong style=\"color:#F59E0B\">pendiente de confirmación</strong>: te avisaremos en cuanto la confirmemos."],
    en: ["We've received your booking request", "Request received!", "Thanks, {n}. Your booking is <strong style=\"color:#F59E0B\">pending confirmation</strong>: we'll let you know as soon as it's confirmed."],
  },
  confirmed: {
    es: ["Tu reserva está confirmada", "¡Reserva confirmada!", "¡Buenas noticias, {n}! Tu mesa está <strong style=\"color:#34D399\">confirmada</strong>. Te esperamos frente al mar."],
    en: ["Your booking is confirmed", "Booking confirmed!", "Good news, {n}! Your table is <strong style=\"color:#34D399\">confirmed</strong>. See you by the sea."],
  },
  cancelled: {
    es: ["Tu reserva ha sido cancelada", "Reserva cancelada", "Hola, {n}. Tu reserva ha sido <strong style=\"color:#F87171\">cancelada</strong>. Si tienes dudas, llámanos y buscamos otra opción."],
    en: ["Your booking has been cancelled", "Booking cancelled", "Hi {n}. Your booking has been <strong style=\"color:#F87171\">cancelled</strong>. Give us a call and we'll find another option."],
  },
} as const;

// deno-lint-ignore no-explicit-any
function guestEmail(b: any, kind: keyof typeof GUEST) {
  const lang: "es" | "en" = b.lang === "en" ? "en" : "es";
  const [subject, title, intro] = GUEST[kind][lang];
  const L = lang === "es" ? ["Código", "Fecha", "Hora", "Personas"] : ["Code", "Date", "Time", "Guests"];
  const inner = `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${intro.replace("{n}", esc(b.name))}</p>` +
    rows([[L[0], `<strong>${esc(b.code)}</strong>`], [L[1], esc(fmtDate(b.date, lang))], [L[2], esc(b.time)], [L[3], String(b.party_size)]]) +
    `<p style="margin:0 0 20px;font-size:14px;color:#A8A29E">${lang === "es" ? "¿Necesitas cambiar algo? Llámanos al" : "Need to change something? Call us on"} ${tel(PHONE)}.</p>` +
    button(`${SITE}/`, "Secret Spot");
  return [`${subject} · Secret Spot`, layout(title, inner, lang)] as const;
}

async function handle(type: string, id: string) {
  if (type === "booking" || type === "booking_status") {
    const { data: b } = await db.from("bookings").select("*").eq("id", id).single();
    if (!b) return;
    if (type === "booking" && !b.owner_notified) {
      await db.from("bookings").update({ owner_notified: true }).eq("id", id);
      const r: [string, string][] = [["Código", `<strong>${esc(b.code)}</strong>`], ["Fecha", esc(fmtDate(b.date, "es"))], ["Hora", esc(b.time)],
        ["Personas", String(b.party_size)], ["Nombre", esc(b.name)], ["Teléfono", tel(b.phone)], ["Email", mail(b.email)]];
      if (b.note) r.push(["Comentarios", esc(b.note)]);
      await send(OWNER, `Nueva reserva: ${b.name} · ${fmtDate(b.date, "es")} ${b.time} · ${b.party_size} pers.`,
        layout("Nueva reserva", `<p style="margin:0 0 8px;font-size:15px">Nueva solicitud de reserva, <strong style="color:#F59E0B">pendiente</strong> de confirmar.</p>${rows(r)}${button(`${SITE}/admin`, "Abrir el panel")}`));
      await send(b.email, ...guestEmail(b, "received"));
    }
    if (type === "booking_status" && (b.status === "confirmed" || b.status === "cancelled") && b.guest_notified_status !== b.status) {
      await db.from("bookings").update({ guest_notified_status: b.status }).eq("id", id);
      await send(b.email, ...guestEmail(b, b.status));
    }
    return;
  }
  if (type === "message") {
    const { data: m } = await db.from("messages").select("*").eq("id", id).single();
    if (!m || m.owner_notified) return;
    await db.from("messages").update({ owner_notified: true }).eq("id", id);
    const r: [string, string][] = [["Nombre", esc(m.name)], ["Email", mail(m.email)]];
    if (m.phone) r.push(["Teléfono", tel(m.phone)]);
    r.push(["Asunto", esc(m.subject)]);
    await send(OWNER, `Nuevo mensaje web: ${m.subject}`, layout("Nuevo mensaje",
      `${rows(r)}<div style="background:#0B0E14;border-radius:12px;padding:16px;margin:0 0 20px;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(m.message)}</div>${button(`${SITE}/admin`, "Abrir el panel")}`));
    return;
  }
  if (type === "order") {
    const { data: o } = await db.from("orders").select("*, order_items(*)").eq("id", id).single();
    if (!o || o.owner_notified) return;
    await db.from("orders").update({ owner_notified: true }).eq("id", id);
    const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(o.pickup_at));
    // deno-lint-ignore no-explicit-any
    const items = (o.order_items ?? []).sort((a: any, b: any) => a.position - b.position)
      // deno-lint-ignore no-explicit-any
      .map((l: any) => `<tr><td style="padding:4px 0;color:#fff;font-size:14px">${l.quantity} × ${esc(l.name)}</td><td style="padding:4px 0;color:#F59E0B;text-align:right">${eur(l.line_total)}</td></tr>`).join("");
    const r: [string, string][] = [["Pedido", `<strong>${esc(o.order_number)}</strong>`], ["Recogida", `hoy a las <strong>${esc(time)}</strong>`],
      ["Cliente", esc(o.customer_name)], ["Teléfono", tel(o.customer_phone)]];
    if (o.notes) r.push(["Observaciones", esc(o.notes)]);
    await send(OWNER, `Nuevo pedido para recoger ${o.order_number} · ${time} · ${eur(o.total)}`, layout("Nuevo pedido para recoger",
      `<p style="margin:0 0 8px;font-size:15px">Nuevo pedido <strong>para recoger en el local</strong> (pago al recoger).</p>${rows(r)}
<table width="100%" style="background:#0B0E14;border-radius:12px;padding:12px 16px;margin:0 0 20px">${items}
<tr><td style="padding-top:10px;border-top:1px solid #232B3B;color:#fff;font-weight:bold">Total</td><td style="padding-top:10px;border-top:1px solid #232B3B;color:#F59E0B;font-weight:bold;text-align:right">${eur(o.total)}</td></tr></table>`));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { type, id } = await req.json();
    if (typeof id !== "string" || !["booking", "booking_status", "message", "order"].includes(type)) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    await handle(type, id);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify failed", e);
    return new Response(JSON.stringify({ error: "failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

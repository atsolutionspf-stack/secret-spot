"""Transactional email via Emergent's managed email proxy (Resend).

Recipients come from server-side records, bodies from the fixed templates below.
Sends run as background tasks and never fail the API request.
"""

import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

from lib.db import db  # noqa: F401  (ensures .env is loaded)

logger = logging.getLogger(__name__)

# Emergent managed email proxy. This is a CONSTANT, never read from env.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"


def _cfg(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


# ---------------- Guardrail gate (from playbook, unchanged) ----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


# ---------------- Send ----------------
async def send_email(*, to: str, subject: str, html: str) -> str | None:
    """Sends one email. Never raises: failures are logged (runs as a background task)."""
    try:
        _assert_safe_email(subject, html)
        payload = {"to": [to], "subject": subject, "html": html, "from_name": os.environ["EMAIL_FROM_NAME"]}
        reply_to = _cfg("EMAIL_REPLY_TO")
        if reply_to:
            payload["contact_email"] = reply_to
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": os.environ["EMERGENT_EMAIL_KEY"]},
                json=payload,
            )
        resp.raise_for_status()
        email_id = resp.json().get("id")
        logger.info(f"Email sent to {to}: {subject!r} id={email_id}")
        return email_id
    except httpx.HTTPStatusError as e:
        try:
            body = e.response.json()
        except ValueError:
            body = {}
        if body.get("code") in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {body.get('code')} ({e.response.status_code}): {body.get('message', '')}")
        else:
            logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Email send error: {e}")
    return None


# ---------------- Templates ----------------
WEEKDAYS = {
    "es": ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
}
MONTHS = {
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}
PHONE = "+34 613 528 535"
PHONE_HREF = "tel:+34613528535"
ADDRESS = "Avinguda dels Pescadors, 201 · 46530 Puçol, València"


def _fmt_date(iso: str, lang: str) -> str:
    from datetime import date

    d = date.fromisoformat(iso)
    wd, mo = WEEKDAYS[lang][d.weekday()], MONTHS[lang][d.month - 1]
    return f"{wd} {d.day} de {mo}" if lang == "es" else f"{wd}, {d.day} {mo}"


def _site() -> str:
    return (_cfg("PUBLIC_SITE_URL") or "").rstrip("/")


def _layout(title: str, inner: str, lang: str = "es") -> str:
    footer = (
        "Enviado por Secret Spot · Nunca te pediremos contraseñas ni datos de tarjeta por email."
        if lang == "es"
        else "Sent by Secret Spot · We never ask for passwords or card details by email."
    )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0E14;padding:24px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141923;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#E7E5E4">'
        '<tr><td style="padding:24px 28px;border-bottom:1px solid #232B3B">'
        '<span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#FFFFFF">SECRET </span>'
        '<span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#FF6B4A">SPOT</span>'
        '</td></tr>'
        f'<tr><td style="padding:28px">'
        f'<h1 style="margin:0 0 16px;font-size:22px;color:#FFFFFF">{escape(title)}</h1>'
        f'{inner}'
        '</td></tr>'
        f'<tr><td style="padding:18px 28px;border-top:1px solid #232B3B;font-size:12px;color:#78716C">'
        f'Secret Spot · {escape(ADDRESS)} · <a href="{PHONE_HREF}" style="color:#F59E0B">{PHONE}</a><br>{footer}'
        '</td></tr></table></td></tr></table>'
    )


def _rows(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<tr><td style="padding:6px 0;color:#A8A29E;font-size:14px;width:130px;vertical-align:top">{escape(k)}</td>'
        f'<td style="padding:6px 0;color:#FFFFFF;font-size:14px">{v}</td></tr>'
        for k, v in rows
    )
    return f'<table role="presentation" width="100%" style="background:#0B0E14;border-radius:12px;padding:12px 16px;margin:8px 0 20px">{cells}</table>'


def _button(href: str, label: str) -> str:
    if not href.startswith("https://"):
        return ""
    return (
        f'<a href="{escape(href)}" style="display:inline-block;background:#FF5722;color:#FFFFFF;text-decoration:none;'
        f'font-weight:bold;padding:12px 22px;border-radius:999px;font-size:14px">{escape(label)}</a>'
    )


def _guest_lang(b: dict) -> str:
    return "en" if b.get("lang") == "en" else "es"


def owner_new_booking(b: dict) -> tuple[str, str]:
    subject = f"Nueva reserva: {b['name']} · {_fmt_date(b['date'], 'es')} {b['time']} · {b['party_size']} pers."
    rows = [
        ("Código", f"<strong>{escape(b['code'])}</strong>"),
        ("Fecha", escape(_fmt_date(b["date"], "es"))),
        ("Hora", escape(b["time"])),
        ("Personas", str(int(b["party_size"]))),
        ("Nombre", escape(b["name"])),
        ("Teléfono", f'<a href="tel:{escape(b["phone"])}" style="color:#F59E0B">{escape(b["phone"])}</a>'),
        ("Email", f'<a href="mailto:{escape(b["email"])}" style="color:#F59E0B">{escape(b["email"])}</a>'),
    ]
    if b.get("note"):
        rows.append(("Comentarios", escape(b["note"])))
    inner = (
        '<p style="margin:0 0 8px;font-size:15px">Ha entrado una nueva solicitud de reserva. Está <strong style="color:#F59E0B">pendiente</strong> de confirmar.</p>'
        + _rows(rows)
        + _button(f"{_site()}/admin", "Abrir el panel")
    )
    return subject, _layout("Nueva reserva", inner)


def owner_new_message(m: dict) -> tuple[str, str]:
    subject = f"Nuevo mensaje web: {m['subject']}"
    rows = [
        ("Nombre", escape(m["name"])),
        ("Email", f'<a href="mailto:{escape(m["email"])}" style="color:#F59E0B">{escape(m["email"])}</a>'),
    ]
    if m.get("phone"):
        rows.append(("Teléfono", f'<a href="tel:{escape(m["phone"])}" style="color:#F59E0B">{escape(m["phone"])}</a>'))
    rows.append(("Asunto", escape(m["subject"])))
    inner = (
        '<p style="margin:0 0 8px;font-size:15px">Has recibido un mensaje desde el formulario de contacto.</p>'
        + _rows(rows)
        + f'<div style="background:#0B0E14;border-radius:12px;padding:16px;margin:0 0 20px;font-size:14px;line-height:1.6;white-space:pre-wrap">{escape(m["message"])}</div>'
        + _button(f"{_site()}/admin", "Abrir el panel")
    )
    return subject, _layout("Nuevo mensaje", inner)


_GUEST = {
    "received": {
        "es": ("Hemos recibido tu solicitud de reserva", "¡Solicitud recibida!",
               "Gracias, {name}. Hemos recibido tu solicitud de reserva. Está <strong style=\"color:#F59E0B\">pendiente de confirmación</strong>: te avisaremos en cuanto la confirmemos."),
        "en": ("We've received your booking request", "Request received!",
               "Thanks, {name}. We've received your booking request. It is <strong style=\"color:#F59E0B\">pending confirmation</strong>: we'll let you know as soon as it's confirmed."),
    },
    "confirmed": {
        "es": ("Tu reserva está confirmada", "¡Reserva confirmada!",
               "¡Buenas noticias, {name}! Tu mesa está <strong style=\"color:#34D399\">confirmada</strong>. Te esperamos frente al mar."),
        "en": ("Your booking is confirmed", "Booking confirmed!",
               "Good news, {name}! Your table is <strong style=\"color:#34D399\">confirmed</strong>. See you by the sea."),
    },
    "cancelled": {
        "es": ("Tu reserva ha sido cancelada", "Reserva cancelada",
               "Hola, {name}. Lamentamos informarte de que tu reserva ha sido <strong style=\"color:#F87171\">cancelada</strong>. Si tienes cualquier duda, llámanos y buscamos otra opción."),
        "en": ("Your booking has been cancelled", "Booking cancelled",
               "Hi {name}. We're sorry to let you know that your booking has been <strong style=\"color:#F87171\">cancelled</strong>. If you have any questions, give us a call and we'll find another option."),
    },
}


def guest_booking(b: dict, kind: str) -> tuple[str, str]:
    lang = _guest_lang(b)
    subject, title, intro = _GUEST[kind][lang]
    labels = (
        [("Código", "Fecha", "Hora", "Personas")] if lang == "es" else [("Code", "Date", "Time", "Guests")]
    )[0]
    rows = [
        (labels[0], f"<strong>{escape(b['code'])}</strong>"),
        (labels[1], escape(_fmt_date(b["date"], lang))),
        (labels[2], escape(b["time"])),
        (labels[3], str(int(b["party_size"]))),
    ]
    contact = (
        f'<p style="margin:0 0 20px;font-size:14px;color:#A8A29E">¿Necesitas cambiar algo? Llámanos al <a href="{PHONE_HREF}" style="color:#F59E0B">{PHONE}</a> o responde a este email.</p>'
        if lang == "es"
        else f'<p style="margin:0 0 20px;font-size:14px;color:#A8A29E">Need to change something? Call us on <a href="{PHONE_HREF}" style="color:#F59E0B">{PHONE}</a> or reply to this email.</p>'
    )
    inner = (
        f'<p style="margin:0 0 8px;font-size:15px;line-height:1.6">{intro.format(name=escape(b["name"]))}</p>'
        + _rows(rows)
        + contact
        + _button(_site() + "/", "Secret Spot")
    )
    return f"{subject} · Secret Spot", _layout(title, inner, lang)


# ---------------- Background task entry points ----------------
async def notify_new_booking(b: dict) -> None:
    owner = _cfg("OWNER_EMAIL")
    if owner:
        s, h = owner_new_booking(b)
        await send_email(to=owner, subject=s, html=h)
    s, h = guest_booking(b, "received")
    await send_email(to=b["email"], subject=s, html=h)


async def notify_new_message(m: dict) -> None:
    owner = _cfg("OWNER_EMAIL")
    if owner:
        s, h = owner_new_message(m)
        await send_email(to=owner, subject=s, html=h)


async def notify_booking_status(b: dict) -> None:
    if b.get("status") in ("confirmed", "cancelled"):
        s, h = guest_booking(b, b["status"])
        await send_email(to=b["email"], subject=s, html=h)

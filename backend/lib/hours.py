"""Opening hours (Europe/Madrid). Thu 19:00-00:00, Fri-Sun 19:00-01:00, Mon-Wed closed."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Madrid")
# weekday (Mon=0) -> minutes since 19:00 until close
OPEN_FROM = 19 * 60
CLOSE_LEN = {3: 5 * 60, 4: 6 * 60, 5: 6 * 60, 6: 6 * 60}


def now_madrid() -> datetime:
    return datetime.now(TZ)


def slots_for(weekday: int) -> list[str]:
    """Bookable times every 30 min, last slot 30 min before close."""
    length = CLOSE_LEN.get(weekday)
    if length is None:
        return []
    out = []
    for m in range(OPEN_FROM, OPEN_FROM + length - 30 + 1, 30):
        h, mm = divmod(m % (24 * 60), 60)
        out.append(f"{h:02d}:{mm:02d}")
    return out


def is_open(dt: datetime | None = None) -> bool:
    dt = dt or now_madrid()
    minutes = dt.hour * 60 + dt.minute
    wd = dt.weekday()
    # Evening of today
    if wd in CLOSE_LEN and minutes >= OPEN_FROM:
        return True
    # After-midnight tail of yesterday's service
    prev = (wd - 1) % 7
    if prev in CLOSE_LEN:
        tail = OPEN_FROM + CLOSE_LEN[prev] - 24 * 60
        if tail > 0 and minutes < tail:
            return True
    return False


def validate_booking_slot(date_str: str, time_str: str) -> str | None:
    """Returns an error message, or None when the slot is valid."""
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        return "invalid_date"
    now = now_madrid()
    today = now.date()
    if d < today:
        return "date_in_past"
    if d > today + timedelta(days=90):
        return "date_too_far"
    slots = slots_for(d.weekday())
    if not slots:
        return "closed_day"
    if time_str not in slots:
        return "invalid_time"
    if d == today:
        slot_minutes = OPEN_FROM + slots.index(time_str) * 30
        if slot_minutes <= now.hour * 60 + now.minute:
            return "time_in_past"
    return None

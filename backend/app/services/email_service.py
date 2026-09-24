import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "***"
    visible = local[:1] if local else "*"
    return f"{visible}***@{domain}"


def send_complaint_id_email(
    to_email: str,
    case_id: str,
    *,
    is_public: bool = False,
) -> bool:
    """Send the complaint ID after a successful submission.

    Never raises — a mail failure must not roll back the complaint itself.
    Returns True only when an SMTP server accepted the message.
    """
    if not to_email or "@" not in to_email:
        return False

    settings = get_settings()
    host = (settings.smtp_host or "").strip()
    if not host:
        logger.info("SMTP_HOST is not set; skipping complaint-ID email for %s", mask_email(to_email))
        return False

    from_addr = settings.smtp_from or settings.smtp_username
    if not from_addr:
        logger.warning("SMTP_FROM / SMTP_USERNAME missing; cannot send complaint-ID email")
        return False

    status_hint = (
        f"Keep this Complaint ID. Together with the phone number or email you provided, "
        f"it is how you check status at {settings.frontend_url.rstrip('/')}/public/status."
        if is_public
        else "You can also find this Complaint ID under Track Complaint after you sign in."
    )

    text_body = (
        f"Your complaint has been registered.\n\n"
        f"Complaint ID: {case_id}\n\n"
        f"{status_hint}\n\n"
        f"This message does not include the complaint text.\n\n"
        f"— UACMS Demo"
    )
    html_body = f"""\
<html>
  <body style="font-family: Segoe UI, system-ui, sans-serif; color: #1f2937; line-height: 1.5;">
    <p>Your complaint has been registered.</p>
    <p style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Complaint ID</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.04em; margin: 0 0 16px;">{case_id}</p>
    <p>{status_hint}</p>
    <p style="font-size: 13px; color: #6b7280;">This message does not include the complaint text.</p>
    <p>— UACMS Demo</p>
  </body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = f"Your UACMS Complaint ID is {case_id}"
    message["From"] = from_addr
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        logger.info("Sent complaint-ID email for %s to %s", case_id, mask_email(to_email))
        return True
    except Exception:
        logger.exception("Failed to send complaint-ID email for %s to %s", case_id, mask_email(to_email))
        return False

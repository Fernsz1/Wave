"""
MQTT glue (paho-mqtt) — replaces the demo's FastAPI app.py.

Topic scheme (mirrors the demo's `wave/<sid>/score`):
  wave/<lrn>/<MsgType>            per-student   (StudentProgress, QuizAttemptRequest, ...)
  wave/<section-slug>/<MsgType>   section cast  (Rankings, TeacherRemediationMaterial)

Wire payload on every topic is the tokenized envelope array (see codec). Published
with qos=1, retain=True so a device that was offline gets the latest on reconnect
— the LoRa "delivered when reachable" guarantee, proven by the existing demo.
"""
import json
import re
import uuid
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from django.conf import settings

from . import codec

UP_TYPES = ("StudentSignup", "StudentProgress", "StudentSummativeResults", "QuizAttemptRequest")


def slug(section: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", section.lower()).strip("-")


def topic_for(msg_type: str, key: str) -> str:
    return f"wave/{slug(key) if ' ' in key else key}/{msg_type}"


def build_envelope(msg_type: str, obj: dict, *, direction: str, subject: str = "", section: str = "") -> list:
    return codec.encode_envelope(
        {
            "version": codec.PROTOCOL_VERSION,
            "msgId": str(uuid.uuid4()),
            "type": msg_type,
            "direction": direction,
            "subject": subject or None,
            "section": section or None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "chunkIndex": 0,
            "chunkTotal": 1,
            "payload": codec.encode(msg_type, obj),
        }
    )


# ---- lazy shared publisher (used by the web process for REST-triggered casts) ----
_client: mqtt.Client | None = None


def _get_client() -> mqtt.Client | None:
    global _client
    if _client is not None:
        return _client
    try:
        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"wave-web-{uuid.uuid4().hex[:6]}")
        c.connect(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=60)
        c.loop_start()
        _client = c
        return c
    except Exception as exc:  # broker not running (REST-only mode) — degrade gracefully
        print(f"[mqtt] publisher unavailable: {exc}")
        return None


def publish_downstream(messages: list[dict]) -> None:
    """Publish a list of {type, subject, section, topicKey, obj} 'down' casts."""
    if not messages:
        return
    client = _get_client()
    if client is None:
        return
    for m in messages:
        env = build_envelope(m["type"], m["obj"], direction="down", subject=m.get("subject", ""), section=m.get("section", ""))
        topic = topic_for(m["type"], m["topicKey"])
        client.publish(topic, json.dumps(env), qos=1, retain=True)
        print(f"[mqtt] down -> {topic}")

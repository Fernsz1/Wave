"""
Phone/teacher stand-in — subscribes to every Wave topic and prints each
TOKENIZED envelope it receives, decoded via the shared codec. Use it to verify
broker delivery of our protocol (the codec-adapted version of the demo's
phone_sim.py) before wiring the React app.

Run:  python tools/phone_sim.py
Override broker:  WAVE_BROKER_HOST=192.168.1.50 python tools/phone_sim.py
"""
import json
import os
import sys
from pathlib import Path

import paho.mqtt.client as mqtt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # server/ on path
from wave_api import codec  # noqa: E402

BROKER_HOST = os.getenv("WAVE_BROKER_HOST", "127.0.0.1")
BROKER_PORT = int(os.getenv("WAVE_BROKER_PORT", "1883"))


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[phone] connected (rc={reason_code}); subscribing to wave/#")
    client.subscribe("wave/#", qos=1)


def on_message(client, userdata, msg):
    try:
        env = codec.decode_envelope(json.loads(msg.payload.decode()))
        payload = codec.decode(env["type"], env["payload"])
        print(f"[phone] {msg.topic}  {env['direction']} {env['type']}")
        print(f"        {json.dumps(payload, ensure_ascii=False)[:300]}")
    except Exception as exc:  # noqa: BLE001
        print(f"[phone] undecodable on {msg.topic}: {exc}")


c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="wave-phone-sim")
c.on_connect = on_connect
c.on_message = on_message
c.connect(BROKER_HOST, BROKER_PORT)
print("[phone] waiting for tokenized messages... (Ctrl+C to quit)")
c.loop_forever()

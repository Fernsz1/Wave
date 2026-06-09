"""
MQTT subscriber loop: ingests 'up' messages from devices and publishes derived
'down' casts (Rankings, remediation broadcasts) back to the broker.

Run alongside the web server:  python manage.py run_mqtt
"""
import json
import uuid

import paho.mqtt.client as mqtt
from django.conf import settings
from django.core.management.base import BaseCommand

from wave_api import codec, ingest
from wave_api import mqtt as wave_mqtt


class Command(BaseCommand):
    help = "Run the Wave MQTT ingest/broadcast loop."

    def handle(self, *args, **options):
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"wave-server-{uuid.uuid4().hex[:6]}")
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        self.stdout.write(f"[mqtt] connecting to {settings.MQTT_HOST}:{settings.MQTT_PORT}")
        client.connect(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=60)
        client.loop_forever()

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        self.stdout.write(self.style.SUCCESS(f"[mqtt] connected (rc={reason_code})"))
        for t in wave_mqtt.UP_TYPES:
            client.subscribe(f"wave/+/{t}", qos=1)
            self.stdout.write(f"[mqtt] subscribed wave/+/{t}")

    def _on_message(self, client, userdata, msg):
        try:
            env = codec.decode_envelope(json.loads(msg.payload.decode()))
            if env.get("direction") == "down":
                return  # ignore our own broadcasts (avoids re-ingest loop)
            payload = codec.decode(env["type"], wave_mqtt.unpack_payload(env))
            self.stdout.write(f"[mqtt] up <- {msg.topic} ({env['type']})")
            downstream = ingest.handle(
                env["type"], payload, subject=env.get("subject", ""), section=env.get("section", "")
            )
            for m in downstream:
                env_out = wave_mqtt.build_envelope(
                    m["type"], m["obj"], direction="down", subject=m.get("subject", ""), section=m.get("section", "")
                )
                topic = wave_mqtt.topic_for(m["type"], m["topicKey"])
                client.publish(topic, json.dumps(env_out), qos=1, retain=True)
                self.stdout.write(f"[mqtt] down -> {topic}")
        except Exception as exc:  # noqa: BLE001 — keep the loop alive on a bad frame
            self.stderr.write(f"[mqtt] error: {exc}")

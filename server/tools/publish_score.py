"""
Standalone publisher — sends one TOKENIZED StudentProgress "up" message for a
demo student, then exits (codec-adapted version of the demo's publish_score.py).
With `run_mqtt` listening, the server ingests it and broadcasts the recomputed
Rankings + the student's progress back "down" to the section.

Run:  python tools/publish_score.py
Override broker:  WAVE_BROKER_HOST=192.168.1.50 python tools/publish_score.py
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # server/ on path
from wave_api import codec  # noqa: E402

BROKER_HOST = os.getenv("WAVE_BROKER_HOST", "127.0.0.1")
BROKER_PORT = int(os.getenv("WAVE_BROKER_PORT", "1883"))

LRN = os.getenv("WAVE_SID", "101234567900")  # Jacob Flores
SECTION = os.getenv("WAVE_SECTION", "Grade 6 - Section Einstein")

progress = {
    "studentLrn": LRN,
    "section": SECTION,
    "completedTopicIds": ["L1-T2"],
    "quizAttempts": {
        "L1-T2": {"topicId": "L1-T2", "score": 3, "perfectScore": 3,
                  "answers": [1, 2, 1], "completedAt": "2026-06-07"}
    },
    "quizScores": {},
    "summativeScores": {},
}

env = codec.encode_envelope({
    "version": codec.PROTOCOL_VERSION,
    "msgId": str(uuid.uuid4()),
    "type": "StudentProgress",
    "direction": "up",
    "subject": "science",
    "section": SECTION,
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "chunkIndex": 0,
    "chunkTotal": 1,
    "payload": codec.encode("StudentProgress", progress),
})

topic = f"wave/{LRN}/StudentProgress"
c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="wave-pub")
c.connect(BROKER_HOST, BROKER_PORT)
c.loop_start()
info = c.publish(topic, json.dumps(env), qos=1, retain=True)
info.wait_for_publish(timeout=5)
print(f"published tokenized StudentProgress -> {topic}")
c.loop_stop()
c.disconnect()

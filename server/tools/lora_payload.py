"""
Send and receive REAL Wave payloads over a LoRa link (RYLR998 / Heltec-AT).

Unlike the bench tests (which ship placeholder blobs), this tool builds genuine
codec-encoded envelopes — a StudentProgress uplink or a TeacherRemediationMaterial
downlink — fragments them through the same transport the app uses, and on the
receiving end reassembles, decodes, and validates them against the generated wire
model. This is the end-to-end "progress report up / remediation down / student
receives" test over real radios.

Wiring (see FIRMWARE.md): town = address 1 (laptop/server), village = address 2
(Pi/student side). Both boards share NetworkID 18.

Examples (two boards on one laptop, COM3 = server@1, COM4 = student@2):

  # Terminal 1 — student side listens for remediation coming down:
  python tools/lora_payload.py recv --port COM4 --address 2

  # Terminal 2 — teacher/server sends a remediation pack down to addr 2:
  python tools/lora_payload.py send-remediation --port COM3 --address 1 --dest 2 \
      --section "Grade 7 - Section Einstein" --subject science

  # Reverse direction — student sends a progress report up to the server (addr 1);
  # run `recv --port COM3 --address 1` on the other terminal first:
  python tools/lora_payload.py send-progress --port COM4 --address 2 --dest 1 \
      --lrn 101234567891 --section "Grade 7 - Section Einstein" --subject science
"""
import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # server/ on path

from wave_api import codec  # noqa: E402
from wave_api.agents import wire_models  # noqa: E402
from wave_api.lora.rylr998 import Rylr998Driver  # noqa: E402
from wave_api.lora.transport import LORA_SAFE_FRAME, recv_payloads, send_payload  # noqa: E402


def _open_driver(args) -> Rylr998Driver:
    try:
        import serial  # pyserial
    except ImportError:
        sys.exit("pyserial not installed — run: pip install pyserial")
    driver = Rylr998Driver(serial.Serial(args.port, args.baud, timeout=1))
    driver.configure(address=args.address, network_id=args.network_id)
    print(f"[lora] {args.port} configured addr={args.address} net={args.network_id}")
    return driver


def _envelope(msg_type: str, direction: str, payload, *, subject: str, section: str) -> str:
    env = codec.encode_envelope({
        "version": codec.PROTOCOL_VERSION,
        "msgId": uuid.uuid4().hex[:8],
        "type": msg_type,
        "direction": direction,
        "subject": subject or None,
        "section": section or None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "chunkIndex": 0,
        "chunkTotal": 1,
        "payload": codec.encode(msg_type, payload),
    })
    return json.dumps(env, separators=(",", ":"))


def cmd_send_progress(args, driver):
    progress = {
        "studentLrn": args.lrn,
        "section": args.section,
        "completedTopicIds": [args.topic],
        "quizAttempts": {
            args.topic: {
                "topicId": args.topic,
                "score": args.score,
                "perfectScore": 4,
                "answers": [0, 1, 2, 3][: args.score] or [0],
                "completedAt": datetime.now().strftime("%Y-%m-%d"),
            }
        },
        "quizScores": {},
        "summativeScores": {},
    }
    serialized = _envelope("StudentProgress", "up", progress, subject=args.subject, section=args.section)
    _ship(driver, args, serialized, "StudentProgress")


def cmd_send_remediation(args, driver):
    material = {
        "id": f"REM-{uuid.uuid4().hex[:6].upper()}",
        "originalTopicId": args.topic,
        "title": args.title,
        "content": "## Review\nWork through the worked example, then try the practice items.",
        "teacherNotes": "Focus on the step most learners missed.",
        "createdQuiz": [{
            "id": "QREM-01",
            "question": "Which step comes first?",
            "options": ["Plan", "Guess", "Skip", "Stop"],
            "correctAnswerIndex": 0,
            "explanation": "Plan before solving.",
        }],
        "publishDate": datetime.now().strftime("%Y-%m-%d"),
        "targetSection": args.section,
        "chunks": [],
        "isPublished": True,
        "subject": args.subject,
    }
    serialized = _envelope(
        "TeacherRemediationMaterial", "down", material, subject=args.subject, section=args.section
    )
    _ship(driver, args, serialized, "TeacherRemediationMaterial")


def _ship(driver, args, serialized: str, label: str):
    n_frames = (len(serialized) + args.frame - 1) // args.frame
    print(f"[lora] sending {label}: {len(serialized)} bytes -> ~{n_frames} frame(s) to addr {args.dest}")
    msg_id = send_payload(driver, args.dest, serialized, frame_size=args.frame)
    print(f"[lora] sent msgId={msg_id}")


def cmd_recv(args, driver):
    print(f"[lora] listening on addr {args.address}; Ctrl+C to stop")
    for serialized in recv_payloads(driver, poll_timeout=0.5):
        try:
            env = codec.decode_envelope(json.loads(serialized))
            msg_type = env["type"]
            payload = codec.decode(msg_type, env["payload"])
            model = getattr(wire_models, f"Wire{msg_type}", None)
            valid = "ok"
            if model is not None:
                try:
                    model(**payload)
                except Exception as e:  # noqa: BLE001
                    valid = f"INVALID: {e}"
            print(f"\n=== received {msg_type} ({len(serialized)} bytes) — schema {valid} ===")
            print(f"  from section={env.get('section')!r} subject={env.get('subject')!r} dir={env.get('direction')!r}")
            print(json.dumps(payload, indent=2)[:1500])
        except Exception as e:  # noqa: BLE001
            print(f"[lora] could not decode frame: {e}\n  raw={serialized[:200]!r}")
        if args.once:
            return


def main():
    p = argparse.ArgumentParser(description="Send/receive real Wave payloads over LoRa.")
    p.add_argument("--port", required=True, help="serial port, e.g. COM3 or /dev/ttyUSB0")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--address", type=int, default=1, help="this board's LoRa address")
    p.add_argument("--network-id", type=int, default=18)
    p.add_argument("--dest", type=int, default=2, help="destination address (for send)")
    p.add_argument("--frame", type=int, default=LORA_SAFE_FRAME)
    p.add_argument("--subject", default="science")
    p.add_argument("--section", default="Grade 7 - Section Einstein")
    p.add_argument("--topic", default="L1-T2")
    p.add_argument("--once", action="store_true", help="recv: print one payload then exit")

    sub = p.add_subparsers(dest="cmd", required=True)
    sp = sub.add_parser("send-progress", help="student -> server progress report")
    sp.add_argument("--lrn", default="101234567891")
    sp.add_argument("--score", type=int, default=4)
    sr = sub.add_parser("send-remediation", help="teacher/server -> student remediation pack")
    sr.add_argument("--title", default="Remedial: Matter and Its Properties")
    sub.add_parser("recv", help="listen, decode, and validate incoming payloads")

    args = p.parse_args()
    driver = _open_driver(args)
    try:
        {
            "send-progress": cmd_send_progress,
            "send-remediation": cmd_send_remediation,
            "recv": cmd_recv,
        }[args.cmd](args, driver)
    except KeyboardInterrupt:
        print("\n[lora] stopped")
    finally:
        driver.close()


if __name__ == "__main__":
    main()

"""
Late-joiner cache for the classroom router.

Stores the last N downstream payloads per section so a student device that joins
the AP after the LoRa broadcast can still fetch their material via HTTP. Plain
SQLite keeps it dependency-light on the Pi.

The cached `payload` is the **raw serialized tokenized-envelope array** (the exact
JSON string that arrived over the air). The HTTP serve layer returns these
verbatim and the student app decodes them with its codec — byte-identical to
the MQTT path. The cache never decodes the protocol itself.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from typing import List, Optional

DEFAULT_DB = Path("/var/lib/wave/cache.sqlite")
MAX_PER_SECTION = 20


class RelayCache:
    def __init__(self, db_path: Path | str = DEFAULT_DB):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS payloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section TEXT NOT NULL,
                msg_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at REAL NOT NULL
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS payloads_section_idx ON payloads(section, received_at DESC)"
        )
        self._conn.commit()

    def store(self, *, section: str, msg_type: str, payload: str) -> None:
        """Persist a raw serialized tokenized-envelope string for a section."""
        with self._lock:
            self._conn.execute(
                "INSERT INTO payloads(section, msg_type, payload, received_at) VALUES (?,?,?,?)",
                (section, msg_type, payload, time.time()),
            )
            self._conn.execute(
                """
                DELETE FROM payloads
                WHERE section = ? AND id NOT IN (
                    SELECT id FROM payloads WHERE section = ?
                    ORDER BY received_at DESC LIMIT ?
                )
                """,
                (section, section, MAX_PER_SECTION),
            )
            self._conn.commit()

    def list_for_section(self, section: str, msg_type: Optional[str] = None) -> List[str]:
        """Return the raw serialized envelope strings for a section, newest first."""
        with self._lock:
            if msg_type:
                cur = self._conn.execute(
                    "SELECT payload FROM payloads WHERE section = ? AND msg_type = ? ORDER BY received_at DESC",
                    (section, msg_type),
                )
            else:
                cur = self._conn.execute(
                    "SELECT payload FROM payloads WHERE section = ? ORDER BY received_at DESC",
                    (section,),
                )
            return [row[0] for row in cur.fetchall()]

    def close(self) -> None:
        with self._lock:
            self._conn.close()

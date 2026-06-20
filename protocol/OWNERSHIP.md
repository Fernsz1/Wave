# Wave wire contract — data ownership, direction & evolution

This is the authoritative contract that the wire manifest, codecs, schemas, and
both apps must obey. It answers: for each message, **who produces it, where the
canonical copy lives, who consumes it, which direction it travels, and what is
stored vs. derived.** [protocol/wire_manifest.json](wire_manifest.json) is the
single source of truth for field order/types; this file is the source of truth
for *meaning and flow*.

## Direction & addressing

- **up** = device → server (authored on a student/teacher device).
- **down** = server → device (broadcast or derived).
- Topics: `wave/<lrn>/<MsgType>` (per-student) or `wave/<section-slug>/<MsgType>`
  (section cast). The section slug **must** be byte-identical on both sides —
  [server/wave_api/mqtt.py](../server/wave_api/codec.py) `slug()` and
  [Wave/src/sync/topics.ts](../Wave/src/sync/topics.ts) `slug()`; enforced by a
  slug-parity test.
- Every payload rides inside the tokenized **envelope** (version, msgId, type,
  direction, subject?, section?, createdAt, chunkIndex, chunkTotal, payload).

## Message ownership matrix

| Message | Producer | Canonical store | Consumers | Direction | Scope |
|---|---|---|---|---|---|
| `StudentSignup` | student device | `Student` (server) | server | up | per-student |
| `TeacherSignup` | teacher device | `Teacher` (server) | server | up | per-teacher |
| `StudentProgress` | student device (author); server (re-broadcast) | `QuizAttempt` + `SummativeResult` (server) | server, teacher app | up, then down re-cast | per-student → section |
| `StudentSummativeResults` | student device | `SummativeResult` (server) | server, teacher app | up | per-student |
| `QuizAttemptRequest` | teacher device | none (request, not state) | server orchestrator | up | per-section |
| `Rankings` | **server only (derived)** | not stored | student + teacher apps | down | section |
| `TeacherRemediationMaterial` | teacher device / server AI | `RemediationMaterial` (server) | student apps in section | up, then down re-cast | **section only** |
| `LessonCatalog` | server (seeded) | `CatalogDocument` (server) | all apps | down | subject |

## Authoritative vs. derived (never sync derived data as source)

Derived server-side from the rows above (see
[server/wave_api/derive.py](../server/wave_api/derive.py)); they appear on the
wire only as **down** snapshots, never as an authored source of truth:

- `StudentProgress.quizScores` — derived from `QuizAttempt.score / perfect_score`.
- `StudentProgress.completedTopicIds` — derived from existing `QuizAttempt` rows.
- `Rankings` / `Standing[]` — derived section leaderboard.

## Server-only sidecars (never cross the wire)

- `RemediationMaterial.analytics` — `cognitive_level` / `targeted_distractor_key`
  per generated quiz item (extracted in
  [adapters.py](../server/wave_api/agents/adapters.py)).
- `Teacher.password` — auth credential; signup/login is REST-only.
- Agent-internal shapes (letter-keyed options, diagnosis, evaluator output) are
  converted to the wire shape at the adapter boundary and otherwise stay server-side.

## Resolved decisions

1. **Remediation is section-only.** A `TeacherRemediationMaterial` is always
   addressed to a whole section, never a single LRN. The UI-internal
   `assignedStudentLrn` and the unused `targetLessonId` are removed from
   `types.ts`; routing keys on `targetSection`.
2. **`subject` is carried on `TeacherRemediationMaterial`.** Previously subject
   rode only in the envelope and was lost on the REST `/api/remediation` decode,
   breaking student-side subject filtering. `subject` (`enum:subject`, optional)
   is appended to the message so it survives both REST and MQTT round-trips.
   Mapping: server `RemediationMaterial.subject` ↔ wire `subject` ↔ UI `targetSubject`.
3. **`createdSummative` is persisted everywhere it exists.** The frontend AI
   wizard / REST path supplies it; `views.py` finalize and `ingest._save_remediation`
   persist it. (The LangGraph orchestrator currently emits `createdQuiz` only —
   no summative — so its `createdSummative` stays empty by design.)
4. **`QuizAttemptRequest` is the LoRa-capable AI-generation trigger.** It is
   produced by a teacher device and routed by `ingest.handle` to the generation
   orchestrator, so AI generation no longer depends on a live REST endpoint.

## Versioning & evolution rules

- `protocolVersion` (int) is the **wire-breaking** version carried in every
  envelope. Decoders reject/flag a mismatch. Bump it only on an incompatible
  change. `version` (semver string) is human metadata for the manifest file.
- The wire is **append-only**: new fields are added as `optional` at the **end**
  of a message/def's field list; enum values are appended, never reordered or
  repurposed; existing field order is never changed. (The codec is positional —
  order is load-bearing.)
- Optional fields encode as `null` and decode back to *absent* — they must never
  reappear with a value on decode.

## Single source of truth

`wire_manifest.json` → codegen → `Wave/src/schemas/index.ts` (Zod) and
`server/wave_api/agents/wire_models.py` (Pydantic). Those two files are generated
and must not be hand-edited; a `--check` mode fails the build on drift.
`Wave/src/types.ts` stays hand-written (UI-internal) and is kept honest by a
conformance test asserting it is a subset of the wire fields plus the explicit
derived/server-only allowlist above.

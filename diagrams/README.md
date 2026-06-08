# Wave — Architecture Diagrams

Full-stack, layered diagrams for the Wave platform (offline-first React app + tokenized-array
protocol + Django REST/MQTT backend). Each diagram is provided in **Mermaid** (`.md`, renders inline
on GitHub and in VS Code) and **PlantUML** (`.puml`, for formal export).

| Diagram | Files | Reflects | Purpose |
|---|---|---|---|
| **Class** | [class-diagram.md](class-diagram.md) · [.puml](class-diagram.puml) | `Wave/src/types.ts`, `Wave/src/repo/`, `Wave/src/sync/`, `protocol/wire_manifest.json`, `server/wave_api/` | Domain model + repository seam + sync/protocol layer + backend services, in 4 packages. |
| **Activity** | [activity-diagram.md](activity-diagram.md) · [.puml](activity-diagram.puml) | `App.tsx`, `repo/httpRepository.ts`, `sync/`, `views.py`, `ingest.py`, `derive.py`, `mqtt.py` | The live quiz-sync loop: student submits → server persists + broadcasts → teacher updates live (4 swimlanes). |
| **ER** | [er-diagram.md](er-diagram.md) · [.puml](er-diagram.puml) | `server/wave_api/models.py` | The Django relational DB: tables, keys, JSON columns, soft references, and derived (not-stored) fields. |

## How to view

**Mermaid (`.md`)**
- **GitHub:** renders automatically in the file view.
- **VS Code:** install *Markdown Preview Mermaid Support*, then open Preview (`Ctrl+Shift+V`).
- **Browser/CLI:** paste into <https://mermaid.live>, or `npx @mermaid-js/mermaid-cli -i x.md -o x.svg`.

**PlantUML (`.puml`)**
- **VS Code:** install the *PlantUML* extension, open a `.puml`, press `Alt+D` to preview.
- **CLI:** `java -jar plantuml.jar diagrams/*.puml` → PNG/SVG per file.
- **Online:** paste into <https://www.plantuml.com/plantuml>.

## Maintenance

These diagrams are **hand-authored**, not generated. Re-sync them when the authoritative sources
change:
- Domain entities → `Wave/src/types.ts`
- DB tables → `server/wave_api/models.py`
- Protocol message types / field order → `protocol/wire_manifest.json`
- Repository / transport contracts → `Wave/src/repo/repository.ts`, `Wave/src/sync/transport.ts`

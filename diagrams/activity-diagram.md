# Wave — Activity Diagram (live quiz-sync loop)

The signature end-to-end flow: a student submits a quiz and the teacher's Class Records update
**live, with no refresh**, over the internet-free LAN (the same path LoRa will later carry). Lanes
are shown as subgraphs. Reflects [App.tsx](../Wave/src/App.tsx),
[httpRepository.ts](../Wave/src/repo/httpRepository.ts), [sync/](../Wave/src/sync/),
[views.py](../server/wave_api/views.py), [ingest.py](../server/wave_api/ingest.py),
[derive.py](../server/wave_api/derive.py), [mqtt.py](../server/wave_api/mqtt.py).

```mermaid
flowchart TD

  subgraph SA[" Student App "]
    A(["Open topic then Take quiz"]) --> B["Answer current question"]
    B --> C{"All questions<br/>answered?"}
    C -- No --> B
    C -- Yes --> D["Submit then grade locally"]
    D --> E["Optimistic setProgressRecords<br/>(score / 10 shows instantly)"]
    D --> F["repo.saveQuizAttempt"]
    F --> G["codec.encode tokenized envelope<br/>(direction = up)"]
    G --> H{"Online?"}
    H -- No --> I[("Outbox: queue write<br/>localStorage / IndexedDB")]
    I -. on reconnect, flush .-> J
    H -- Yes --> J["POST /api/sync/push<br/>(Authorization Token)"]
  end

  subgraph DS[" Django Server "]
    J --> K["codec.decode_envelope"]
    K --> L["Zod / DRF serializer validate"]
    L --> M[("persist QuizAttempt<br/>upsert by student + topic")]
    M --> N["derive.compute_rankings<br/>and assemble_progress"]
    N --> O["mqtt.publish_downstream<br/>(qos=1, retain=true, down)"]
  end

  subgraph BR[" MQTT Broker (LAN 9001) "]
    O --> P{{"Broker fan-out by topic"}}
    P --> Q1["wave / section / StudentProgress"]
    P --> Q2["wave / section / Rankings"]
  end

  subgraph TA[" Teacher App "]
    Q1 --> R["MqttTransport receives<br/>(ws host 9001)"]
    Q2 --> R
    R --> S["codec.decode + Zod validate<br/>(ignore up-direction echoes)"]
    S --> T["applyRepoUpdate"]
    T --> U["setProgressRecords"]
    U --> V(["Class Records + Rankings<br/>re-render live — no refresh"])
    W(["Teacher offline, then reconnect"]) -. reconnect and subscribe .-> X["Retained message delivered"]
    X --> R
  end

  classDef store fill:#eef2ff,stroke:#6366f1;
  class I,M store;
```

### Notes
- **Per-question gating** (`C`): `Next`/`Submit` are disabled until the current question is answered,
  so a quiz can never be submitted incomplete.
- **Optimistic + sync** (`E`/`F`): the student sees the score immediately; the server is the system of
  record and re-broadcasts the *full* assembled progress, so all clients converge.
- **Offline-first** (`H`/`I`): writes queue in the Outbox and flush on reconnect; the down-channel uses
  **retained QoS-1** messages, so a teacher who was offline (`W`/`X`) gets the latest on reconnect —
  the "delivered when reachable" guarantee.
- **Secondary path (not drawn):** a teacher `publishRemediation` → `POST /api/sync/push` → server
  persists + `publish_downstream` → `wave/<section>/TeacherRemediationMaterial` → students in the
  section receive the pack live.
- `run_mqtt` is optional for this loop — the Django **web process** publishes the down-cast on the
  REST write; `run_mqtt` only handles devices that publish *up* over MQTT.

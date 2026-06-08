# Wave — Class Diagram

Full-stack, layered view of the domain model, the frontend data-access seam, the sync/protocol
layer, and the Django backend services. Reflects [Wave/src/types.ts](../Wave/src/types.ts),
[Wave/src/repo/](../Wave/src/repo/), [Wave/src/sync/](../Wave/src/sync/),
[protocol/wire_manifest.json](../protocol/wire_manifest.json), and
[server/wave_api/](../server/wave_api/).

```mermaid
classDiagram
    direction LR

    %% ───────────────────────── Domain (Wave/src/types.ts) ─────────────────────────
    class StudentUser {
        +string lrn
        +string name
        +string gradeLevel
        +string section?
        +string pin?
    }
    class TeacherUser {
        +string teacherId
        +string name
        +string department
    }
    class Lesson {
        +string id
        +string title
        +string description
    }
    class Topic {
        +string id
        +string name
        +string description
        +string readingTime
        +bool isCustomRemedial?
    }
    class TopicContent {
        +string introduction
        +Section[] sections
        +Definition definition?
        +string keyTakeaway
        +string importantNote?
    }
    class QuizQuestion {
        +string id
        +string question
        +string[] options
        +int correctAnswerIndex
        +string explanation
    }
    class StudentProgress {
        +string studentLrn
        +string[] completedTopicIds
        +Map~string,StudentQuizAttempt~ quizAttempts
        +Map~string,SummativeScore~ summativeScores
    }
    class StudentQuizAttempt {
        +string topicId
        +int score
        +int perfectScore
        +int[] answers
        +string completedAt
    }
    class SummativeScore {
        +int score
        +int perfectScore
        +string feedback
    }
    class TeacherRemediationMaterial {
        +string id
        +string originalTopicId
        +string title
        +string content
        +string teacherNotes
        +QuizQuestion[] createdQuiz
        +string publishDate
        +string assignedStudentLrn
        +string targetSection?
        +bool isPublished
    }

    Lesson "1" *-- "many" Topic : topics
    Topic "1" *-- "1" TopicContent : content
    Topic "1" *-- "many" QuizQuestion : quiz
    StudentProgress "1" *-- "many" StudentQuizAttempt : quizAttempts
    StudentProgress "1" *-- "many" SummativeScore : summativeScores
    TeacherRemediationMaterial "1" o-- "many" QuizQuestion : createdQuiz

    %% ────────────────────── AppData / repository (Wave/src/repo) ──────────────────────
    class WaveRepository {
        <<interface>>
        +bool isLive
        +bootstrap() RepoBootstrap
        +authenticate(role, principalId, name?) void
        +saveQuizAttempt(QuizAttemptWrite) void
        +saveSummativeResult(SummativeWrite) void
        +publishRemediation(material, opts) void
        +enrollStudent(StudentUser) void
        +subscribeLive(SubscribeOpts) void
        +unsubscribeLive() void
    }
    class MockRepository {
        +isLive = false
    }
    class HttpRepository {
        -string apiBase
        -string mqttUrl
        -string token
        -Transport transport
        -Outbox outbox
        +bootstrap() RepoBootstrap
        +push(type, obj, subject, section) void
    }
    class RepoBootstrap {
        +StudentUser[] students
        +Map lessonsBySubject
        +Map progressRecords
        +TeacherRemediationMaterial[] remediationMaterials
    }
    class RepoUpdate {
        <<union>>
        progress | rankings | remediation
    }
    class QuizAttemptWrite {
        +lrn, topicId, lessonId
        +int score
        +int perfectScore
        +int[] answers
        +section, subject
    }
    class Standing {
        +int rank
        +string studentLrn
        +string name
        +int score
        +int perfect
        +int percent
    }

    WaveRepository <|.. MockRepository
    WaveRepository <|.. HttpRepository
    WaveRepository ..> RepoBootstrap
    WaveRepository ..> RepoUpdate
    WaveRepository ..> QuizAttemptWrite
    RepoUpdate ..> Standing
    HttpRepository ..> StudentProgress : decodes/validates

    %% ───────────────────── Sync + Protocol (Wave/src/sync, /protocol) ─────────────────────
    class Transport {
        <<interface>>
        +publish(topic, tokens) void
        +subscribe(glob, handler) void
        +unsubscribeAll() void
        +onReconnect(cb) void
        +close() void
    }
    class MqttTransport {
        -MqttClient client
        connects ws://host:9001
    }
    class InMemoryTransport {
        for tests + retained replay
    }
    class Outbox {
        +int pending
        +enqueue(topic, tokens) void
        +flushAsync(send) int
    }
    class OutboxStore {
        <<interface>>
        +load() OutboxItem[]
        +save(items) void
    }
    class MemoryStore
    class LocalStorageStore
    class Codec {
        <<module>>
        +encode(type, obj) Token[]
        +decode(type, arr) obj
        +encodeEnvelope(env) Token[]
        +decodeEnvelope(arr) env
        reads wire_manifest.json
    }
    class Reassembler {
        +add(Chunk) string?
    }
    class Chunk {
        +string msgId
        +int index
        +int total
        +string data
    }
    class Envelope {
        <<helpers>>
        +buildEnvelope(type, obj, opts)
        +parseEnvelope(tokens)
    }

    Transport <|.. MqttTransport
    Transport <|.. InMemoryTransport
    Outbox --> OutboxStore
    OutboxStore <|.. MemoryStore
    OutboxStore <|.. LocalStorageStore
    HttpRepository --> Transport : live down-channel
    HttpRepository --> Outbox : offline writes
    HttpRepository ..> Codec
    HttpRepository ..> Envelope
    Envelope ..> Codec
    Reassembler ..> Chunk

    %% ───────────────────────── Backend (server/wave_api) ─────────────────────────
    class PyCodec {
        <<module codec.py>>
        Python mirror of Codec
        same wire_manifest.json
    }
    class DjangoViews {
        <<views.py / DRF>>
        +login()
        +catalog() / progress() / rankings()
        +remediation() / allprogress()
        +sync_push()
    }
    class Ingest {
        <<ingest.py>>
        +handle(type, payload, subject, section) downstream[]
    }
    class Derive {
        <<derive.py>>
        +assemble_progress(student) StudentProgress
        +compute_rankings(section, subject) Rankings
    }
    class MqttGlue {
        <<mqtt.py + run_mqtt>>
        +build_envelope(...)
        +publish_downstream(messages)
        +topic_for(type, key)
    }
    class ApiTokenAuth {
        <<auth.py>>
        ApiToken + Principal
        ApiTokenAuthentication
    }

    DjangoViews ..> PyCodec
    DjangoViews ..> Ingest
    DjangoViews ..> Derive
    DjangoViews ..> ApiTokenAuth
    Ingest ..> Derive
    Ingest ..> MqttGlue : publish_downstream
    MqttGlue ..> PyCodec

    %% ───────────────────────── Cross-layer link ─────────────────────────
    HttpRepository ..> DjangoViews : REST + MQTT (tokenized arrays)
    PyCodec ..> Codec : identical wire format
```

### Legend
- `*--` composition, `o--` aggregation, `<|..` interface realization, `..>` dependency/uses.
- `<<module>>` = a TS/Python module of functions (not a class), shown for architectural completeness.
- The **frontend `Codec`** and the **backend `PyCodec`** read the *same* `protocol/wire_manifest.json`,
  which is why the app and server decode identical tokenized arrays over MQTT/LoRa.

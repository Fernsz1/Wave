# Wave — SQLite Database Schema

**Source:** `server/db.sqlite3` (engine `django.db.backends.sqlite3`, see [config/settings.py](config/settings.py))
**Generated:** 2026-06-20 · dumped directly from `sqlite_master` (the live applied schema, not the model definitions)
**Migration state:** `wave_api` migrations `0001`–`0005` all applied. `makemigrations --check` reports **no model/migration drift** — models, migrations, and this schema are aligned.

> SQLite is embedded (a single file), so there is no separate DB server process.
> JSON columns are stored as `text` with a `CHECK (JSON_VALID(...))` constraint; Django's
> `JSONField` reads/writes them via the SQLite JSON1 extension.

---

## Application tables (`wave_api_*`)

### `wave_api_student`
| Column | Type | Constraints |
|---|---|---|
| `lrn` | varchar(12) | **PK** |
| `name` | varchar(120) | NOT NULL |
| `grade_level` | varchar(80) | NOT NULL |
| `section` | varchar(80) | NOT NULL |
| `pin` | varchar(6) | NOT NULL |

### `wave_api_teacher`
| Column | Type | Constraints |
|---|---|---|
| `teacher_id` | varchar(40) | **PK** |
| `name` | varchar(120) | NOT NULL |
| `department` | varchar(120) | NOT NULL |
| `password` | varchar(40) | NOT NULL *(added in `0004`)* |

### `wave_api_apitoken`
| Column | Type | Constraints |
|---|---|---|
| `key` | varchar(64) | **PK** |
| `role` | varchar(10) | NOT NULL |
| `principal_id` | varchar(40) | NOT NULL |

### `wave_api_catalogdocument`
| Column | Type | Constraints |
|---|---|---|
| `subject` | varchar(20) | **PK** |
| `data` | text | NOT NULL, `CHECK (JSON_VALID(data))` |

*Holds the static lesson catalog — one JSON document per subject (`science`, `mathematics`, `english`), each a full `Lesson[]` tree.*

### `wave_api_quizattempt`
| Column | Type | Constraints |
|---|---|---|
| `id` | integer | **PK** AUTOINCREMENT |
| `student_id` | varchar(12) | **FK → wave_api_student(lrn)** |
| `topic_id` | varchar(40) | NOT NULL |
| `lesson_id` | varchar(40) | NOT NULL |
| `score` | integer | NOT NULL |
| `perfect_score` | integer | NOT NULL |
| `answers` | text | NOT NULL, JSON-checked |
| `completed_at` | varchar(20) | NOT NULL |

- **Unique:** (`student_id`, `topic_id`)
- **Index:** (`student_id`)

### `wave_api_summativeresult`
| Column | Type | Constraints |
|---|---|---|
| `id` | integer | **PK** AUTOINCREMENT |
| `student_id` | varchar(12) | **FK → wave_api_student(lrn)** |
| `lesson_id` | varchar(40) | NOT NULL |
| `score` | integer | NOT NULL |
| `total` | integer | NOT NULL |
| `percent` | integer | NOT NULL |
| `passed` | bool | NOT NULL |
| `feedback` | text | NOT NULL |
| `failed_items` | text | NOT NULL, JSON-checked |
| `attempts` | integer | NOT NULL |

- **Unique:** (`student_id`, `lesson_id`)
- **Index:** (`student_id`)

### `wave_api_remediationmaterial`
| Column | Type | Constraints |
|---|---|---|
| `material_id` | varchar(40) | **PK** |
| `subject` | varchar(20) | NOT NULL |
| `original_topic_id` | varchar(40) | NOT NULL |
| `title` | varchar(200) | NOT NULL |
| `content` | text | NOT NULL |
| `teacher_notes` | text | NOT NULL |
| `created_quiz` | text | NOT NULL, JSON-checked |
| `created_summative` | text | NOT NULL, JSON-checked |
| `publish_date` | varchar(20) | NOT NULL |
| `target_section` | varchar(80) | NOT NULL |
| `is_published` | bool | NOT NULL |
| `analytics` | text | NOT NULL, JSON-checked *(added in `0005`; server-only pedagogical sidecar, never sent over the wire)* |

---

## Django framework tables

Created by `wave_api` migration `0001` (standard contrib tables):

`django_migrations`, `django_content_type`, `auth_user`, `auth_group`, `auth_permission`,
`auth_group_permissions`, `auth_user_groups`, `auth_user_user_permissions`.

> Note: there is **no `django_session`** and **no `django_admin_log`** table — the `sessions`
> and `admin` contrib apps are not enabled. Auth is token-based via `wave_api_apitoken`.

---

## Relationships

```
wave_api_student (lrn) ──1:N──> wave_api_quizattempt   (student_id, UNIQUE per topic_id)
wave_api_student (lrn) ──1:N──> wave_api_summativeresult (student_id, UNIQUE per lesson_id)

wave_api_catalogdocument      — standalone, keyed by subject (JSON catalog)
wave_api_remediationmaterial  — standalone, keyed by material_id
wave_api_apitoken             — standalone (role + principal_id)
```

---

## Raw DDL (as stored in `sqlite_master`)

```sql
-- Application tables
CREATE TABLE "wave_api_apitoken" ("key" varchar(64) NOT NULL PRIMARY KEY, "role" varchar(10) NOT NULL, "principal_id" varchar(40) NOT NULL);

CREATE TABLE "wave_api_catalogdocument" ("subject" varchar(20) NOT NULL PRIMARY KEY, "data" text NOT NULL CHECK ((JSON_VALID("data") OR "data" IS NULL)));

CREATE TABLE "wave_api_student" ("lrn" varchar(12) NOT NULL PRIMARY KEY, "name" varchar(120) NOT NULL, "grade_level" varchar(80) NOT NULL, "section" varchar(80) NOT NULL, "pin" varchar(6) NOT NULL);

CREATE TABLE "wave_api_teacher" ("teacher_id" varchar(40) NOT NULL PRIMARY KEY, "name" varchar(120) NOT NULL, "department" varchar(120) NOT NULL, "password" varchar(40) NOT NULL);

CREATE TABLE "wave_api_quizattempt" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "topic_id" varchar(40) NOT NULL, "lesson_id" varchar(40) NOT NULL, "score" integer NOT NULL, "answers" text NOT NULL CHECK ((JSON_VALID("answers") OR "answers" IS NULL)), "completed_at" varchar(20) NOT NULL, "student_id" varchar(12) NOT NULL REFERENCES "wave_api_student" ("lrn") DEFERRABLE INITIALLY DEFERRED, "perfect_score" integer NOT NULL);

CREATE TABLE "wave_api_summativeresult" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "lesson_id" varchar(40) NOT NULL, "score" integer NOT NULL, "total" integer NOT NULL, "percent" integer NOT NULL, "passed" bool NOT NULL, "feedback" text NOT NULL, "failed_items" text NOT NULL CHECK ((JSON_VALID("failed_items") OR "failed_items" IS NULL)), "student_id" varchar(12) NOT NULL REFERENCES "wave_api_student" ("lrn") DEFERRABLE INITIALLY DEFERRED, "attempts" integer NOT NULL);

CREATE TABLE "wave_api_remediationmaterial" ("material_id" varchar(40) NOT NULL PRIMARY KEY, "subject" varchar(20) NOT NULL, "original_topic_id" varchar(40) NOT NULL, "title" varchar(200) NOT NULL, "content" text NOT NULL, "teacher_notes" text NOT NULL, "created_quiz" text NOT NULL CHECK ((JSON_VALID("created_quiz") OR "created_quiz" IS NULL)), "publish_date" varchar(20) NOT NULL, "target_section" varchar(80) NOT NULL, "is_published" bool NOT NULL, "created_summative" text NOT NULL CHECK ((JSON_VALID("created_summative") OR "created_summative" IS NULL)), "analytics" text NOT NULL CHECK ((JSON_VALID("analytics") OR "analytics" IS NULL)));

-- Indexes
CREATE INDEX "wave_api_quizattempt_student_id_fa7f2eb4" ON "wave_api_quizattempt" ("student_id");
CREATE UNIQUE INDEX "wave_api_quizattempt_student_id_topic_id_10aaaea5_uniq" ON "wave_api_quizattempt" ("student_id", "topic_id");
CREATE INDEX "wave_api_summativeresult_student_id_55b15e64" ON "wave_api_summativeresult" ("student_id");
CREATE UNIQUE INDEX "wave_api_summativeresult_student_id_lesson_id_9c5b2ee5_uniq" ON "wave_api_summativeresult" ("student_id", "lesson_id");

-- Django framework tables (migration 0001)
CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);
CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);
CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);
CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);
CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE, "last_name" varchar(150) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL, "first_name" varchar(150) NOT NULL);
CREATE TABLE "auth_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE "auth_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
```

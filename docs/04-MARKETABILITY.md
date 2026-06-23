# Wave — Marketability & Business Model

> Wave turns a hard constraint — no internet in rural classrooms — into a defensible product:
> AI-powered remediation delivered over cheap, license-free LoRa radio.
>
> Source-of-truth references: [README — The Problem / The Solution](../README.md) ·
> [Features](01-FEATURES.md) · [What Makes Us Different](03-WHAT-MAKES-US-DIFFERENT.md).

---

## The Market & The Problem

Across rural municipalities in the Philippines — and throughout **ASEAN** — millions of students
study in classrooms with **no reliable internet, intermittent power, and teachers stretched thin
across large multi-grade classes**. Standard EdTech assumes a connection that does not exist.

When a student fails a quiz in a remote *barangay* school, there is no adaptive system to
intervene; the teacher may not know until end-of-term, and the student falls further behind.

**Wave addresses a large, underserved, and policy-relevant market** that incumbents structurally
cannot reach because their products require connectivity.

---

## Target Customers

| Segment | Why they buy |
|---|---|
| **DepEd & LGUs / barangay schools** (Philippines) | Mandate to serve last-mile learners; LRN-aligned; measurable remediation outcomes |
| **ASEAN education ministries** | Same connectivity gap region-wide; replicable per village |
| **NGOs & donor programs** | Turnkey, low-cost, offline learning for funded deployments |
| **Corporate CSR / foundations** | High-visibility, low-cost-per-student social impact |
| **Private rural school networks** | Affordable adaptive learning without recurring data costs |

---

## Business Model

Wave is positioned as a **hardware + software + services** offering with multiple revenue lines:

1. **Classroom hardware kit** — Heltec LoRa boards + Raspberry Pi 4B edge node, sold or leased per
   site (one town node + village node serves a classroom).
2. **Per-classroom / per-section software license** — annual license for the Wave platform and
   curriculum content.
3. **B2G procurement & grants** — bulk deployment contracts with DepEd, LGUs, and ministries.
4. **NGO / donor-funded deployments** — packaged kits + setup for grant-funded rollouts.
5. **Content subscription** — periodic curriculum and AI-prompt updates synced to the
   (occasionally connected) server node.
6. **Services** — teacher training, installation, and maintenance/support contracts.

---

## Cost Advantage

| Lever | Detail |
|---|---|
| **Commodity hardware** | Heltec WiFi LoRa 32 V3 (low unit cost) + Raspberry Pi 4B; student phones are bring-your-own |
| **License-free spectrum** | LoRa runs in the 863–928 MHz SRD band — **no airtime/data fees** |
| **No per-student data plan** | Students never need internet; zero recurring connectivity cost |
| **Free / open-source stack** | Django, Mosquitto, RadioLib, Arduino, React — no licensing fees |
| **Frugal compute** | Runs on 2–4 GB RAM phones, browser-only; no app-store distribution |

The result is a **low total cost of ownership** that fits public-school and donor budgets — the
decisive factor in this market.

---

## Scalability

- **One LoRa town ↔ village link serves a classroom**; add a node pair per village to scale out.
- The **tokenized wire protocol** is engineered for constrained links, so coverage grows without
  bandwidth becoming the bottleneck.
- The sync layer is **swappable** (MQTT today, production LoRa gateways next), protecting the
  investment as deployments grow.
- AI generation is centralized at occasionally-connected town nodes, so **one internet uplink
  amortizes across many offline classrooms**.

---

## Go-To-Market & Roadmap

**Path:** working demo → **pilot district** (measure remediation outcomes) → **DepEd / LGU
partnership** → regional ASEAN expansion via NGO and government channels.

**Roadmap items** (architecturally planned, see [Features](01-FEATURES.md)):

- Production-grade LoRa hardware and dedicated LoRa gateways (satellite/cellular backhaul)
- Full Gemini AI integration across more subjects and grade levels
- Security hardening (e.g., PIN hashing) for at-scale deployment

---

## Why Now

Cheap LoRa radios, capable low-cost edge compute (Raspberry Pi 4B), and fast, affordable LLMs
(Gemini Flash) have only recently converged. Wave is the product that combines all three to make
**AI-assisted education economically viable where the internet never reaches.**

# Wave — Hardware Integration

> The physical layer that lets AI-generated content reach an internet-free classroom: two
> **Heltec WiFi LoRa 32 V3** radios bridging a town server to a **Raspberry Pi 4B** village node.
>
> Source-of-truth references (full wiring & firmware): [HARDWARE.md](../HARDWARE.md) ·
> [FIRMWARE.md](../FIRMWARE.md).

> **Note on the Pi model:** This document targets the **Raspberry Pi 4B** as the village host
> (more RAM/CPU for the broker, Django edge node, and content cache). The existing wiring docs
> ([HARDWARE.md](../HARDWARE.md)) were written for a Pi 3B; the two are **electrically and
> firmware compatible** — same USB/UART serial wiring, same 3.3 V GPIO, same provisioning.

---

## Hardware Inventory

| # | Device | Role |
|---|---|---|
| 1 | **Laptop** | Town side — runs Django + Mosquitto + Gemini; drives Heltec A over USB |
| 2 | **Heltec WiFi LoRa 32 V3** (863–928 MHz, SX1262) — *Heltec A* | Town/server-side LoRa radio |
| 3 | **Heltec WiFi LoRa 32 V3** (863–928 MHz, SX1262) — *Heltec B* | Village-side LoRa radio |
| 4 | **Raspberry Pi 4B** | Village side — hostapd Wi-Fi AP + Mosquitto + Django edge node + content store |
| 5 | **Student phone** | Client — connects to the Pi's Wi-Fi AP, uses the UI in a browser |

---

## Data Flow

```
Laptop ──USB-C──► Heltec A ~~~~LoRa (863–928 MHz)~~~~ Heltec B ──USB──► Raspberry Pi 4B
 (Django,                                                              (hostapd AP +
  Mosquitto,                                                            relay + cache)
  Gemini)                                                                   │ Wi-Fi
                                                                       Student phone
                                                                       (browser UI)
```

- **Town side (laptop + Heltec A):** the only node that touches the internet, and only briefly,
  during Gemini AI generation. It encodes the pack, chunks it into ~200-byte frames, and transmits
  over LoRa.
- **Village side (Heltec B + Raspberry Pi 4B):** receives LoRa frames, reassembles them, and serves
  the UI to student phones over its own Wi-Fi access point — **no internet required**.
- **Student phone:** joins the Pi's Wi-Fi (`Wave-Classroom`) and opens the app at `http://10.0.0.1`.

---

## Heltec WiFi LoRa 32 V3 (the LoRa radios)

| Property | Detail |
|---|---|
| Radio chip | Semtech **SX1262** (hardwired to the ESP32-S3 on the PCB) |
| Band | 863–928 MHz SRD (confirm against local NTC allocation; default `915.0 MHz`) |
| USB / serial | Onboard **CP2102** — `/dev/ttyUSB0` or `COMx`, **115200 baud**, CRLF |
| Antenna | IPEX/U.FL stub antenna — **attach before powering on** (TX without antenna destroys the PA) |
| Role assignment | None board-specific — assigned at runtime via `AT+ADDRESS=` (town = 1, village = 2) |

### LoRa radio parameters

`AT+PARAMETER=SF,BW,CR,PP` → **SF10, BW 125 kHz, CR 4/5, preamble 7**. Both boards must share the
same NetworkID and Parameter or they will not hear each other.

| Board | Address | Network ID | Parameter |
|---|---|---|---|
| Heltec A (town, on laptop) | `AT+ADDRESS=1` | `AT+NETWORKID=18` | `AT+PARAMETER=10,7,1,7` |
| Heltec B (village, on Pi 4B) | `AT+ADDRESS=2` | `AT+NETWORKID=18` | `AT+PARAMETER=10,7,1,7` |

**Payload ceiling:** 240 bytes per frame (`+ERR=10` if exceeded). The host keeps chunks under this
with `LORA_SAFE_FRAME=180`, leaving room for the JSON wrapper.

---

## Firmware — One Image, Both Boards

The key design point: **the Heltec firmware impersonates a REYAX RYLR998 AT-command modem.**

- Flash the same image — `firmware/heltec_wave_at/heltec_wave_at.ino` — to **both** boards.
- The SX1262 then "speaks RYLR998 AT" over USB serial, so the host Python stack
  (`server/wave_api/lora/rylr998.py`, `transport.py`, `pi/router/relay.py`) runs **unchanged** —
  to the laptop and the Pi, a Heltec board is indistinguishable from a real RYLR998.
- **Wi-Fi lives on the Pi, not the Heltec** (`hostapd`/`dnsmasq`), so the firmware is
  single-threaded and simple.

### Free toolchain

| Tool | Purpose |
|---|---|
| Arduino IDE 2.x **or** PlatformIO + VS Code | Build & flash the firmware |
| Heltec ESP32 / arduino-esp32 board support | ESP32-S3 toolchain + `Heltec WiFi LoRa 32(V3)` board |
| **RadioLib** (MIT) | SX1262 radio driver |
| Silicon Labs **CP210x VCP driver** (Windows) | USB-serial for the onboard CP2102 |
| Python 3.12 + `pyserial` | Host LoRa driver + hardware bench tests |

---

## Raspberry Pi 4B — Village Host

Runs the broker, edge-node service, content store, and the student Wi-Fi access point. Connects to
Heltec B over serial.

### Option A — USB (recommended)

| Pi 4B | Connects To | Notes |
|---|---|---|
| Any USB-A port | Heltec B USB-C | Serial at `/dev/ttyUSB0` or `/dev/ttyACM0`, 115200 baud |
| USB-C PWR | Rated 5V supply | Use a proper supply — weak chargers cause undervoltage throttling |

### Option B — UART direct to GPIO (production-style)

Frees USB ports and reduces latency. First disable the serial console
(`raspi-config → Interface Options → Serial → disable console, enable hardware serial`).
**3.3 V is native on both sides — no level shifter needed.**

| Heltec B Pin | Pi GPIO Header Pin | Signal |
|---|---|---|
| GND | Pin 6 | Ground |
| 3.3V | Pin 1 | Power (3.3 V) |
| TX (GPIO43) | Pin 10 (GPIO15 / RXD) | Heltec transmit → Pi receive |
| RX (GPIO44) | Pin 8 (GPIO14 / TXD) | Pi transmit → Heltec receive |
| RST (optional) | Any spare GPIO | Optional reset control from Pi |

### Student-phone access

| Connection | Detail |
|---|---|
| Wi-Fi network | `Wave-Classroom` (Pi `hostapd`, WPA2) |
| Browser URL | `http://10.0.0.1` (Pi HTTP front-end) |
| Internet | None — intentional; `dnsmasq` answers captive-portal probes locally so the phone stays connected |

---

## Pre-Power Safety Checklist

- [ ] Stub antenna attached to **both** Heltec boards before powering on (TX without antenna damages the SX1262 PA)
- [ ] Both boards powered via USB before running any LoRa transmit firmware
- [ ] Pi serial console disabled if using the UART/GPIO option
- [ ] Configured LoRa channel confirmed within the locally permitted SRD band before any outdoor transmit
- [ ] Pi powered by a properly rated supply — not a weak phone charger
- [ ] Both Heltec boards flashed with `firmware/heltec_wave_at/` and provisioned (`AT+ADDRESS` 1/2, shared NetworkID + Parameter)
- [ ] Add a **20 dB SMA attenuator** if the two boards sit < 1 m apart, to avoid receiver desensitization

---

## How This Enables the Product

This hardware chain is what makes Wave's headline claim real: a teacher at the town node generates
an AI remedial pack with Gemini, Wave chunks it into ~200-byte LoRa frames, and it arrives — fully
reassembled — on a student's phone in a village classroom **with no internet on the student side**.
See [AI Implementation](02-AI_IMPLEMENTATION.md) and [Features](01-FEATURES.md) for the software
pipeline that rides on top of this link.

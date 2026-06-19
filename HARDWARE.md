# Wave Project — Hardware & Pin Connections

**Scope:** Demo build — 1 user, internet-free LoRa link proof-of-concept  
**Date:** June 2026

---

## Hardware Inventory

| # | Device | Role | Qty |
|---|---|---|---|
| 1 | Laptop | Town side — runs Django + Mosquitto + Gemini; drives Heltec A over USB | 1 |
| 2 | Heltec WiFi LoRa 32 V3 (863–928 MHz, SX1262) | **Heltec A** — Town/server-side LoRa radio | 1 |
| 3 | Heltec WiFi LoRa 32 V3 (863–928 MHz, SX1262) | **Heltec B** — Village-side LoRa radio + SoftAP for phone | 1 |
| 4 | Raspberry Pi 3B | Village side — runs Mosquitto broker + Django edge node + content store | 1 |
| 5 | Student phone | Client device — connects to Heltec B SoftAP, accesses UI via browser | 1 |

---

## Data Flow

```
Laptop ──USB-C──► Heltec A ~~~~LoRa (863–928 MHz)~~~~ Heltec B ──USB──► Raspberry Pi
                                                                            │
                                                                     hostapd Wi-Fi AP
                                                                            │
                                                                       Student Phone
                                                                       (browser UI)
```

---

## Device 1 — Laptop (Town Side Host)

No pin connections. Communicates with Heltec A via USB-C cable.

| Connection | Detail |
|---|---|
| To Heltec A | USB-C cable → any laptop USB port |
| Serial port (Linux/Mac) | `/dev/ttyUSB0` or `/dev/ttyACM0` |
| Serial port (Windows) | `COM3` / `COM4` (check Device Manager) |
| Baud rate | 115200 |

---

## Device 2 — Heltec A (Town Side LoRa Radio)

Plugs into the laptop. No breadboard or jumpers needed.

| Heltec A | Connects To | Notes |
|---|---|---|
| USB-C port | Laptop USB port | Power + serial (CP2102 onboard — no adapter needed) |
| IPEX / U.FL ANT | 863–928 MHz stub antenna (bundled) | Attach before powering — never TX without antenna |
| SX1262 (internal) | — | Hardwired to ESP32-S3 on PCB; no external wiring |
| Wi-Fi (internal) | — | Not used on town side |

---

## Device 3 — Heltec B (Village Side LoRa Radio)

> **Build note (current):** In this build the **Raspberry Pi hosts the student Wi-Fi AP**
> (`hostapd`/`dnsmasq`, SSID `Wave-Classroom`), so Heltec B is **LoRa-only** — it does **not**
> run a SoftAP or WebSocket server. It runs the same single-image AT-emulation firmware as
> Heltec A ([firmware/heltec_wave_at/](firmware/heltec_wave_at/)); see [FIRMWARE.md](FIRMWARE.md).
> The SoftAP / dual-core rows below are retained only as a record of the earlier
> Heltec-hosts-Wi-Fi design and are **not** used here.

One job: receives LoRa from Heltec A and bridges it to the Raspberry Pi over USB serial.

| Heltec B | Connects To | Notes |
|---|---|---|
| USB-C port | Raspberry Pi — any USB-A port | Power + serial to Pi (`/dev/ttyUSB0` or `/dev/ttyACM0`), 115200 baud |
| IPEX / U.FL ANT | 863–928 MHz stub antenna (bundled) | Attach before powering |
| SX1262 (internal) | — | Hardwired to ESP32-S3 on PCB; driven by RadioLib in firmware |

### (Superseded) Heltec B SoftAP design — Arduino dual-core

> Not used in the current build (Pi hosts Wi-Fi). Kept for reference only.

| Core | Task | Notes |
|---|---|---|
| Core 0 | Wi-Fi / SoftAP stack + WebSocket server | Would serve phone browser at `192.168.4.1` |
| Core 1 | LoRa RX/TX (SX1262 interrupt handler) | Receives from Heltec A; pushes to Core 0 queue |

> Rationale (if revisiting the SoftAP design): the ESP32-S3 has one Wi-Fi radio, so pinning
> Wi-Fi to Core 0 and LoRa to Core 1 via `xTaskCreatePinnedToCore()` avoids dropped packets.
> The current AT-emulation firmware is single-threaded and correct because Wi-Fi is offloaded
> to the Pi.

---

## Device 4 — Raspberry Pi 3B (Village Side Host)

Runs the broker, edge node service, and content store. Connects to Heltec B via USB.  
**Recommended connection to Heltec B: USB** (plug-and-play, no level shifter, reprogram over same cable).

### Option A — USB Connection (Recommended for Demo)

| Pi 3B | Connects To | Notes |
|---|---|---|
| USB-A port (any of 4) | Heltec B USB-C | Serial at `/dev/ttyUSB0` or `/dev/ttyACM0`, 115200 baud |
| Ethernet port | Tenda F3 LAN port *(production)* | Not needed for 1-user demo; use for classroom scale |
| USB PWR (micro-USB) | 5V 2.5A supply | Use a proper supply — weak chargers cause undervoltage throttling |

### Option B — UART Direct to GPIO (Production-Style, No USB Adapter)

Use this in production to free up USB ports and reduce latency.  
Disable Pi serial console first: `raspi-config → Interface Options → Serial → disable console, enable hardware serial`.

| Heltec B Pin | Pi 3B GPIO Header Pin | Signal |
|---|---|---|
| GND | Pin 6 | Ground |
| 3.3V | Pin 1 | Power (3.3V — no level shifter needed, both devices are 3.3V) |
| TX (GPIO43) | Pin 10 (GPIO15 / RXD) | Heltec transmit → Pi receive |
| RX (GPIO44) | Pin 8 (GPIO14 / TXD) | Pi transmit → Heltec receive |
| RST (optional) | Any spare GPIO | Optional reset control from Pi |

> **3.3V native on both sides** — no level shifting required. Pi 3B GPIO is 3.3V;  
> Heltec V3 is 3.3V. Direct connection is safe.

### Pi 3B GPIO Header Reference (Relevant Pins)

```
         3.3V  [1] [2]  5V
    (free GPIO) [3] [4]  5V
    (free GPIO) [5] [6]  GND  ◄── Heltec GND
          GPIO4 [7] [8]  GPIO14 (TXD)  ◄── Heltec RX (GPIO44)
            GND [9] [10] GPIO15 (RXD)  ◄── Heltec TX (GPIO43)
         GPIO17 [11][12] GPIO18
         ...
         3.3V  [17][18] GPIO24
```

---

## Device 5 — Student Phone (Client Device)

No hardware connection. Connects over Wi-Fi only — to the **Raspberry Pi's** AP (`hostapd`),
not the Heltec board.

| Connection | Detail |
|---|---|
| Wi-Fi network | `Wave-Classroom` (Raspberry Pi `hostapd`, WPA2 — see [pi/router/config/hostapd.conf](pi/router/config/hostapd.conf)) |
| Browser URL | `http://10.0.0.1` (Pi HTTP front-end) |
| Internet | None — intentional. `dnsmasq` answers captive-portal probes locally so the phone doesn't auto-disconnect. |

---

## Full Pin/Connection Summary Table

| From | From Port/Pin | To | To Port/Pin | Type | Notes |
|---|---|---|---|---|---|
| Laptop | USB-A port | Heltec A | USB-C | USB serial | `/dev/ttyUSB0`, 115200 baud |
| Heltec A | IPEX ANT | Stub antenna | SMA/IPEX | RF | Attach before power-on |
| Heltec A | SX1262 (internal) | Heltec B SX1262 (internal) | — | LoRa RF (863–928 MHz) | Over the air — no wire |
| Heltec B | IPEX ANT | Stub antenna | SMA/IPEX | RF | Attach before power-on |
| Heltec B | USB-C | Raspberry Pi | USB-A | USB serial | `/dev/ttyUSB0`, 115200 baud |
| Raspberry Pi | Wi-Fi (`wlan0`) | Student phone | Wi-Fi | 802.11g | `hostapd` SSID `Wave-Classroom`, `10.0.0.1`, no internet |
| Raspberry Pi | micro-USB PWR | 5V 2.5A supply | USB-A | Power | Proper supply required |

---

## Safety & Pre-Power Checklist

- [ ] Stub antenna attached to **both** Heltec boards before powering on — TX without antenna damages the SX1262 PA
- [ ] Both boards powered via USB before running any LoRa transmit firmware
- [ ] Pi serial console disabled if using UART GPIO option (`raspi-config`)
- [ ] Confirm configured LoRa channel is within NTC-permitted SRD band before any outdoor transmit
- [ ] Pi powered by a rated 5V 2.5A supply — do not use a phone charger
- [ ] Both Heltec boards flashed with [firmware/heltec_wave_at/](firmware/heltec_wave_at/); provisioned by the host (`AT+ADDRESS` 1/2, shared NetworkID + Parameter) — see [FIRMWARE.md](FIRMWARE.md)

---

## Software Stack Reference

| Device | OS / Runtime | Key Services |
|---|---|---|
| Laptop | Any (Windows/Mac/Linux) | Django, Mosquitto, Gemini 2.0-flash, serial driver |
| Heltec A | Arduino + RadioLib ([firmware/heltec_wave_at/](firmware/heltec_wave_at/)) | RYLR998 AT emulation → LoRa TX/RX |
| Heltec B | Arduino + RadioLib ([firmware/heltec_wave_at/](firmware/heltec_wave_at/)) | Same image as Heltec A — LoRa-only AT bridge |
| Raspberry Pi | Raspberry Pi OS (Linux) | `hostapd`/`dnsmasq` AP, Mosquitto broker, Django edge node + relay, content store |
| Student phone | Android / iOS | Browser only — no app install required |
# Wave — Heltec V3 Firmware & Hardware Integration Guide

Companion to [HARDWARE.md](HARDWARE.md) (which records *how the boards are wired*). This guide
covers the **firmware**, **hardware configuration**, **free tooling**, and **how to test** the
LoRa link end-to-end.

---

## 1. Architecture

```
Laptop ──USB-C──► Heltec A ~~~~LoRa (915 MHz)~~~~ Heltec B ──USB──► Raspberry Pi
 (Django,                                                            (hostapd AP +
  rylr998.py)                                                         relay.py + cache)
                                                                          │ Wi-Fi
                                                                     Student phone
                                                                     (browser UI)
```

**Key design point — the firmware impersonates an RYLR998.**
The Wave host stack ([server/wave_api/lora/rylr998.py](server/wave_api/lora/rylr998.py),
[transport.py](server/wave_api/lora/transport.py), [pi/router/relay.py](pi/router/relay.py))
was written for a REYAX **RYLR998** AT-command modem. This firmware makes the Heltec V3's
SX1262 **speak the same AT dialect over USB serial**, so to the laptop and the Pi a Heltec board
is indistinguishable from an RYLR998. **No Python changes are needed** — the existing driver,
transport, relay, and `tests/hw/` suite all run unchanged.

**Wi-Fi lives on the Pi, not the Heltec.** The Raspberry Pi runs `hostapd`/`dnsmasq`
([pi/router/config/hostapd.conf](pi/router/config/hostapd.conf), SSID `Wave-Classroom`) and
serves HTTP to phones. The Heltec boards are **LoRa-only**, so the firmware is single-threaded —
the SoftAP / WebSocket / dual-core notes in older revisions of HARDWARE.md do **not** apply to
this build.

**One image, both boards.** Flash [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino)
to *both* boards. There is nothing board-specific in the firmware — the host assigns each board
its role at runtime with `AT+ADDRESS=` (town = 1, village = 2).

---

## 2. Free software & libraries

Everything below is free and open-source.

| Tool | License | Purpose |
|---|---|---|
| [Arduino IDE 2.x](https://www.arduino.cc/en/software) **or** [PlatformIO](https://platformio.org/) + VS Code | Free | Build & flash the firmware |
| Heltec ESP32 / arduino-esp32 board support | Free (LGPL) | ESP32-S3 toolchain + `Heltec WiFi LoRa 32(V3)` board definition |
| [RadioLib](https://github.com/jgromes/RadioLib) (Jan Gromeš) | Free (MIT) | SX1262 radio driver — install via Library Manager |
| Silicon Labs [CP210x VCP driver](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) (Windows) | Free | USB-serial for the Heltec onboard CP2102 (often auto-installed on Win 11) |
| Python 3.12 + `pyserial` | Free (BSD) | Host LoRa driver + hardware bench tests (`import serial`) |
| Django / DRF / pytest / paho-mqtt | Free | Server + test runner (already in `server/requirements.txt`) |
| PuTTY · Arduino Serial Monitor · `python -m serial.tools.miniterm` | Free | Manual AT smoke testing |

> **Arduino IDE Board Manager URL** (Tools → Preferences → *Additional boards manager URLs*):
> `https://resource.heltec.cn/download/package_heltec_esp32_index.json`
> Then install **"Heltec ESP32 Series Dev-boards"** and select **Heltec WiFi LoRa 32(V3)**.

---

## 3. Build & flash

### Option A — Arduino IDE
1. Install board support and select **Tools → Board → Heltec WiFi LoRa 32(V3)**.
2. **Library Manager** → install **RadioLib**.
3. Open [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino).
4. **Tools → Port** → pick the board's COM port, then **Upload**.
5. **Repeat for the second board** — both run the same image.

### Option B — PlatformIO
```bash
cd firmware/heltec_wave_at
pio run -t upload --upload-port COM3   # Heltec A
pio run -t upload --upload-port COM4   # Heltec B
```
Config: [firmware/heltec_wave_at/platformio.ini](firmware/heltec_wave_at/platformio.ini).

### Regional radio settings
Edit the `#define`s at the top of the sketch for your jurisdiction before flashing:
- `WAVE_FREQ_MHZ` (default `915.0`) — must be inside your permitted SRD band (863–928 MHz; for
  PH confirm against NTC allocation).
- `WAVE_TX_DBM` (default `14`) — keep modest on the bench; raise only with antennas attached.

---

## 4. Hardware configuration

> ⚠️ **Attach the stub antenna to BOTH boards before powering on.** Transmitting without an
> antenna can destroy the SX1262 power amplifier.

Wiring is in [HARDWARE.md](HARDWARE.md). Once both boards are flashed and powered over USB, the
host provisions them via AT commands — these values match the test fixtures in
[server/tests/hw/conftest.py](server/tests/hw/conftest.py):

| Board | Address | Network ID | Parameter |
|---|---|---|---|
| Heltec A (town, on laptop) | `AT+ADDRESS=1` | `AT+NETWORKID=18` | `AT+PARAMETER=10,7,1,7` |
| Heltec B (village, on Pi)  | `AT+ADDRESS=2` | `AT+NETWORKID=18` | `AT+PARAMETER=10,7,1,7` |

`AT+PARAMETER=SF,BW,CR,PP` → SF10, BW 125 kHz (`7`), CR 4/5 (`1`), preamble 7. Both boards
**must** share the same NetworkID and Parameter or they will not hear each other. The Python
`Rylr998Driver.configure()` issues these three commands automatically — you normally never type
them by hand outside the smoke test below.

### AT command reference (the emulated subset)

| Host sends | Firmware replies |
|---|---|
| `AT` | `+OK` |
| `AT+VER?` | `+VER=WAVE-HELTEC-1.0` |
| `AT+ADDRESS=<n>` / `AT+ADDRESS?` | `+OK` / `+ADDRESS=<n>` |
| `AT+NETWORKID=<n>` | `+OK` |
| `AT+PARAMETER=SF,BW,CR,PP` | `+OK` |
| `AT+SEND=<addr>,<len>,<data>` | `+OK` (or `+ERR=<code>`) |
| _(async, on receive)_ | `+RCV=<srcAddr>,<len>,<data>,<rssi>,<snr>` |

Serial: **115200 baud, CRLF line endings**. Payload ceiling **240 bytes** (`+ERR=10` if
exceeded — the host's `LORA_SAFE_FRAME=180` keeps the JSON-wrapped chunk under that).

---

## 5. Integration with the host

1. Plug the board in. Confirm the OS enumerates the CP2102:
   - **Windows:** Device Manager → Ports → `Silicon Labs CP210x (COM3)`.
   - **Linux/macOS:** `/dev/ttyUSB0` or `/dev/ttyACM0`.
2. That's it — the host code is unchanged. `Rylr998Driver(serial.Serial(port, 115200))` talks to
   the Heltec exactly as it would to a real RYLR998.
3. On the Pi, [pi/router/relay.py](pi/router/relay.py) opens the same port (`/dev/ttyUSB0` or
   the GPIO UART `/dev/ttyAMA0`) and needs no changes.

---

## 6. Testing

### Step 1 — Manual AT smoke test (no Python)
Open the board's port at 115200 in any serial monitor and type:
```
AT+VER?            ->  +VER=WAVE-HELTEC-1.0
AT+ADDRESS=1       ->  +OK
AT+ADDRESS?        ->  +ADDRESS=1
```

### Step 2 — Two-board link by hand
With Heltec A as addr 1 and Heltec B as addr 2 (same NetworkID), on **A's** monitor:
```
AT+SEND=2,5,hello  ->  +OK
```
**B's** monitor should print:
```
+RCV=1,5,hello,-42,9          (rssi/snr will vary)
```
This proves on-air framing, network/destination filtering, and RSSI/SNR reporting.

### Step 3 — Tier-1 host loopback (no hardware)
Proves the firmware change didn't alter host semantics — uses the `FakeSerial` shim:
```powershell
cd server
.venv\Scripts\python -m pytest tests/test_lora_loopback.py
```

### Step 4 — Tier-2 hardware bench (the definition of done)
Run the **existing, unchanged** hardware suite against the two Heltec boards:
```powershell
$env:WAVE_HW_BENCH=1
$env:WAVE_HW_SERVER_PORT="COM3"   # Heltec A
$env:WAVE_HW_ROUTER_PORT="COM4"   # Heltec B
cd server
.venv\Scripts\python -m pytest tests/hw/test_lora_link.py -v
```
Passing **H1, H2, H3, H4, H8, H9, H13, H14** against real Heltec hardware confirms the AT
emulation is faithful. H6/H7 stay skipped (they defer to the loopback test — real RF can't drop
frames on demand). Add a **20 dB SMA attenuator** on one side if the boards sit <1 m apart, to
avoid receiver desensitization.

### Step 5 — Classroom path
The full classroom dress rehearsal (Mode F in [HOW_TO_RUN_AND_TEST.md](HOW_TO_RUN_AND_TEST.md))
applies verbatim — the Pi relay, cache, and hostapd AP are untouched by this firmware.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| No serial port appears | Install the CP210x VCP driver; try a data-capable USB-C cable. |
| `AT+VER?` silent | Wrong baud (must be 115200) or board not flashed. Re-upload. |
| `+ERR=99` repeating on boot | Radio failed to init — check the board is genuinely a V3 (SX1262) and antenna seated. |
| Boards don't hear each other | NetworkID or Parameter mismatch, or different `WAVE_FREQ_MHZ`. Re-provision both. |
| `+ERR=10` on send | Payload > 240 bytes. Host keeps chunks at `LORA_SAFE_FRAME=180`; lower it if your fields run long. |
| Frames dropped at close range | Add a 20 dB attenuator or move the boards apart. |

---

## 8. File map

| Path | Purpose |
|---|---|
| [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino) | The firmware (RYLR998 AT emulation on SX1262) |
| [firmware/heltec_wave_at/platformio.ini](firmware/heltec_wave_at/platformio.ini) | PlatformIO build config |
| [server/wave_api/lora/rylr998.py](server/wave_api/lora/rylr998.py) | Host AT driver — the contract this firmware satisfies |
| [server/tests/hw/test_lora_link.py](server/tests/hw/test_lora_link.py) | Hardware bench tests (gated on `WAVE_HW_BENCH=1`) |
| [HARDWARE.md](HARDWARE.md) | Physical wiring & pin connections |

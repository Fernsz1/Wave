# Raspberry Pi 3B — Wave Village Node Setup

This guide stands up the **village side** of the Wave LoRa link on a Raspberry Pi 3B:
the Pi hosts the student Wi-Fi (`Wave-Classroom`), drives **Heltec B** over USB, reassembles
the LoRa frames sent by the laptop's **Heltec A**, and serves the reconstructed lessons to
student phones over HTTP. No internet is required at the classroom.

```
Laptop ──USB──► Heltec A ~~~LoRa 915 MHz~~~ Heltec B ──USB──► Raspberry Pi 3B
 (Django + egress.py)                                          (relay.py + serve.py + hostapd)
                                                                      │ Wi-Fi  SSID: Wave-Classroom
                                                                 Student phone (browser → http://10.0.0.1)
```

The Pi runs two things from this repo: the **relay** ([pi/router/relay.py](pi/router/relay.py))
and the **HTTP serve layer** ([pi/router/serve.py](pi/router/serve.py)) — started together with
`python -m pi.router.serve`. The only Python dependency is `pyserial`; everything else is stdlib.

---

## Prerequisites

Have all of these ready **before** you start — the steps below assume them.

### A second computer (to flash the SD card and SSH in)
- A laptop/desktop (Windows, macOS, or Linux) with an **SD card reader** (or a USB adapter).
- [**Raspberry Pi Imager**](https://www.raspberrypi.com/software/) installed on it — used in §1 to
  write the OS and pre-seed Wi-Fi/SSH so the Pi can run **headless** (no monitor/keyboard).
- An **SSH client**: built into macOS/Linux terminals and Windows 10/11 (`ssh` in PowerShell);
  or [PuTTY](https://www.putty.org/) on older Windows.

### Internet — for setup only, not for the classroom
- The Pi needs internet **once**, during setup, to `apt install` packages and `git clone` the repo
  (§2–§3). Plan to do setup somewhere with a network (Ethernet cable to a router is easiest, since
  `wlan0` gets repurposed as the access point in §5). After setup the Pi runs fully offline.
- The flashing computer needs internet to download the OS image and the Imager.

### The town/server side already working
- The laptop side must be set up per [FIRMWARE.md](FIRMWARE.md): **Heltec A** flashed and attached,
  Django running, and `LORA_ENABLED=true` + `LORA_PORT` set in `server/.env`. Note the laptop's
  `LORA_NETWORK_ID` and `LORA_PARAMETER` — **Heltec B must match them exactly** (defaults: NetworkID
  `18`, `AT+PARAMETER=10,7,1,7`). Mismatched values are the #1 reason the boards don't hear each other.
- **Both** Heltec boards must be flashed with the same image from
  [firmware/heltec_wave_at/](firmware/heltec_wave_at/) — see [FIRMWARE.md](FIRMWARE.md) §3.

### Access to the Wave repository
- A GitHub account / `git` available, or another way to copy this repo onto the Pi (§3).

### Basic skills assumed
- Comfortable running terminal commands over SSH and editing files with `nano`/`vi`.
- The commands below use `sudo`; the user you create in §1 must have sudo rights (the default
  Imager-created user does).

### Safety — do this every time
- ⚠️ **Attach the 915 MHz stub antenna to Heltec B before applying power.** Transmitting without an
  antenna can permanently damage the SX1262 power amplifier.
- Power the Pi from a proper **5V 2.5A** supply, not a phone charger — under-voltage causes random
  crashes and SD-card corruption.

---

## 0. Bill of materials

- Raspberry Pi 3B + microSD (8 GB+) + a **5V 2.5A** supply (a weak charger causes brown-outs).
- Heltec WiFi LoRa 32 V3 (this is **Heltec B**) + its 915 MHz stub antenna **(attach before power!)**.
- USB-A ↔ USB-C data cable (Pi USB-A → Heltec B USB-C).
- The laptop/town side already set up per [FIRMWARE.md](FIRMWARE.md) (Heltec A + `LORA_ENABLED=true`).

---

## 1. Flash Raspberry Pi OS

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager.
2. In the Imager's advanced options (gear icon), set hostname `wave-pi`, enable SSH, and set a user
   — so you can run the Pi headless.
3. Boot, SSH in, and update:
   ```bash
   sudo apt update && sudo apt full-upgrade -y
   ```

---

## 2. Install dependencies

```bash
sudo apt install -y python3 python3-pip python3-serial hostapd dnsmasq git
# (python3-serial provides pyserial; if you prefer pip: pip3 install pyserial)
sudo systemctl unmask hostapd
```

---

## 3. Copy the Wave code onto the Pi

The relay imports `wave_api.lora.*` and `wave_api.codec`, and the codec reads the shared
`protocol/wire_manifest.json`. Copy the repo (or just the needed parts) so the import paths resolve
with the **repo root** on `PYTHONPATH`:

```bash
sudo mkdir -p /opt/wave
sudo chown $USER /opt/wave
# From your laptop, or git clone on the Pi:
git clone https://github.com/SherieHub/Wave.git /opt/wave   # or rsync the folder
```

Minimum tree that must be present under `/opt/wave`:
```
/opt/wave/
├── protocol/wire_manifest.json        # the codec reads this
├── server/wave_api/__init__.py
├── server/wave_api/codec.py
├── server/wave_api/lora/{__init__,rylr998,transport,chunk}.py
└── pi/router/{__init__,relay,cache,serve}.py
```

> `wave_api.codec` is dependency-free (json + pathlib) and does **not** import Django, so it runs
> fine on the Pi. `PYTHONPATH` must include both the repo root (for `pi.*`) and `server/`
> (for `wave_api.*`) — the systemd unit below sets this.

Create the cache directory:
```bash
sudo mkdir -p /var/lib/wave && sudo chown $USER /var/lib/wave
```

---

## 4. Identify Heltec B's serial port

Plug Heltec B into the Pi (antenna attached!) and find its port:
```bash
ls -l /dev/serial/by-id/        # stable name, survives reboots/replug
dmesg | grep -i -E 'cp210|ttyUSB|ttyACM' | tail
```
It is usually `/dev/ttyUSB0` (CP2102 onboard). Use the `by-id` path if you have other USB serial
devices. (If you wire the Heltec to the GPIO UART instead of USB, it's `/dev/ttyAMA0` — disable the
serial console first with `sudo raspi-config` → Interface Options → Serial → *login shell: No,
hardware serial: Yes*.)

Smoke-test the board speaks AT (115200 baud):
```bash
python3 -m serial.tools.miniterm /dev/ttyUSB0 115200
# type:  AT+VER?   →  +VER=WAVE-HELTEC-1.0     (Ctrl-] to quit)
```

> Heltec B is provisioned automatically by `serve.py` at startup (`AT+ADDRESS=2`, NetworkID 18,
> `AT+PARAMETER=10,7,1,7`). These **must** match Heltec A on the laptop
> (`LORA_VILLAGE_ADDR`/`LORA_NETWORK_ID`/`LORA_PARAMETER` in `server/.env`).

---

## 5. Wi-Fi access point — hostapd + dnsmasq

Use the configs shipped in [pi/router/config/](pi/router/config/) (SSID `Wave-Classroom`, the Pi at
`10.0.0.1`, DHCP `10.0.0.50–150`, captive-portal-friendly DNS):

```bash
# Static IP for wlan0
sudo tee /etc/systemd/network/10-wave-wlan0.network >/dev/null <<'EOF'
[Match]
Name=wlan0
[Network]
Address=10.0.0.1/24
EOF
sudo nano /etc/dhcpcd.conf   # add:  interface wlan0 \n   static ip_address=10.0.0.1/24 \n   nohook wpa_supplicant

# Point hostapd & dnsmasq at the repo configs
sudo cp /opt/wave/pi/router/config/hostapd.conf /etc/hostapd/hostapd.conf
sudo sed -i 's#^#DAEMON_CONF="/etc/hostapd/hostapd.conf"\n#' /etc/default/hostapd 2>/dev/null || true
sudo cp /opt/wave/pi/router/config/dnsmasq.conf /etc/dnsmasq.d/wave.conf

# IMPORTANT: change the Wi-Fi password from the default before a real classroom
sudo nano /etc/hostapd/hostapd.conf      # set wpa_passphrase=...

sudo systemctl enable --now hostapd dnsmasq
```

Verify a phone can see and join **Wave-Classroom** and gets a `10.0.0.x` address. The captive-portal
entries in `dnsmasq.conf` keep Android/iOS from auto-dropping the "no internet" network.

---

## 6. Run the village daemon (relay + HTTP serve)

One command wires serial → driver → cache → relay → HTTP:
```bash
cd /opt/wave
PYTHONPATH=/opt/wave:/opt/wave/server \
WAVE_PI_PORT=/dev/ttyUSB0 \
WAVE_PI_HTTP_PORT=80 \
python3 -m pi.router.serve
```
You should see `router.boot opening /dev/ttyUSB0` then `router.http listening on 0.0.0.0:80`.

### Environment variables

| Var | Default | Meaning |
|---|---|---|
| `WAVE_PI_PORT` | `/dev/ttyUSB0` | Heltec B serial port |
| `WAVE_PI_BAUD` | `115200` | Serial baud (must match firmware) |
| `WAVE_PI_HTTP_HOST` | `0.0.0.0` | HTTP bind address |
| `WAVE_PI_HTTP_PORT` | `80` | HTTP port students hit (`http://10.0.0.1`) |
| `WAVE_VILLAGE_ADDR` | `2` | This Pi's Heltec B LoRa address |
| `WAVE_TOWN_ADDR` | `1` | Destination for student uplinks (laptop's Heltec A) |
| `WAVE_NETWORK_ID` | `18` | LoRa network id — must match town |
| `WAVE_PARAMETER` | `10,7,1,7` | SF,BW,CR,PP — must match town |
| `WAVE_CACHE_DB` | `/var/lib/wave/cache.sqlite` | Late-joiner cache |

### Run it as a service (auto-start on boot)

```bash
sudo tee /etc/systemd/system/wave-router.service >/dev/null <<'EOF'
[Unit]
Description=Wave village router (LoRa relay + HTTP serve)
After=network.target

[Service]
Environment=PYTHONPATH=/opt/wave:/opt/wave/server
Environment=WAVE_PI_PORT=/dev/ttyUSB0
Environment=WAVE_PI_HTTP_PORT=80
ExecStart=/usr/bin/python3 -m pi.router.serve
WorkingDirectory=/opt/wave
Restart=always
RestartSec=3
# Port 80 needs privilege; running as root is simplest on a single-purpose Pi.
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now wave-router
journalctl -u wave-router -f      # watch it
```

---

## 7. Point the student app at the Pi

The student PWA can be served from the Pi or loaded from the laptop's Vite build. Either way, set the
LoRa down-sync target so the app polls the Pi instead of an (unreachable) MQTT broker:

`Wave/.env.local`:
```env
VITE_API_BASE=http://10.0.0.1      # REST (sign-in, catalog) — host the Django build on the Pi, or
                                   # bundle a static build; for a pure-LoRa classroom, see note below
VITE_PI_HTTP=http://10.0.0.1       # ← enables HttpPollTransport (the LoRa path)
```
When `VITE_PI_HTTP` is set, [createRepository](Wave/src/repo/index.ts) selects `HttpPollTransport`,
which polls `GET http://10.0.0.1/api/sync?section=<slug>` every ~3 s, decodes each tokenized
envelope with the same codec as MQTT, and feeds the existing handlers — the student sees the lesson.

> The serve layer here covers the **live down-sync + uplink** path. If you want the full REST app
> (auth, catalog) offline too, run the Django server on the Pi as well and keep `VITE_API_BASE`
> pointing at it; that is independent of the LoRa transport added in this change.

---

## 8. End-to-end test checklist

With the laptop town side running (`LORA_ENABLED=true`, `python manage.py run_mqtt`) and the Pi
daemon up:

1. **Link up:** on the Pi, `journalctl -u wave-router -f` shows `router.http listening...` and no
   `+ERR=99` (which would mean a dead radio / missing antenna).
2. **Publish:** trigger a remediation publish on the teacher dashboard (or any down-cast). The
   laptop log shows `lora.send msgId=… chunks=N`; the Pi log shows `relay.cached section=<slug>
   type=TeacherRemediationMaterial`.
3. **Serve:** from a phone on `Wave-Classroom` (or the Pi itself):
   ```bash
   curl "http://10.0.0.1/api/sync?section=grade-6-section-newton"
   ```
   returns a JSON array of tokenized envelopes (arrays of numbers/strings).
4. **Receive:** open the student PWA on the phone with `VITE_PI_HTTP=http://10.0.0.1`; within a few
   seconds the remedial lesson appears. ✅ The student received what the server sent — over LoRa.
5. **Health:** `curl http://10.0.0.1/health` → `{"ok":true}`.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `router.boot` then a serial error | Wrong `WAVE_PI_PORT`; check `ls /dev/serial/by-id/`. |
| Repeating `+ERR=99` in logs | Heltec radio failed init — reseat the **antenna**, confirm it's a genuine V3. |
| Pi log never shows `relay.cached` | NetworkID/Parameter/freq mismatch between the two boards, or town `LORA_ENABLED` is false. Re-check both `.env` and `WAVE_*` vars match. |
| `/api/sync` returns `[]` | Section slug mismatch — the query param must be the **slug** of the section (lowercase, hyphenated). Watch the Pi log for the exact `section=` it cached. |
| Phone joins but app shows nothing | `VITE_PI_HTTP` not set in the build, or a browser CORS/mixed-content block — serve the app over plain HTTP (not HTTPS) on the LAN. |
| Frames drop at close range | Boards too close — add a 20 dB SMA attenuator or separate them (see [FIRMWARE.md](FIRMWARE.md) §6). |

---

## 10. What this Pi does / doesn't do

- **Does:** host the student Wi-Fi, reassemble LoRa downlinks, cache the last 20 payloads per
  section for late-joiners, serve them over HTTP, and forward student uplinks back to town over LoRa
  with half-duplex backoff.
- **Doesn't (yet):** run the Django REST API or Gemini — those live on the laptop/town side. A
  server-side LoRa *ingest* consumer for student uplinks is the next integration step; today the
  uplink reaches Heltec A over the air (and the relay/serve POST path is in place), but wiring it
  into the Django ingest loop is out of scope for this change.

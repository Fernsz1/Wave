# Wave — End-to-End Setup: 2× LoRa + Raspberry Pi 3B as Internet-Free Router

**Goal:** stand up the full classroom path and prove it end to end —
**laptop/server → Heltec A → (LoRa air) → Heltec B → Raspberry Pi 3B → Wi-Fi AP → phone** —
with **no internet anywhere in the loop**.

```
 TOWN (laptop, server)                                  VILLAGE (Pi 3B, router)
 ─────────────────────                                  ───────────────────────
 Django/codec + lora_payload.py                         pi.router.serve (relay + HTTP + cache)
        │ USB                                                  ▲ USB
   ┌──────────┐      LoRa 915 MHz, NetID 18, 10,7,1,7    ┌──────────┐
   │ Heltec A │ ◄════════════════ air ══════════════════►│ Heltec B │
   │  addr 1  │                                          │  addr 2  │
   └──────────┘                                          └────┬─────┘
                                                              │ wlan0: hostapd + dnsmasq
                                                         SSID "Wave-Classroom"  10.0.0.1
                                                              │  (captive-portal-free, no WAN)
                                                          📱 student phone (browser)
```

Both Heltec boards run the same AT-emulation image
([firmware/heltec_wave_at/](firmware/heltec_wave_at/)); role is set at runtime by `AT+ADDRESS`.
This guide assumes you've already flashed both boards and confirmed the radio link works
(see [HARDWARE_TEST_PROGRESS_REPORT.md](HARDWARE_TEST_PROGRESS_REPORT.md)).

Companions: [HARDWARE.md](HARDWARE.md) (wiring) · [FIRMWARE.md](FIRMWARE.md) (AT subset) ·
[HOW_TO_RUN_AND_TEST.md](HOW_TO_RUN_AND_TEST.md) (the wider stack).

---

## 0. What you need

| Item | Role | Notes |
|---|---|---|
| Laptop | Town / server (LoRa addr **1**) | Runs Python + `tools/lora_payload.py` driving **Heltec A** |
| Heltec WiFi LoRa 32 V3 ×2 | Radios (**A**=town, **B**=village) | Flashed, antennas on, link verified |
| Raspberry Pi 3B | Village / router (LoRa addr **2**) | Runs `pi.router.serve`, `hostapd`, `dnsmasq` |
| microSD + 5V 2.5A PSU | Pi OS + power | Use a rated supply — weak chargers throttle the Pi |
| Student phone | Client | Joins `Wave-Classroom`, uses a browser only |
| 20 dB SMA attenuator | (bench only) | Add on one side if the boards sit < 1 m apart |

> **Antennas on BOTH boards before power-on** — transmitting without one destroys the SX1262 PA.

The Pi 3B has a single 2.4 GHz Wi-Fi radio. We use `wlan0` for the **classroom AP**, so the Pi
has **no internet** — which is the point. Get the repo onto the Pi **before** you start (USB
stick or one-time wired Ethernet), because once `wlan0` is the AP there's no WAN to `git clone` over.

---

## 1. Raspberry Pi setup (one time)

### 1.0 What software ends up on the Pi

| Layer | Software | Why |
|---|---|---|
| OS | **Raspberry Pi OS Lite (64-bit)**, Bookworm | Headless router — no desktop needed |
| AP daemon | **`hostapd`** | Broadcasts the `Wave-Classroom` Wi-Fi |
| DHCP/DNS | **`dnsmasq`** | Leases IPs + answers captive-portal probes locally |
| Runtime | **Python 3.11+** (ships with OS) + **`pyserial`** | `pi.router.serve` talks to Heltec B |
| Convenience | **`git`**, **`picocom`** | Clone the repo; poke the board manually |

You do **not** need Django, Node, Mosquitto, Flask, or a Gemini key on the Pi — those all live on
the laptop/town side. The router is deliberately lean.

### 1.1 Flash the SD card (on your laptop)

Use **Raspberry Pi Imager** (raspberrypi.com/software) → **Choose OS** → *Raspberry Pi OS (other)* →
**Raspberry Pi OS Lite (64-bit)** → **Choose Storage** (your microSD).

Before writing, click the **⚙ gear / Edit Settings** and pre-configure (this saves a monitor +
keyboard):
- **Hostname:** `wave-pi`
- **Enable SSH** → *Use password authentication*
- **Username / password:** e.g. `pi` / `<your-password>`
- **Configure Wi-Fi:** your **normal home/Ethernet Wi-Fi** (temporary — only so the Pi has internet
  to install packages and clone the repo; you'll switch `wlan0` to the classroom AP in §4)
- **Locale:** set country `PH`, timezone as appropriate

Write, then put the card in the Pi and power it with the **5V 2.5A** supply.

### 1.2 First boot + connect over SSH

Find the Pi on your network and SSH in (from the laptop):
```bash
ssh pi@wave-pi.local
# or use the IP from your router: ssh pi@192.168.1.42
```
Expected first-login banner:
```
Linux wave-pi 6.6.x-v8 ... aarch64 GNU/Linux
pi@wave-pi:~ $
```

Confirm OS + Python version:
```bash
cat /etc/os-release | head -1        # -> PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
python3 --version                    # -> Python 3.11.2  (3.11+ is fine)
```

### 1.3 Update + install system packages

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y hostapd dnsmasq python3-pip git picocom
sudo systemctl unmask hostapd       # Bookworm ships hostapd masked by default
```
Expected tail of the install:
```
Setting up hostapd (2:2.10-...) ...
Setting up dnsmasq (2.90-...) ...
Setting up picocom (...) ...
```
Stop the daemons until we've written their configs (otherwise dnsmasq fights `wlan0`):
```bash
sudo systemctl stop hostapd dnsmasq
```

### 1.4 Install the one Python dependency

```bash
pip3 install --break-system-packages pyserial
```
Expected:
```
Successfully installed pyserial-3.5
```
> `--break-system-packages` is required on Bookworm (PEP 668). Add `pydantic` too **only** if you
> also want to run the `tools/lora_payload.py recv` link-proof in §3 (it does schema validation);
> the router daemon itself needs only `pyserial`.

### 1.5 Get the repo onto the Pi

While the Pi still has its temporary internet (§1.1):
```bash
git clone <your-wave-repo-url> ~/Wave
cd ~/Wave && ls pi/router
```
Expected:
```
cache.py  config  __init__.py  relay.py  serve.py
```
> No internet on the Pi? Copy the repo folder via USB stick or `scp` from the laptop instead:
> `scp -r ./Wave pi@wave-pi.local:~/Wave`. Everything below assumes the repo is at `~/Wave`.

Everything from §4 onward assumes the repo lives at `~/Wave` (adjust paths if not).

---

## 2. Wire Heltec B to the Pi and find its serial port

### 2.1 Wiring — USB (recommended)

Plug **Heltec B** into any Pi USB-A port with a USB-C cable. One cable carries **both power and
serial** (the CP2102 USB-UART is onboard the Heltec V3 — no adapter, no jumpers).

```
 ┌─────────────┐   USB-C ──► USB-A   ┌──────────────────┐
 │  Heltec B   │═══════════════════► │  Raspberry Pi 3B │
 │  (addr 2)   │   power + serial    │  /dev/ttyUSB0    │
 │  📡 antenna │                     │  5V 2.5A PSU     │
 └─────────────┘                     └──────────────────┘
```

| Heltec B | Pi 3B | Carries |
|---|---|---|
| USB-C port | any USB-A port | 5V power **and** UART serial @ 115200 |
| IPEX/U.FL **ANT** | — | 863–928 MHz stub antenna — **attach before power-on** |

> **Antenna first.** Powering/transmitting Heltec B without its antenna can destroy the SX1262 PA.

### 2.2 Wiring — GPIO UART (alternative, no USB)

Only if you want to free the USB port. Pi 3B GPIO and Heltec V3 are **both 3.3 V — no level
shifter needed**. Cross TX↔RX:

| Heltec B pin | Pi 3B header pin | Signal |
|---|---|---|
| GND | Pin 6 | Ground |
| 3V3 | Pin 1 (3.3 V) | Power |
| TX (GPIO43) | Pin 10 / GPIO15 (RXD) | Heltec → Pi |
| RX (GPIO44) | Pin 8 / GPIO14 (TXD) | Pi → Heltec |

This path uses `/dev/ttyAMA0` and requires disabling the serial **login console** first:
```bash
sudo raspi-config    # → Interface Options → Serial Port → login shell? NO → hardware enabled? YES
sudo reboot
```
Full pin reference: [HARDWARE.md](HARDWARE.md#device-4--raspberry-pi-3b-village-side-host).
**For this guide we assume USB / `/dev/ttyUSB0`.**

### 2.3 Find the serial port

With Heltec B plugged in:
```bash
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```
Expected:
```
/dev/ttyUSB0
```
Confirm it's the Silicon Labs CP210x:
```bash
dmesg | grep -i cp210
```
Expected (something like):
```
usb 1-1.2: cp210x converter now attached to ttyUSB0
```

### 2.4 Permissions — let your user own the port

So you don't need `sudo` for the port:
```bash
sudo usermod -aG dialout $USER
exit            # log out and SSH back in for the group to take effect
```
Verify after re-login:
```bash
groups | grep dialout       # -> ... dialout ...
```

### 2.5 Sanity-check the board answers AT

```bash
picocom -b 115200 /dev/ttyUSB0
```
Type `AT+VER?` and press Enter. Expected:
```
+VER=WAVE-HELTEC-1.1-DIAG
```
Quit picocom with **Ctrl-A** then **Ctrl-Q**. If you see garbage, the baud is wrong (must be
115200); if nothing, recheck the port from §2.3.

---

## 3. Prove the LoRa link end-to-end FIRST (no Wi-Fi yet)

Before adding the AP, confirm a **real codec-encoded payload** travels laptop → air → Pi and
**decodes + schema-validates**. This is the core end-to-end proof and uses only tooling that
already exists and is tested. Wi-Fi is layered on after.

**On the Pi** (server-side venv already created per [HOW_TO_RUN_AND_TEST.md](HOW_TO_RUN_AND_TEST.md) §B;
or just `pip3 install --break-system-packages pyserial pydantic`):
```bash
cd ~/Wave/server
python3 tools/lora_payload.py recv --port /dev/ttyUSB0 --address 2
# -> [lora] /dev/ttyUSB0 configured addr=2 net=18
#    [lora] listening on addr 2; Ctrl+C to stop
```

**On the laptop** (Heltec A on e.g. `COM3`), send a remediation pack *down* to the Pi (addr 2):
```powershell
cd server
.venv\Scripts\python tools\lora_payload.py send-remediation --port COM3 --address 1 --dest 2 `
    --section "Grade 7 - Einstein" --subject science
```

The Pi terminal should print the fully reconstructed, **`schema ok`** object:
```
=== received TeacherRemediationMaterial (… bytes) — schema ok ===
  from section='Grade 7 - Einstein' subject='science' dir='down'
{ "id": "REM-…", "originalTopicId": "L1-T2", "title": …, … }
```

That single line — `schema ok`, object intact — means **the whole pipeline works**: AT framing,
RF, chunking, reassembly, codec decode, and wire-model validation, across two boards and the Pi.

> If nothing arrives: confirm both boards share `NetworkID 18` / `Parameter 10,7,1,7`, antennas
> are on, and `--dest` matches the Pi's `--address`. See the
> [troubleshooting table](#7-troubleshooting).

---

## 4. Bring up the internet-free Wi-Fi AP (Pi 3B)

Now make the Pi a router. Give `wlan0` a static address, install the project AP configs, and
start `hostapd`/`dnsmasq`.

> ### 4.0 Network-stack note — read first
> Raspberry Pi OS **Bookworm** manages networking with **NetworkManager**, not `dhcpcd`. To use the
> `dhcpcd` static-IP method below, install `dhcpcd` and tell NetworkManager to stop managing `wlan0`
> (otherwise the two fight over the interface):
> ```bash
> sudo apt install -y dhcpcd5
> sudo tee /etc/NetworkManager/conf.d/wave-unmanaged.conf >/dev/null <<'EOF'
> [keyfile]
> unmanaged-devices=interface-name:wlan0
> EOF
> sudo systemctl reload NetworkManager
> ```
> On older **Bullseye** `dhcpcd` is already the default — skip this box.

**4a. Static IP on `wlan0`** — append to `/etc/dhcpcd.conf`:
```bash
sudo tee -a /etc/dhcpcd.conf >/dev/null <<'EOF'

# Wave classroom AP — wlan0 is the gateway, no upstream
interface wlan0
    static ip_address=10.0.0.1/24
    nohook wpa_supplicant
EOF
```

**4b. Install the project AP configs** (SSID `Wave-Classroom`, captive-portal-friendly DNS):
```bash
sudo cp ~/Wave/pi/router/config/hostapd.conf /etc/hostapd/hostapd.conf
sudo cp ~/Wave/pi/router/config/dnsmasq.conf  /etc/dnsmasq.d/wave.conf
```
Point hostapd at that file (Debian default reads `/etc/default/hostapd`):
```bash
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd
```

The two config files (already in the repo — shown here so you can verify what got copied):

`/etc/hostapd/hostapd.conf` ([pi/router/config/hostapd.conf](pi/router/config/hostapd.conf)):
```ini
interface=wlan0
driver=nl80211
ssid=Wave-Classroom
hw_mode=g            # 2.4 GHz — the Pi 3B's only band
channel=6
wmm_enabled=1
auth_algs=1
wpa=2
wpa_passphrase=changeme-per-classroom   # <-- change this (4c)
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
ignore_broadcast_ssid=0
country_code=PH
```

`/etc/dnsmasq.d/wave.conf` ([pi/router/config/dnsmasq.conf](pi/router/config/dnsmasq.conf)):
```ini
interface=wlan0
bind-interfaces
dhcp-range=10.0.0.50,10.0.0.150,255.255.255.0,12h   # leases for phones
# Answer captive-portal probes ourselves so devices don't auto-disconnect:
address=/connectivitycheck.gstatic.com/10.0.0.1
address=/captive.apple.com/10.0.0.1
address=/connectivity-check.ubuntu.com/10.0.0.1
address=/www.msftconnecttest.com/10.0.0.1
address=/#/10.0.0.1     # everything else resolves to the Pi — no upstream DNS
```

**4c. Set a real passphrase** — edit `/etc/hostapd/hostapd.conf` and change
`wpa_passphrase=changeme-per-classroom` to something ≥ 8 characters:
```bash
sudo nano /etc/hostapd/hostapd.conf
```

**4d. Enable and start:**
```bash
sudo systemctl unmask hostapd
sudo systemctl enable --now hostapd dnsmasq
sudo systemctl restart dhcpcd
```
Verify each piece:
```bash
sudo systemctl status hostapd --no-pager | grep Active   # -> Active: active (running)
sudo systemctl status dnsmasq --no-pager | grep Active   # -> Active: active (running)
ip addr show wlan0 | grep inet                            # -> inet 10.0.0.1/24 ...
```

> What the configs do: [hostapd.conf](pi/router/config/hostapd.conf) advertises **`Wave-Classroom`**
> on 2.4 GHz channel 6, WPA2. [dnsmasq.conf](pi/router/config/dnsmasq.conf) hands out `10.0.0.50–150`
> and answers captive-portal probes locally so phones don't drop the AP with a "no internet"
> warning. There is **no upstream DNS** — by design.

From your phone: join **`Wave-Classroom`** (enter the passphrase from 4c), then browse to
`http://10.0.0.1/` — you should reach the Pi and get:
```json
{"service": "wave-classroom-router", "address": 2}
```
A "no internet" indicator on the phone is expected and fine. (That JSON appears once §5 is running;
before that the connection itself proves the AP works.)

---

## 5. Run the router daemon (relay + HTTP + cache)

This is the piece the original `relay.py` left to "the deployment image" — now provided as
[pi/router/serve.py](pi/router/serve.py). It opens Heltec B, starts the downlink listener, and
serves the cache to phones over HTTP.

```bash
cd ~/Wave
sudo mkdir -p /var/lib/wave && sudo chown $USER /var/lib/wave   # cache.sqlite lives here
python3 -m pi.router.serve --serial /dev/ttyUSB0 --address 2 --bind 10.0.0.1 --http-port 80
```
Expect:
```
… lora /dev/ttyUSB0 configured addr=2 net=18
… relay listening for downlinks; cache=/var/lib/wave/cache.sqlite
… http serving on 10.0.0.1:80
```

> Binding port 80 needs root: either run with `sudo` (use the repo's `python3`), or pass
> `--http-port 8080` and have phones use `http://10.0.0.1:8080`.

**HTTP surface served to the classroom:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness — `{"status":"ok","address":2}` |
| `GET` | `/api/remediation?section=<name>` | newest-first cached material for a section |
| `POST` | `/api/uplink` (body = envelope JSON) | queue a student uplink → ships to server (addr 1) with CSMA backoff |

---

## 6. The full end-to-end test (server → air → Pi → phone)

With §4 + §5 running on the Pi:

1. **Server sends remediation down.** On the laptop:
   ```powershell
   cd server
   .venv\Scripts\python tools\lora_payload.py send-remediation --port COM3 --address 1 --dest 2 `
       --section "Grade 7 - Einstein" --subject science
   ```
2. **Pi relays + caches.** The `serve` log shows `relay.cached section='Grade 7 - Einstein' type=TeacherRemediationMaterial`.
3. **Phone fetches it** (phone on `Wave-Classroom`, in its browser or any HTTP client):
   ```
   http://10.0.0.1/api/remediation?section=Grade%207%20-%20Einstein
   ```
   Returns a JSON array with the remediation payload — **served entirely offline, over LoRa, by the Pi.**
4. **(Reverse) student uplink.** POST an envelope to `/api/uplink`; the relay ships it back to the
   server over LoRa. Verify with `lora_payload.py recv --port COM3 --address 1` on the laptop —
   it prints the decoded `StudentProgress` with `schema ok`.

   ```bash
   # quick uplink smoke test from the phone or any device on the AP:
   curl -X POST http://10.0.0.1/api/uplink -H "Content-Type: application/json" \
        -d '{"version":1,"msgId":"deadbeef","type":"StudentProgress","direction":"up","section":"Grade 7 - Einstein","payload":["101234567891"]}'
   ```

### Pass criteria

| # | Check | Pass looks like |
|---|---|---|
| 1 | LoRa link (§3) | Pi prints `received … — schema ok`, object intact |
| 2 | AP up (§4) | Phone joins `Wave-Classroom`, reaches `http://10.0.0.1/`, stays connected |
| 3 | Router serving (§5) | `/api/health` returns `{"status":"ok"}` |
| 4 | Downlink to phone (§6.1–3) | `/api/remediation?section=…` returns the sent material |
| 5 | Uplink to server (§6.4) | Laptop `recv` decodes the student envelope, `schema ok` |
| 6 | No internet | Phone shows "no internet" yet the app works — that's success |

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `+VER` wrong / silent on `picocom` | Wrong port or baud. Use `115200`; recheck `ls /dev/ttyUSB*`. Board must answer `AT+VER?` before anything works. |
| Nothing received in §3 | NetworkID/Parameter/dest mismatch, or no antenna. Both boards need `NetworkID 18`, `Parameter 10,7,1,7`; `--dest` must equal the receiver's `--address`. |
| `Permission denied: /dev/ttyUSB0` | Not in `dialout` group — `sudo usermod -aG dialout $USER`, then log out/in. |
| `+ERR=10` on send | Frame > 240 B (quote-escape inflation). The tool's `LORA_SAFE_FRAME=180` handles this; if you raised `--frame`, lower it. |
| `hostapd` won't start | `sudo systemctl unmask hostapd`; check `country_code=PH` in [hostapd.conf](pi/router/config/hostapd.conf); confirm `wlan0` exists (`iw dev`). |
| Phone gets no IP | `dnsmasq` down or `wlan0` not at `10.0.0.1`. Check `systemctl status dnsmasq` and `ip addr show wlan0`; restart `dhcpcd`. |
| `wlan0` keeps losing its `10.0.0.1` IP (Bookworm) | NetworkManager is still managing it. Apply the §4.0 `unmanaged-devices` snippet, `sudo systemctl reload NetworkManager`, then `sudo systemctl restart dhcpcd`. |
| Phone keeps dropping the AP | Captive-portal probe leaking — confirm [dnsmasq.conf](pi/router/config/dnsmasq.conf) is at `/etc/dnsmasq.d/wave.conf` and `dnsmasq` reloaded. |
| `Permission denied` binding port 80 | Run `serve` with `sudo`, or use `--http-port 8080`. |
| `ModuleNotFoundError: wave_api` | Run from the repo root as `python3 -m pi.router.serve` (the entrypoint adds `server/` to the path). |
| `/api/remediation` returns `[]` | Section name mismatch (URL-encode spaces) or nothing cached yet — check the `serve` log for `relay.cached`. |
| Pi undervoltage / random resets | Weak PSU. Use a rated **5V 2.5A** supply, not a phone charger. |

---

## 8. Run it as a service (optional, for an unattended classroom)

So the router comes up on boot:

```bash
sudo tee /etc/systemd/system/wave-router.service >/dev/null <<EOF
[Unit]
Description=Wave classroom LoRa router
After=network.target hostapd.service dnsmasq.service

[Service]
ExecStart=/usr/bin/python3 -m pi.router.serve --serial /dev/ttyUSB0 --address 2 --bind 10.0.0.1 --http-port 80
WorkingDirectory=$HOME/Wave
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now wave-router
journalctl -u wave-router -f      # watch the logs
```

---

## 9. Where this maps in the codebase

| Stage | Code |
|---|---|
| Town send / decode | [server/tools/lora_payload.py](server/tools/lora_payload.py) · [server/wave_api/codec.py](server/wave_api/codec.py) |
| AT driver / `+RCV` | [server/wave_api/lora/rylr998.py](server/wave_api/lora/rylr998.py) |
| Fragment / reassemble | [server/wave_api/lora/chunk.py](server/wave_api/lora/chunk.py) · [transport.py](server/wave_api/lora/transport.py) |
| Heltec firmware | [firmware/heltec_wave_at/heltec_wave_at.ino](firmware/heltec_wave_at/heltec_wave_at.ino) |
| Pi relay (LoRa↔cache, CSMA uplink) | [pi/router/relay.py](pi/router/relay.py) |
| Pi late-joiner cache | [pi/router/cache.py](pi/router/cache.py) |
| **Pi router entrypoint (HTTP + relay glue)** | [pi/router/serve.py](pi/router/serve.py) |
| AP configs | [pi/router/config/hostapd.conf](pi/router/config/hostapd.conf) · [pi/router/config/dnsmasq.conf](pi/router/config/dnsmasq.conf) |

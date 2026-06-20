/*
 * Wave — Heltec WiFi LoRa 32 V3 firmware (RYLR998 AT-command emulation)
 * ====================================================================
 *
 * One image, flashed to BOTH boards (Heltec A = town, Heltec B = village).
 * Each board's role is set at runtime by the host over USB serial with
 * `AT+ADDRESS=` — there is nothing board-specific to compile.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Wave host stack (server/wave_api/lora/rylr998.py) was written for a
 * REYAX RYLR998 AT-command modem. Rather than rewrite that proven Python
 * driver + transport + test suite, this firmware makes the Heltec V3's SX1262
 * *speak the same AT dialect* over USB serial. To the laptop and the Pi, a
 * Heltec board is indistinguishable from an RYLR998 — so rylr998.py,
 * transport.py, relay.py and tests/hw/ all work unchanged.
 *
 * AT SUBSET (must match the regexes in rylr998.py byte-for-byte):
 *   AT+ADDRESS=<n>            -> +OK            set my 16-bit address
 *   AT+ADDRESS?               -> +ADDRESS=<n>
 *   AT+NETWORKID=<n>          -> +OK            net id; RX filters on it
 *   AT+PARAMETER=SF,BW,CR,PP  -> +OK            radio params (see mapping)
 *   AT+SEND=<addr>,<len>,<d>  -> +OK | +ERR=<c> transmit, ack after TX done
 *   AT+VER?                   -> +VER=...
 *   (async on receive)        -> +RCV=<src>,<len>,<data>,<rssi>,<snr>
 *
 * Lines are terminated with CRLF. Serial runs at 115200 (matches the host
 * conftest fixtures and HARDWARE.md).
 *
 * REQUIRES
 * --------
 *   - Board support: "Heltec WiFi LoRa 32(V3)" (arduino-esp32 / Heltec ESP32)
 *   - Library: RadioLib by Jan Gromes (MIT) — install via Library Manager
 *
 * SAFETY: attach the 863–928 MHz stub antenna to BOTH boards before power-on.
 * Transmitting without an antenna can destroy the SX1262 PA.
 */

#include <RadioLib.h>

// ---- Compile-time radio defaults -------------------------------------------
// Set frequency and TX power to your regional SRD allocation (e.g. NTC for PH).
// 915.0 MHz matches the RYLR998-915 default and sits inside the 863–928 band.
#define WAVE_FREQ_MHZ   915.0
#define WAVE_TX_DBM     14      // conservative; RYLR998 default is higher
#define WAVE_SYNC_WORD  0x12    // private network sync word (both boards equal)
#define MAX_PAYLOAD     240     // RYLR998 AT+SEND payload ceiling

// ---- Heltec WiFi LoRa 32 V3 SX1262 pin map (wired on the PCB) ---------------
// NSS=GPIO8, DIO1=GPIO14, NRST=GPIO12, BUSY=GPIO13; SPI SCK=9/MISO=11/MOSI=10.
SX1262 radio = new Module(8, 14, 12, 13);

// ---- Runtime state (provisioned by the host via AT) -------------------------
static uint16_t myAddr    = 0;
static uint8_t  myNetId   = 0;
// AT+PARAMETER defaults = "10,7,1,7" (SF10, BW125k, CR4/5, preamble 7).
static int      paramSF   = 10;
static int      paramBWc  = 7;
static int      paramCRc  = 1;
static int      paramPP   = 7;

// Set by the SX1262 DIO1 interrupt when a packet has arrived.
static volatile bool rxFlag = false;

// ---- On-air frame header ----------------------------------------------------
// [netId:1][destAddr:2 BE][srcAddr:2 BE][payload:N]. Lets the receiver filter
// by network id + destination and report the true source address in +RCV.
static const size_t HDR_LEN = 5;

ICACHE_RAM_ATTR void onDio1() { rxFlag = true; }

// ---- Helpers ----------------------------------------------------------------

static void emit(const String& line) {
  Serial.print(line);
  Serial.print("\r\n");
}

static float bwCodeToKHz(int code) {
  switch (code) {
    case 7: return 125.0;
    case 8: return 250.0;
    case 9: return 500.0;
    default: return 125.0;
  }
}

// Apply the current SF/BW/CR/preamble + fixed freq/power/sync to the radio,
// then arm RX. Returns true on success.
static bool applyRadioConfig() {
  int st = radio.begin(
      WAVE_FREQ_MHZ,
      bwCodeToKHz(paramBWc),
      paramSF,
      paramCRc + 4,        // CR code 1..4 -> RadioLib 5..8 (4/5..4/8)
      WAVE_SYNC_WORD,
      WAVE_TX_DBM,
      paramPP);
  if (st != RADIOLIB_ERR_NONE) return false;
  radio.setDio1Action(onDio1);
  return radio.startReceive() == RADIOLIB_ERR_NONE;
}

// Transmit one payload string to `dest`. Returns an RYLR998-style error code
// (0 = success). 10 mirrors the RYLR998 "data length" error.
static int doSend(uint16_t dest, const String& data) {
  size_t n = data.length();
  if (n > MAX_PAYLOAD) return 10;

  uint8_t buf[HDR_LEN + MAX_PAYLOAD];
  buf[0] = myNetId;
  buf[1] = (dest >> 8) & 0xFF;
  buf[2] = dest & 0xFF;
  buf[3] = (myAddr >> 8) & 0xFF;
  buf[4] = myAddr & 0xFF;
  memcpy(buf + HDR_LEN, data.c_str(), n);

  int st = radio.transmit(buf, HDR_LEN + n);   // blocks for the airtime
  radio.startReceive();                        // always return to listening
  if (st == RADIOLIB_ERR_NONE) return 0;
  // RadioLib codes are negative; surface the real one as 100-st so the host
  // sees e.g. +ERR=105 for TX_TIMEOUT(-5) instead of a useless +ERR=1.
  return 100 - st;
}

// Drain one received packet (if any) and, when it is addressed to us on our
// network, emit a +RCV line. Called from loop() when rxFlag is set.
static void drainRx() {
  rxFlag = false;
  size_t len = radio.getPacketLength();
  if (len <= HDR_LEN) { radio.startReceive(); return; }

  uint8_t buf[HDR_LEN + MAX_PAYLOAD + 1];
  int st = radio.readData(buf, len);
  radio.startReceive();
  if (st != RADIOLIB_ERR_NONE) return;

  uint8_t  netId = buf[0];
  uint16_t dest  = (buf[1] << 8) | buf[2];
  uint16_t src   = (buf[3] << 8) | buf[4];
  if (netId != myNetId) return;        // not our network
  if (dest != myAddr) return;          // not for us

  size_t payloadLen = len - HDR_LEN;
  String data;
  data.reserve(payloadLen);
  for (size_t i = 0; i < payloadLen; i++) data += (char)buf[HDR_LEN + i];

  // RYLR998 reports RSSI as a negative integer and SNR as an integer.
  emit("+RCV=" + String(src) + "," + String(payloadLen) + "," + data + "," +
       String((int)radio.getRSSI()) + "," + String((int)radio.getSNR()));
}

// ---- AT command parsing -----------------------------------------------------

static void handleSend(const String& args) {
  // args = "<addr>,<len>,<data>" — split on the first two commas only; the
  // payload itself may legally contain commas.
  int c1 = args.indexOf(',');
  int c2 = args.indexOf(',', c1 + 1);
  if (c1 < 0 || c2 < 0) { emit("+ERR=1"); return; }

  uint16_t dest = (uint16_t)args.substring(0, c1).toInt();
  String   data = args.substring(c2 + 1);

  int err = doSend(dest, data);
  if (err == 0) emit("+OK");
  else emit("+ERR=" + String(err));
}

static void handleParameter(const String& args) {
  // args = "SF,BW,CR,PP"
  int v[4]; int idx = 0; int start = 0;
  for (int i = 0; i <= (int)args.length() && idx < 4; i++) {
    if (i == (int)args.length() || args[i] == ',') {
      v[idx++] = args.substring(start, i).toInt();
      start = i + 1;
    }
  }
  if (idx != 4) { emit("+ERR=1"); return; }
  paramSF = v[0]; paramBWc = v[1]; paramCRc = v[2]; paramPP = v[3];
  emit(applyRadioConfig() ? "+OK" : "+ERR=1");
}

static void handleLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (line == "AT+VER?") {
    emit("+VER=WAVE-HELTEC-1.1-DIAG");
  } else if (line == "AT+ADDRESS?") {
    emit("+ADDRESS=" + String(myAddr));
  } else if (line.startsWith("AT+ADDRESS=")) {
    myAddr = (uint16_t)line.substring(11).toInt();
    emit("+OK");
  } else if (line.startsWith("AT+NETWORKID=")) {
    myNetId = (uint8_t)line.substring(13).toInt();
    emit("+OK");
  } else if (line.startsWith("AT+PARAMETER=")) {
    handleParameter(line.substring(13));
  } else if (line.startsWith("AT+SEND=")) {
    handleSend(line.substring(8));
  } else if (line == "AT") {
    emit("+OK");
  } else {
    // Unknown command. Echo what we actually parsed (length + text) so a
    // mis-terminated or mangled line is visible instead of a bare +ERR=1.
    emit("+ERR=1 UNKNOWN len=" + String(line.length()) + " [" + line + "]");
  }
}

// ---- Arduino entry points ---------------------------------------------------

void setup() {
  Serial.begin(115200);
  // Power up the SX1262 supply rail (Vext) on Heltec V3 if your board variant
  // gates it; the stock V3 powers the radio directly, so begin() is enough.
  if (!applyRadioConfig()) {
    // Surface a persistent error so the operator notices a dead radio.
    while (true) { emit("+ERR=99"); delay(1000); }
  }
}

void loop() {
  // 1) Service any received packet.
  if (rxFlag) drainRx();

  // 2) Drain complete AT lines from the host.
  static String inbuf;
  static bool   overflow = false;   // set when a line exceeds the buffer
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\n') {
      // If the line overran the buffer (e.g. two AT+SEND lines pasted at once
      // with no newline between them), report it instead of letting the
      // leftover tail be misparsed as a bogus command.
      if (overflow) emit("+ERR=1 LINE TOO LONG (send one AT+SEND at a time)");
      else handleLine(inbuf);
      inbuf = "";
      overflow = false;
    } else if (ch != '\r' && !overflow) {
      inbuf += ch;
      if (inbuf.length() > HDR_LEN + MAX_PAYLOAD + 32) { inbuf = ""; overflow = true; }
    }
  }
}

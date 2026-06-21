/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MQTT_URL?: string;
  /** Raspberry Pi HTTP base (e.g. http://10.0.0.1) — enables the LoRa down-sync path. */
  readonly VITE_PI_HTTP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

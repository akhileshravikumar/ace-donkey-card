/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACE_DONKEY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

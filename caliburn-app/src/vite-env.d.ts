/// <reference types="vite/client" />

// Upstream's `excalidraw-app/vite-env.d.ts`, reduced to the variables this
// app reads.
interface ImportMetaEnv {
  readonly VITE_APP_BACKEND_V2_GET_URL: string;
  readonly VITE_APP_BACKEND_V2_POST_URL: string;
  readonly VITE_APP_LIBRARY_URL: string;
  readonly VITE_APP_LIBRARY_BACKEND: string;
  readonly VITE_APP_WS_SERVER_URL: string;
  readonly VITE_APP_FIREBASE_CONFIG: string;
  readonly VITE_APP_DISABLE_PREVENT_UNLOAD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

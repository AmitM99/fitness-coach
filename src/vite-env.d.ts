/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for exercise images and GIFs. Defaults to the locally bundled
   * copy; set it when deploying somewhere that shouldn't host the media.
   */
  readonly VITE_MEDIA_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

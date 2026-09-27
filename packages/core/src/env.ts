/** Env names only — never commit values. Cutline ≠ DCN VM. */
export const ENV = {
  GEMINI_API_KEY: "GEMINI_API_KEY",
  GEMINI_TEXT_MODEL: "GEMINI_TEXT_MODEL",
  GEMINI_IMAGE_MODEL: "GEMINI_IMAGE_MODEL",
  TINYFISH_API_KEY: "TINYFISH_API_KEY",
  PEXELS_API_KEY: "PEXELS_API_KEY",
  CUTLINE_PUBLIC_URL: "CUTLINE_PUBLIC_URL",
  // Do NOT put TELEGRAM_DCN_* or IG_* from /root/dcn here for deploy-on-VM.
} as const;

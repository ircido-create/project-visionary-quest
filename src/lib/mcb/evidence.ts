/**
 * Constantes das evidências (prints de insights), compartilhadas entre o navegador
 * e as server functions. Os mesmos limites estão declarados no bucket `evidencias`
 * (ver supabase/migrations/20260909190000_fase2_evidencias_storage.sql) — o Storage
 * rejeita o que passar daqui, então os dois lados precisam concordar.
 */

export const EVIDENCE_BUCKET = "evidencias";

export const EVIDENCE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type EvidenceMimeType = (typeof EVIDENCE_MIME_TYPES)[number];

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

/** Vida útil da URL assinada de leitura. Curta porque o bucket é privado. */
export const EVIDENCE_URL_TTL_SECONDS = 300;

export const EVIDENCE_EXTENSION: Record<EvidenceMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const isEvidenceMimeType = (value: string): value is EvidenceMimeType =>
  (EVIDENCE_MIME_TYPES as readonly string[]).includes(value);

export const formatBytes = (bytes: number | null) => {
  if (bytes === null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

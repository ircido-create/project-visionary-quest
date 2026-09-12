/**
 * Motor determinístico de qualificação do MCB.
 *
 * Regras do template Ybera (v1):
 *  - Seguidores: >= 500
 *  - Publicações no feed: > 30 (ou seja, 31+)
 *  - Recência: as 12 publicações mais recentes nos últimos 6 meses
 *  - Tipo de perfil: criadora de conteúdo
 *  - Público feminino: > 50% (estritamente acima)
 *
 * Este módulo é puro e testável. A IA nunca substitui estes critérios.
 */

export type RequirementStatus = "PASS" | "FAIL" | "UNKNOWN" | "REVIEW";
export type QualificationStatus = "QUALIFIED" | "NOT_QUALIFIED" | "NEEDS_EVIDENCE" | "MANUAL_REVIEW";
export type TriState = "SIM" | "NAO" | "NAO_SEI";
export type ProfileType = "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI";
export type DataSource = "META_API" | "MANUAL" | "SCREENSHOT" | "INTERNAL";

export const RULE_SET_VERSION = "v1";

export const TARGETS = {
  followers: 500,
  posts: 30, // estritamente maior que 30
  femaleAudience: 50, // estritamente maior que 50%
  recentPosts: 12,
} as const;

export type QualificationInput = {
  followers: number | null | undefined;
  postsCount: number | null | undefined;
  recentPosts6m: TriState | null | undefined;
  profileType: ProfileType | null | undefined;
  femaleAudiencePct: number | null | undefined;
  source?: DataSource;
  capturedAt?: string | null;
};

export type RequirementResult = {
  key: string;
  label: string;
  status: RequirementStatus;
  currentValue: string | number | null;
  targetValue: string | number;
  targetLabel: string;
  gap: string | null;
  source: DataSource;
  updatedAt: string | null;
};

export type ProgressBreakdown = { key: string; label: string; score: number; maxScore: number };

export type QualificationResult = {
  ruleSetVersion: string;
  status: QualificationStatus;
  requirements: RequirementResult[];
  progress: {
    score: number;
    level: string;
    breakdown: ProgressBreakdown[];
  };
};

export const PROGRESS_WEIGHTS: Array<{ key: string; label: string; weight: number }> = [
  { key: "nicho", label: "Nicho definido", weight: 10 },
  { key: "bio", label: "Bio pronta", weight: 10 },
  { key: "perfil_organizado", label: "Perfil organizado", weight: 10 },
  { key: "stories", label: "Stories ativos", weight: 10 },
  { key: "conteudo_consistente", label: "Conteúdo consistente", weight: 15 },
  { key: "posts_30", label: "Mais de 30 publicações", weight: 10 },
  { key: "seguidores_500", label: "500 seguidores", weight: 20 },
  { key: "publico_feminino", label: "Mais de 50% de público feminino", weight: 10 },
  { key: "posts_recentes", label: "12 publicações recentes", weight: 5 },
];

/** Números no padrão brasileiro (12.400; 72,5). Muda só a exibição, não a regra. */
export function numeroBR(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** O valor atual de um requisito para exibir: número formatado, texto como está. */
export function formatarValorAtual(valor: RequirementResult["currentValue"]): string | null {
  if (valor === null) return null;
  return typeof valor === "number" ? numeroBR(valor) : valor;
}

export const LEVELS = {
  ONE: "Nível 1 — Estruturar",
  TWO: "Nível 2 — Produzir",
  THREE: "Nível 3 — Crescer",
  AUDIT: "Pronta para auditoria",
  QUALIFIED: "Qualificada para análise",
} as const;

export type ProgressSignals = {
  nicheDefined?: boolean;
  bioReady?: boolean;
  profileOrganized?: boolean;
  storiesActive?: boolean;
  consistentContent?: boolean;
};

function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evaluateQualification(
  input: QualificationInput,
  signals: ProgressSignals = {},
): QualificationResult {
  const source = input.source ?? "MANUAL";
  const updatedAt = input.capturedAt ?? null;
  const followers = num(input.followers);
  const posts = num(input.postsCount);
  const female = num(input.femaleAudiencePct);

  const requirements: RequirementResult[] = [];

  // 1. Seguidores >= 500
  requirements.push({
    key: "followers",
    label: "Seguidores",
    status: followers === null ? "UNKNOWN" : followers >= TARGETS.followers ? "PASS" : "FAIL",
    currentValue: followers,
    targetValue: TARGETS.followers,
    targetLabel: "500 ou mais",
    gap:
      followers === null
        ? "aguardando dado"
        : followers >= TARGETS.followers
          ? null
          : `faltam ${numeroBR(TARGETS.followers - followers)}`,
    source,
    updatedAt,
  });

  // 2. Publicações > 30
  requirements.push({
    key: "posts",
    label: "Publicações no feed",
    status: posts === null ? "UNKNOWN" : posts > TARGETS.posts ? "PASS" : "FAIL",
    currentValue: posts,
    targetValue: TARGETS.posts + 1,
    targetLabel: "mais de 30 (31 ou mais)",
    gap:
      posts === null
        ? "aguardando dado"
        : posts > TARGETS.posts
          ? null
          : `faltam ${numeroBR(TARGETS.posts + 1 - posts)}`,
    source,
    updatedAt,
  });

  // 3. Recência das 12 últimas publicações
  const recency = input.recentPosts6m ?? null;
  requirements.push({
    key: "recency",
    label: "12 publicações mais recentes nos últimos 6 meses",
    status: recency === "SIM" ? "PASS" : recency === "NAO" ? "FAIL" : "UNKNOWN",
    currentValue: recency === "SIM" ? "Sim" : recency === "NAO" ? "Não" : null,
    targetValue: "Sim",
    targetLabel: "12 publicações nos últimos 6 meses",
    gap:
      recency === "SIM"
        ? null
        : recency === "NAO"
          ? "publicar com regularidade nos próximos meses"
          : "aguardando datas das 12 últimas publicações",
    source,
    updatedAt,
  });

  // 4. Tipo de perfil
  const profileType = input.profileType ?? null;
  requirements.push({
    key: "profile_type",
    label: "Perfil de criadora de conteúdo",
    status:
      profileType === "CRIADOR"
        ? "PASS"
        : profileType === "PESSOAL" || profileType === "COMERCIAL"
          ? "FAIL"
          : "UNKNOWN",
    currentValue: profileType === null || profileType === "NAO_SEI" ? null : profileTypeLabel(profileType),
    targetValue: "Criadora de conteúdo",
    targetLabel: "conta de criadora de conteúdo",
    gap:
      profileType === "CRIADOR"
        ? null
        : profileType === null || profileType === "NAO_SEI"
          ? "aguardando confirmação do tipo de conta"
          : "alterar para conta de criadora de conteúdo",
    source,
    updatedAt,
  });

  // 5. Público feminino > 50%
  requirements.push({
    key: "female_audience",
    label: "Público feminino",
    status: female === null ? "UNKNOWN" : female > TARGETS.femaleAudience ? "PASS" : "FAIL",
    currentValue: female === null ? null : `${numeroBR(female)}%`,
    targetValue: "acima de 50%",
    targetLabel: "estritamente acima de 50%",
    gap:
      female === null
        ? "aguardando dado"
        : female > TARGETS.femaleAudience
          ? null
          : `precisa ultrapassar 50% (hoje ${numeroBR(female)}%)`,
    source,
    updatedAt,
  });

  const hasFail = requirements.some((r) => r.status === "FAIL");
  const hasUnknown = requirements.some((r) => r.status === "UNKNOWN");
  const inconsistent =
    (female !== null && (female < 0 || female > 100)) ||
    (followers !== null && followers < 0) ||
    (posts !== null && posts < 0);

  let status: QualificationStatus;
  if (inconsistent) status = "MANUAL_REVIEW";
  else if (hasFail) status = "NOT_QUALIFIED";
  else if (hasUnknown) status = "NEEDS_EVIDENCE";
  else status = "QUALIFIED";

  const progress = computeProgress(requirements, signals, status);
  return { ruleSetVersion: RULE_SET_VERSION, status, requirements, progress };
}

export function computeProgress(
  requirements: RequirementResult[],
  signals: ProgressSignals,
  status: QualificationStatus,
): QualificationResult["progress"] {
  const pass = (key: string) => requirements.find((r) => r.key === key)?.status === "PASS";
  const values: Record<string, boolean> = {
    nicho: Boolean(signals.nicheDefined),
    bio: Boolean(signals.bioReady),
    perfil_organizado: Boolean(signals.profileOrganized),
    stories: Boolean(signals.storiesActive),
    conteudo_consistente: Boolean(signals.consistentContent),
    posts_30: pass("posts"),
    seguidores_500: pass("followers"),
    publico_feminino: pass("female_audience"),
    posts_recentes: pass("recency"),
  };

  const breakdown = PROGRESS_WEIGHTS.map((w) => ({
    key: w.key,
    label: w.label,
    score: values[w.key] ? w.weight : 0,
    maxScore: w.weight,
  }));
  const score = breakdown.reduce((sum, b) => sum + b.score, 0);

  return { score, level: resolveLevel(score, status), breakdown };
}

export function resolveLevel(score: number, status: QualificationStatus): string {
  if (status === "QUALIFIED") return LEVELS.QUALIFIED;
  if (score >= 85) return LEVELS.AUDIT;
  if (score >= 55) return LEVELS.THREE;
  if (score >= 30) return LEVELS.TWO;
  return LEVELS.ONE;
}

/** Soma dos pesos do índice de progresso. Deve ser sempre 100. */
export function totalWeight(): number {
  return PROGRESS_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
}

export function profileTypeLabel(type: ProfileType): string {
  switch (type) {
    case "PESSOAL":
      return "Pessoal";
    case "CRIADOR":
      return "Criadora de conteúdo";
    case "COMERCIAL":
      return "Comercial";
    default:
      return "Não sei";
  }
}

export const QUALIFICATION_LABELS: Record<QualificationStatus, string> = {
  QUALIFIED: "Qualificada para análise",
  NOT_QUALIFIED: "Ainda não qualificada",
  NEEDS_EVIDENCE: "Aguardando comprovação",
  MANUAL_REVIEW: "Revisão manual necessária",
};

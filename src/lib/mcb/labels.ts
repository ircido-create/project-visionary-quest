import type { Database } from "@/integrations/supabase/types";

export type InfluencerStatus = Database["public"]["Enums"]["influencer_status"];

export const STATUS_ORDER: InfluencerStatus[] = [
  "NOVA_INSCRICAO",
  "AGUARDANDO_DIAGNOSTICO",
  "AGUARDANDO_EVIDENCIAS",
  "EM_ESTRUTURACAO",
  "EM_PRODUCAO",
  "EM_CRESCIMENTO",
  "PRONTA_AUDITORIA",
  "QUALIFICADA",
  "ENVIADA_ANALISE",
  "APROVADA",
  "NAO_APROVADA",
  "PAUSADA",
  "ARQUIVADA",
];

export const STATUS_LABELS: Record<InfluencerStatus, string> = {
  NOVA_INSCRICAO: "Nova inscrição",
  AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
  AGUARDANDO_EVIDENCIAS: "Aguardando evidências",
  EM_ESTRUTURACAO: "Em estruturação",
  EM_PRODUCAO: "Em produção",
  EM_CRESCIMENTO: "Em crescimento",
  PRONTA_AUDITORIA: "Pronta para auditoria",
  QUALIFICADA: "Qualificada para análise",
  ENVIADA_ANALISE: "Enviada para análise oficial",
  APROVADA: "Aprovada",
  NAO_APROVADA: "Não aprovada",
  PAUSADA: "Pausada",
  ARQUIVADA: "Arquivada",
};

export const METHOD_STAGES = [
  {
    key: "estruture",
    title: "Estruture",
    description: "Nicho, bio, organização do perfil e posicionamento claro.",
  },
  { key: "apareca", title: "Apareça", description: "Stories, Reels e presença constante com naturalidade." },
  { key: "conecte", title: "Conecte", description: "Conversa real com quem te acompanha e construção de vínculo." },
  { key: "cresca", title: "Cresça", description: "Audiência, público feminino e requisitos numéricos." },
  { key: "qualifique", title: "Qualifique", description: "Auditoria dos requisitos e preparação para a análise oficial." },
] as const;

export const PILLARS = ["Atrair", "Conectar", "Ensinar"] as const;

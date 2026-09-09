/**
 * Extensão TEMPORÁRIA do tipo do banco.
 *
 * `src/integrations/supabase/types.ts` é gerado pelo Lovable a partir do schema, e
 * ainda não conhece `ai_analyses` porque a migração foi aplicada à mão (ver
 * supabase/migrations/20260909200000_fase2_analises_ia.sql). Sem isto, qualquer
 * `.from("ai_analyses")` não compila.
 *
 * Quando o Lovable regenerar o types.ts, este arquivo deixa de ser necessário:
 * apagar e passar a usar o tipo gerado. Não editar o types.ts diretamente — ele é
 * sobrescrito na próxima geração.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

export type AiAnalysisStatus = "PENDENTE" | "CONCLUIDA" | "ERRO";

export type AiAnalysisRow = {
  id: string;
  tenant_id: string;
  influencer_id: string;
  prompt_version: string;
  model: string;
  input: Json;
  output: Json | null;
  status: AiAnalysisStatus;
  error: string | null;
  confirmed: boolean;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AiAnalysisInsert = {
  id?: string;
  tenant_id: string;
  influencer_id: string;
  prompt_version: string;
  model: string;
  input?: Json;
  output?: Json | null;
  status?: AiAnalysisStatus;
  error?: string | null;
  confirmed?: boolean;
  created_by?: string | null;
  created_at?: string;
  completed_at?: string | null;
};

export type AiAnalysisUpdate = Partial<AiAnalysisInsert>;

type PublicSchema = Database["public"];

export type DatabaseWithAi = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables"> & {
    Tables: PublicSchema["Tables"] & {
      ai_analyses: {
        Row: AiAnalysisRow;
        Insert: AiAnalysisInsert;
        Update: AiAnalysisUpdate;
        Relationships: [];
      };
    };
  };
};

export type SupabaseWithAi = SupabaseClient<DatabaseWithAi>;

/**
 * O client do middleware é tipado com `Database` (sem ai_analyses). O cast é o preço
 * de a migração ter sido aplicada por fora do Lovable; ele some junto com este arquivo.
 */
export const withAi = (client: unknown) => client as SupabaseWithAi;

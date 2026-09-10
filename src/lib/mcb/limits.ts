/**
 * Limites por plano.
 *
 * Os valores vivem em `plans` desde a fase 1 (`max_candidates`, `max_members`,
 * `max_ai_analyses`, `storage_mb`) e a tela de Configurações já os exibia — mas nada
 * os aplicava. Este módulo é quem recusa.
 *
 * Estoque x fluxo: candidatas, membros e armazenamento são **acumulados** — contam o
 * total que existe hoje. Análises de IA são **mensais**, reiniciando no primeiro dia de
 * cada mês: numa assinatura mensal, um teto vitalício deixaria o ambiente inutilizável
 * a partir do segundo mês.
 *
 * Ambiente sem plano atribuído não é bloqueado. Isso mantém a Porta de Entrada dos
 * ambientes de demonstração funcionando e evita que um erro de cadastro de plano
 * derrube a inscrição de candidatas reais.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;
type Plano = Database["public"]["Tables"]["plans"]["Row"];

async function planoDoAmbiente(supabase: Db, tenantId: string): Promise<Plano | null> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant?.plan_id) return null;

  const { data: plano } = await supabase
    .from("plans")
    .select("*")
    .eq("id", tenant.plan_id)
    .maybeSingle();
  return plano ?? null;
}

/** Mensagem única para todos os limites, para a saída ser previsível na tela. */
function recusar(plano: Plano, oQue: string, atual: number, maximo: number): never {
  throw new Error(
    `O plano ${plano.name} permite ${maximo} ${oQue} e este ambiente já tem ${atual}. ` +
      `Para ampliar, mude de plano em Configurações.`,
  );
}

export async function garantirEspacoParaCandidata(supabase: Db, tenantId: string) {
  const plano = await planoDoAmbiente(supabase, tenantId);
  if (!plano) return;

  const { count } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const atual = count ?? 0;
  if (atual >= plano.max_candidates) recusar(plano, "candidatas", atual, plano.max_candidates);
}

/**
 * Convite pendente ocupa vaga. Sem isso, dava para convidar dez pessoas de uma vez e
 * estourar o limite quando todas aceitassem.
 */
export async function garantirEspacoParaMembro(supabase: Db, tenantId: string) {
  const plano = await planoDoAmbiente(supabase, tenantId);
  if (!plano) return;

  const [{ count: membros }, { count: convites }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("accepted_at", null),
  ]);

  const atual = (membros ?? 0) + (convites ?? 0);
  if (atual >= plano.max_members) recusar(plano, "pessoas na equipe", atual, plano.max_members);
}

export async function garantirEspacoParaAnalise(supabase: Db, tenantId: string) {
  const plano = await planoDoAmbiente(supabase, tenantId);
  if (!plano) return;

  // Janela em UTC, e não na hora local: o servidor pode rodar em qualquer fuso, e a
  // cota de uma assinatura não deveria mudar de lugar conforme onde ele está hospedado.
  // `created_at` é timestamptz, então a comparação é feita no mesmo referencial.
  const agora = new Date();
  const inicioDoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));

  const { count } = await supabase
    .from("ai_analyses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", inicioDoMes.toISOString());

  const atual = count ?? 0;
  if (atual >= plano.max_ai_analyses) {
    throw new Error(
      `O plano ${plano.name} permite ${plano.max_ai_analyses} análises por mês e este ` +
        `ambiente já usou ${atual}. O limite reinicia no dia 1º, ou mude de plano em Configurações.`,
    );
  }
}

/**
 * Soma os bytes já guardados e compara com o teto do plano. A soma é feita aqui, e não
 * no banco, porque `size_bytes` é a única coluna lida e o volume por ambiente é pequeno.
 */
export async function garantirEspacoParaArquivo(supabase: Db, tenantId: string, bytes: number) {
  const plano = await planoDoAmbiente(supabase, tenantId);
  if (!plano) return;

  const { data: arquivos } = await supabase
    .from("files")
    .select("size_bytes")
    .eq("tenant_id", tenantId);

  const usados = (arquivos ?? []).reduce((soma, a) => soma + (a.size_bytes ?? 0), 0);
  const teto = plano.storage_mb * 1024 * 1024;

  if (usados + bytes > teto) {
    const emMb = (valor: number) => (valor / (1024 * 1024)).toFixed(1);
    throw new Error(
      `O plano ${plano.name} permite ${plano.storage_mb} MB de arquivos e este ambiente ` +
        `já usa ${emMb(usados)} MB. Remova evidências antigas ou mude de plano em Configurações.`,
    );
  }
}

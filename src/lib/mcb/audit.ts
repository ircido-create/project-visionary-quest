import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";

export type AuditEntry = {
  tenant_id: string;
  /**
   * Ausente na Porta de Entrada: a candidata se inscreve sem estar autenticada, e
   * aquele fluxo grava pelo cliente de serviço, que não passa por RLS.
   */
  actor_id?: string | null;
  action: string;
  entity?: string;
  entity_id?: string | null;
  meta?: Json;
};

/**
 * Registra na trilha de auditoria e **reclama** quando falha.
 *
 * Existe por causa de um bug que passou despercebido a fase 1 inteira: `audit_logs`
 * tinha RLS habilitado sem política de INSERT, então toda escrita era rejeitada. Como
 * cada ponto de chamada fazia `await supabase.from("audit_logs").insert(...)` e
 * descartava o `error`, nada aparecia em lugar nenhum — e a trilha que a documentação
 * prometia simplesmente não existia.
 *
 * A falha continua não interrompendo a ação de quem está usando o sistema: auditoria
 * quebrada não é motivo para impedir alguém de salvar um cadastro. A diferença é que
 * agora ela aparece nos logs do servidor em vez de sumir.
 */
export async function audit(supabase: SupabaseClient<Database>, entry: AuditEntry): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert(entry);
  if (error) {
    console.error(
      `[auditoria] não foi possível registrar "${entry.action}"` +
        `${entry.entity ? ` em ${entry.entity}` : ""}: ${error.message}`,
    );
  }
}

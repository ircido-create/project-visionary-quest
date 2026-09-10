-- Corrige a trilha de auditoria, que nunca chegou a gravar nada.
--
-- `audit_logs` tem RLS habilitado desde a fase 1, mas só recebeu a política de SELECT
-- (`audit_member_read`). Sem política de INSERT, toda escrita é rejeitada — e como o
-- código não checa o erro desses inserts, a falha era silenciosa.
--
-- O impacto vai além do incômodo: `docs/mcb-fase-1.md` afirma que audit_logs guarda
-- "quem fez o quê, quando e em qual ambiente", e isso faz parte da postura de LGPD do
-- projeto. A afirmação não era verdadeira. Também quebrava a trilha de confirmação das
-- evidências e das análises, que é lida de audit_logs em vez de colunas próprias.
--
-- `actor_id = auth.uid()` está no with check de propósito: sem isso, um membro poderia
-- registrar uma ação em nome de outra pessoa, o que é justamente o que uma trilha de
-- auditoria não pode permitir.

create policy "audit_member_write" on public.audit_logs
for insert to authenticated
with check (
  tenant_id is not null
  and public.is_tenant_member(tenant_id)
  and actor_id = auth.uid()
);

-- Sem update nem delete de propósito: trilha de auditoria é append-only. Quem precisar
-- corrigir um registro escreve outro por cima, e a correção também fica registrada.

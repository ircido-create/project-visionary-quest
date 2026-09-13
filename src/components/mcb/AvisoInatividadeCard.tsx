/**
 * Fase 6 — Aviso no painel: candidatas que serão excluídas por inatividade.
 *
 * Aparece só quando alguma entrou na janela de aviso (os 15 dias antes dos 90). Qualquer
 * ação na página da candidata conta como atividade e adia a exclusão.
 */

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { DIAS_PARA_EXCLUSAO } from "@/lib/mcb/inatividade";
import { candidatasPertoDaExclusao } from "@/lib/mcb/inatividade.functions";
import { dataBR } from "@/lib/mcb/relatorio";

export function AvisoInatividadeCard({ tenantId }: { tenantId: string }) {
  const buscar = useServerFn(candidatasPertoDaExclusao);
  const consulta = useQuery({
    queryKey: ["mcb", "inatividade", tenantId],
    queryFn: () => buscar({ data: { tenantId } }),
    staleTime: 0,
  });

  const lista = consulta.data ?? [];
  if (lista.length === 0) return null;

  return (
    <section className="glass rounded-xl border border-destructive/40 p-6">
      <h2 className="font-serif text-xl">Perto da exclusão por inatividade</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Candidatas sem nenhuma atividade por {DIAS_PARA_EXCLUSAO} dias têm os dados excluídos, como
        diz a Política de Privacidade. Qualquer ação na página delas — uma nota, uma tarefa, números
        atualizados — conta como atividade e adia a exclusão.
      </p>
      <ul className="mt-4 grid gap-2 text-sm">
        {lista.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/candidatas/$id"
              params={{ id: c.id }}
              className="underline-offset-4 hover:underline"
            >
              {c.nome}
            </Link>
            <span className="text-xs text-muted-foreground">
              sem atividade há {c.diasSemAtividade} dias · exclusão em {dataBR(c.excluiEm)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

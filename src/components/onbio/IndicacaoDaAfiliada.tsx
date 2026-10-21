import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { money, useRedeOnbio } from "@/components/onbio/useRedeOnbio";
import {
  emailPendente,
  ROTULO_META,
  ROTULO_SITUACAO_DE_VENDAS,
  rotuloDoNivel,
} from "@/lib/onbio/rede";
import { definirIndicacaoOnbio } from "@/lib/onbio/rede.functions";

/** Lugar da afiliada na rede: quem indicou, quem ela indicou e as metas de cada mês. */
export function IndicacaoDaAfiliada({
  tenantId,
  influencerId,
  email,
  readOnly,
}: {
  tenantId: string;
  influencerId: string;
  email: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const definir = useServerFn(definirIndicacaoOnbio);
  const { consulta, rede, comissoes, percentuais } = useRedeOnbio(tenantId);
  const comissao = comissoes?.porPessoa.get(influencerId);

  const mudar = useMutation({
    mutationFn: (indicadaPor: string | null) =>
      definir({ data: { tenantId, influencerId, indicadaPor } }),
    onSuccess: async () => {
      toast.success("Indicação atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["onbio", "rede", tenantId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const no = rede?.nos.get(influencerId);
  // Não dá para escolher a própria afiliada nem alguém da rede abaixo dela.
  const abaixo = new Set<string>();
  if (no) {
    const pilha = [...no.indicadas];
    while (pilha.length) {
      const atual = pilha.pop()!;
      abaixo.add(atual.id);
      pilha.push(...atual.indicadas);
    }
  }
  const opcoes = rede
    ? [...rede.nos.values()]
        .filter((n) => n.id !== influencerId && !abaixo.has(n.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    : [];
  const meses = rede?.meses ?? [];

  return (
    <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
      <h2 className="text-xl font-semibold">Rede de indicações</h2>
      {emailPendente(email) ? (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Esta afiliada veio da importação sem e-mail. Atualize o e-mail real no perfil antes de
          mandar o acesso ao portal.
        </p>
      ) : null}
      {consulta.isLoading || !rede || !no ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {consulta.error ? (consulta.error as Error).message : "Carregando a rede..."}
        </p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="grid content-start gap-3 text-sm">
            <label className="grid gap-1">
              <span className="text-muted-foreground">Indicada por</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={no.indicadaPor ?? ""}
                disabled={readOnly || mudar.isPending}
                onChange={(e) => mudar.mutate(e.target.value || null)}
              >
                <option value="">Ninguém (topo da rede)</option>
                {opcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </label>
            <p>
              {no.nivel > 0 ? `${no.nivel}ª geração` : "Topo da rede"} ·{" "}
              {ROTULO_SITUACAO_DE_VENDAS[no.situacaoDeVendas]}
            </p>
            <p>
              Vendas importadas: <strong>{money(no.vendasCentavos)}</strong>
              {no.indicadas.length > 0 ? (
                <>
                  {" "}
                  · Equipe direta: <strong>{money(no.vendasDaEquipeCentavos)}</strong>
                </>
              ) : null}
            </p>
            {comissao && comissao.totalCentavos > 0 ? (
              <div className="rounded-md border border-border p-3">
                <p>
                  Comissão: <strong>{money(comissao.totalCentavos)}</strong>
                </p>
                <ul className="mt-1 grid gap-0.5 text-muted-foreground">
                  {comissao.propriaCentavos > 0 ? (
                    <li>
                      Venda própria ({percentuais[0]}%): {money(comissao.propriaCentavos)}
                    </li>
                  ) : null}
                  {comissao.porNivelCentavos.map((v, i) =>
                    v > 0 ? (
                      <li key={i}>
                        {rotuloDoNivel(i + 1)} ({percentuais[i + 1]}%): {money(v)}
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            ) : null}
            {meses.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {meses.map((mes) => {
                  const s = no.metas[mes];
                  return (
                    <li key={mes} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        {mes.slice(5)}/{mes.slice(0, 4)}
                      </span>
                      <span>
                        {s ? ROTULO_META[s].replace(" a meta", "").replace(" no mês", "") : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">
              Indicou diretamente
              {no.tamanhoDaRede > no.indicadas.length ? ` (${no.tamanhoDaRede} na rede toda)` : ""}
            </p>
            {no.indicadas.length === 0 ? (
              <p className="mt-2">Ninguém ainda.</p>
            ) : (
              <ul className="mt-2 grid gap-1">
                {no.indicadas.map((f) => (
                  <li key={f.id} className="flex justify-between gap-3">
                    <Link to="/candidatas/$id" params={{ id: f.id }} className="hover:underline">
                      {f.nome}
                    </Link>
                    <span className="tabular-nums">{money(f.vendasCentavos)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { StatCard } from "@/components/mcb/AppShell";
import { BotaoExportar } from "@/components/mcb/BotaoExportar";
import { Input } from "@/components/ui/input";
import {
  ROTULO_FONTE,
  ROTULO_SITUACAO,
  type SituacaoIntegracao,
} from "@/lib/onbio/seguidores";
import {
  exportarRelatorioSeguidores,
  getPainelSeguidores,
} from "@/lib/onbio/seguidores.functions";

const PERIODOS = [
  { valor: "7", rotulo: "Últimos 7 dias" },
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "365", rotulo: "Últimos 12 meses" },
  { valor: "personalizado", rotulo: "Escolher datas" },
] as const;

const numero = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
const dataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const TOM_SITUACAO: Record<SituacaoIntegracao, string> = {
  CONECTADO: "border-primary/40 bg-primary/10 text-primary",
  PENDENTE: "border-border bg-muted text-muted-foreground",
  ERRO: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function SeloSituacao({
  situacao,
  titulo,
}: {
  situacao: SituacaoIntegracao;
  titulo?: string | null;
}) {
  return (
    <span
      title={titulo ?? undefined}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TOM_SITUACAO[situacao]}`}
    >
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}

export function Crescimento({
  valor,
  percentual,
}: {
  valor: number | null;
  percentual: number | null;
}) {
  if (valor === null) return <span className="text-muted-foreground">sem dados</span>;
  const tom = valor > 0 ? "text-primary" : valor < 0 ? "text-destructive" : "text-muted-foreground";
  const seta = valor > 0 ? "▲" : valor < 0 ? "▼" : "■";
  return (
    <span className={`whitespace-nowrap tabular-nums ${tom}`}>
      <span aria-hidden="true">{seta} </span>
      {valor > 0 ? "+" : ""}
      {valor.toLocaleString("pt-BR")}
      {percentual !== null ? (
        <span className="ml-1 text-xs">
          ({percentual > 0 ? "+" : ""}
          {percentual.toLocaleString("pt-BR")}%)
        </span>
      ) : null}
    </span>
  );
}

/**
 * Acompanhamento de seguidores das afiliadas ONBIO. No painel mostra indicadores e o
 * intervalo da rotina; na lista, só filtros e tabela. Os dois exportam o que está filtrado.
 */
export function AcompanhamentoSeguidores({
  tenantId,
  modo,
}: {
  tenantId: string;
  readOnly: boolean;
  modo: "painel" | "lista";
}) {
  const buscar = useServerFn(getPainelSeguidores);
  const exportar = useServerFn(exportarRelatorioSeguidores);

  const [periodoEscolhido, setPeriodoEscolhido] =
    useState<(typeof PERIODOS)[number]["valor"]>("30");
  const [de, setDe] = useState(() =>
    new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("sv-SE"),
  );
  const [ate, setAte] = useState(hoje);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"TODAS" | SituacaoIntegracao>("TODAS");

  const periodo =
    periodoEscolhido === "personalizado" ? { de, ate } : { dias: Number(periodoEscolhido) };
  const periodoValido =
    periodoEscolhido !== "personalizado" || (de !== "" && ate !== "" && de <= ate);

  const consulta = useQuery({
    queryKey: ["onbio", "seguidores", tenantId, periodo],
    queryFn: () => buscar({ data: { tenantId, periodo } }),
    enabled: periodoValido,
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace(/^@/, "");
    return (consulta.data?.afiliadas ?? []).filter(
      (a) =>
        (situacao === "TODAS" || a.situacao === situacao) &&
        (!termo ||
          a.nome.toLowerCase().includes(termo) ||
          (a.instagram ?? "").toLowerCase().includes(termo)),
    );
  }, [consulta.data, busca, situacao]);

  const dados = consulta.data;
  const resumo = dados?.resumo;

  return (
    <div className="grid gap-6">
      {modo === "painel" && resumo ? (
        <section className="grid gap-4" aria-label="Indicadores de Instagram">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Seguidores das afiliadas</h2>
              <p className="text-sm text-muted-foreground">
                Última atualização: {dataHora(resumo.ultimaAtualizacao)}
              </p>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">Os dados oficiais são atualizados quando a afiliada autoriza a conta ou toca em “Atualizar agora” no próprio acompanhamento.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Afiliadas cadastradas" value={resumo.total} />
            <StatCard
              label="Perfis conectados"
              value={resumo.conectadas}
              tone="positive"
              hint={
                resumo.comErro
                  ? `${resumo.comErro} com erro na última consulta`
                  : "autorizados na Meta"
              }
            />
            <StatCard
              label="Pendentes de integração"
              value={resumo.pendentes}
              tone={resumo.pendentes ? "warning" : "default"}
              hint="ainda não autorizaram o Instagram"
            />
            <StatCard
              label="Seguidores consultados"
              value={resumo.seguidoresConsultados.toLocaleString("pt-BR")}
              hint={`soma de ${resumo.contasConsultadas} conta(s) lidas na Meta · ${resumo.semDadosAutorizados} sem dados autorizados`}
            />
            <StatCard
              label="Crescimento no período"
              value={`${resumo.crescimentoTotal > 0 ? "+" : ""}${resumo.crescimentoTotal.toLocaleString("pt-BR")}`}
              tone={resumo.crescimentoTotal > 0 ? "positive" : "default"}
              hint={`${resumo.contasComCrescimento} afiliada(s) com dois registros ou mais`}
            />
            <StatCard label="Última atualização" value={dataHora(resumo.ultimaAtualizacao)} />
          </div>
        </section>
      ) : null}

      <section className="glass rounded-xl border border-border/60 p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label
            htmlFor="filtro-afiliada"
            className="grid min-w-[200px] flex-1 gap-1 text-xs text-muted-foreground"
          >
            Afiliada ou @
            <Input
              id="filtro-afiliada"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou @usuario"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Integração
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as typeof situacao)}
            >
              <option value="TODAS">Todas</option>
              <option value="CONECTADO">Conectado</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ERRO">Erro</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Período
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={periodoEscolhido}
              onChange={(e) => setPeriodoEscolhido(e.target.value as typeof periodoEscolhido)}
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          {periodoEscolhido === "personalizado" ? (
            <>
              <label htmlFor="filtro-de" className="grid gap-1 text-xs text-muted-foreground">
                De
                <Input
                  id="filtro-de"
                  type="date"
                  value={de}
                  max={ate}
                  onChange={(e) => setDe(e.target.value)}
                />
              </label>
              <label htmlFor="filtro-ate" className="grid gap-1 text-xs text-muted-foreground">
                Até
                <Input
                  id="filtro-ate"
                  type="date"
                  value={ate}
                  min={de}
                  max={hoje()}
                  onChange={(e) => setAte(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <BotaoExportar
            rotulo="Exportar relatório (CSV/Excel)"
            desabilitado={!dados || !periodoValido}
            buscar={() =>
              exportar({ data: { tenantId, periodo, ids: filtradas.map((a) => a.id) } })
            }
          />
        </div>

        {!periodoValido ? (
          <p className="mt-4 text-sm text-destructive">
            A data inicial precisa ser anterior à final.
          </p>
        ) : consulta.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando seguidores...</p>
        ) : consulta.error ? (
          <p className="mt-6 text-sm text-destructive">{(consulta.error as Error).message}</p>
        ) : filtradas.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Nenhuma afiliada com esses filtros.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Afiliada</th>
                  <th className="py-2 pr-4">Instagram</th>
                  <th className="py-2 pr-4 text-right">Seguidores</th>
                  <th className="py-2 pr-4 text-right">Início do período</th>
                  <th className="py-2 pr-4">Crescimento</th>
                  <th className="py-2 pr-4">Atualização</th>
                  <th className="py-2 pr-4">Integração</th>
                  <th className="py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((a) => (
                  <tr key={a.id} className="border-t border-border/60 align-top">
                    <td className="py-3 pr-4">
                      <Link
                        to="/candidatas/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.nome}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {a.instagram && a.link ? (
                        <a
                          href={a.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          @{a.instagram}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      <span className="font-medium">{numero(a.seguidores)}</span>
                      {a.fonte ? (
                        <p
                          className={`text-xs ${a.fonte === "META_API" ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {a.fonte === "META_API" ? "Meta" : ROTULO_FONTE[a.fonte].toLowerCase()}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">sem dados</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {numero(a.inicioDoPeriodo)}
                    </td>
                    <td className="py-3 pr-4">
                      <Crescimento valor={a.crescimento} percentual={a.percentual} />
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{dataHora(a.atualizadoEm)}</td>
                    <td className="py-3 pr-4">
                      <SeloSituacao situacao={a.situacao} titulo={a.ultimoErro} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-3 whitespace-nowrap text-xs">
                        <Link
                          to="/candidatas/$id"
                          params={{ id: a.id }}
                          className="underline underline-offset-4"
                        >
                          Histórico
                        </Link>
                        {a.situacao === "PENDENTE" ? (
                          <Link
                            to="/candidatas/$id"
                            params={{ id: a.id }}
                            className="underline underline-offset-4"
                          >
                            Conectar ou informar
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Números da Meta vêm só de contas profissionais que a própria afiliada autorizou. Os demais
          aparecem como informados manualmente e não entram na soma de seguidores consultados.
        </p>
      </section>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { StatCard } from "@/components/mcb/AppShell";
import { Input } from "@/components/ui/input";
import {
  chaveDoTexto,
  emailPendente,
  ROTULO_META,
  ROTULO_SITUACAO_DE_VENDAS,
  type NoDaRede,
  type ResumoDaRede,
  type SituacaoDeVendas,
  type SituacaoMeta,
} from "@/lib/onbio/rede";
import { money, useRedeOnbio } from "@/components/onbio/useRedeOnbio";

const NOME_DO_MES = (mes: string) =>
  new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" });

const COR_META: Record<SituacaoMeta, string> = {
  BATEU: "bg-primary",
  NAO_BATEU: "bg-amber-500",
  SEM_VENDAS: "bg-muted-foreground/25",
};

const ORDEM_SITUACOES: SituacaoDeVendas[] = [
  "ULTIMO_MES",
  "HA_2_MESES",
  "HA_3_MESES",
  "HA_MAIS_DE_3_MESES",
  "NUNCA",
  "SEM_DADOS",
];

const ROTULO_PAPEL: Record<NoDaRede["papel"], string> = {
  TOPO: "Topo da rede",
  GESTORA: "Gestora",
  AFILIADA: "Afiliada",
};

function MetasDoNo({ no, meses }: { no: NoDaRede; meses: string[] }) {
  if (meses.length === 0) return null;
  return (
    <span className="inline-flex gap-1" aria-label="Meta por mês">
      {meses.map((mes) => {
        const s = no.metas[mes];
        const titulo = `${NOME_DO_MES(mes)}: ${s ? ROTULO_META[s] : "sem registro"}`;
        return (
          <span
            key={mes}
            title={titulo}
            aria-label={titulo}
            className={`h-3 w-3 rounded-sm ${s ? COR_META[s] : "border border-dashed border-border"}`}
          />
        );
      })}
    </span>
  );
}

function LinhaDaArvore({
  no,
  meses,
  abertos,
  alternar,
  filtro,
  visiveis,
}: {
  no: NoDaRede;
  meses: string[];
  abertos: Set<string>;
  alternar: (id: string) => void;
  filtro: string;
  visiveis: Set<string> | null;
}) {
  if (visiveis && !visiveis.has(no.id)) return null;
  const aberto = filtro !== "" || abertos.has(no.id);
  const temFilhas = no.indicadas.length > 0;
  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 py-2"
        style={{ paddingLeft: `${no.nivel * 1.25}rem` }}
      >
        {temFilhas ? (
          <button
            type="button"
            onClick={() => alternar(no.id)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label={aberto ? `Recolher a equipe de ${no.nome}` : `Abrir a equipe de ${no.nome}`}
            aria-expanded={aberto}
          >
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}
        <Link to="/candidatas/$id" params={{ id: no.id }} className="font-medium hover:underline">
          {no.nome}
        </Link>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {ROTULO_PAPEL[no.papel]}
          {no.nivel > 0 ? ` · ${no.nivel}ª geração` : ""}
        </span>
        {temFilhas ? (
          <span className="text-xs text-muted-foreground">
            {no.indicadas.length} direta{no.indicadas.length === 1 ? "" : "s"}
            {no.tamanhoDaRede > no.indicadas.length ? ` · ${no.tamanhoDaRede} na rede` : ""}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-3">
          <MetasDoNo no={no} meses={meses} />
          <span className="w-28 text-right tabular-nums">{money(no.vendasCentavos)}</span>
        </span>
      </div>
      {temFilhas && aberto ? (
        <ul>
          {no.indicadas.map((f) => (
            <LinhaDaArvore
              key={f.id}
              no={f}
              meses={meses}
              abertos={abertos}
              alternar={alternar}
              filtro={filtro}
              visiveis={visiveis}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Rede de indicações da ONBIO: totais, valor por equipe, acompanhamento e árvore. */
export function RedeOnbioSection({ tenantId }: { tenantId: string }) {
  const { consulta, rede } = useRedeOnbio(tenantId);
  if (consulta.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando a rede...</p>;
  }
  if (consulta.error) {
    return <p className="text-sm text-destructive">{(consulta.error as Error).message}</p>;
  }
  if (!rede) return null;
  const pendentes = (consulta.data?.pessoas ?? []).filter((p) => emailPendente(p.email)).length;
  return <RedeOnbioView rede={rede} pendentes={pendentes} />;
}

/** Parte visual, separada da busca para poder ser vista com dados de exemplo. */
export function RedeOnbioView({ rede, pendentes }: { rede: ResumoDaRede; pendentes: number }) {
  const [filtro, setFiltro] = useState("");
  // null = ainda não mexeram: só o topo da rede começa aberto.
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null);

  const equipes = useMemo(
    () =>
      [...rede.nos.values()]
        .filter((n) => n.indicadas.length > 0)
        .sort(
          (a, b) =>
            b.vendasDaEquipeCentavos - a.vendasDaEquipeCentavos ||
            a.nome.localeCompare(b.nome, "pt-BR"),
        ),
    [rede],
  );

  // Com busca: mostra quem bate com o termo e toda a linha acima dela.
  const visiveis = useMemo(() => {
    const termo = chaveDoTexto(filtro);
    if (termo === "") return null;
    const set = new Set<string>();
    for (const no of rede.nos.values()) {
      if (!chaveDoTexto(no.nome).includes(termo)) continue;
      let atual: NoDaRede | undefined = no;
      while (atual && !set.has(atual.id)) {
        set.add(atual.id);
        atual = atual.indicadaPor ? rede.nos.get(atual.indicadaPor) : undefined;
      }
    }
    return set;
  }, [rede, filtro]);

  const temRede = [...rede.nos.values()].some((n) => n.indicadaPor !== null);
  if (!temRede) {
    return (
      <section className="glass rounded-xl border border-border/60 p-6">
        <h2 className="text-xl font-semibold">Rede de indicações</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ainda não há indicações registradas. Importe a planilha da rede em{" "}
          <Link to="/candidatas" className="underline underline-offset-4">
            Afiliadas
          </Link>{" "}
          ou defina quem indicou cada afiliada na ficha dela.
        </p>
      </section>
    );
  }

  const totalSituacoes = ORDEM_SITUACOES.reduce((s, k) => s + rede.porSituacao[k], 0);
  const maiorSituacao = Math.max(1, ...ORDEM_SITUACOES.map((k) => rede.porSituacao[k]));
  const abertos = escolhidos ?? new Set(rede.raizes.map((r) => r.id));
  const alternar = (id: string) => {
    const novo = new Set(abertos);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setEscolhidos(novo);
  };
  const todasAbertas = [...rede.nos.values()].every(
    (n) => n.indicadas.length === 0 || abertos.has(n.id),
  );

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gestoras" value={rede.gestoras} hint="Quem tem indicadas diretas" />
        <StatCard label="Afiliadas" value={rede.afiliadas} hint="Sem indicadas diretas" />
        <StatCard label="Vendas da rede" value={money(rede.vendasCentavos)} tone="positive" />
        <StatCard
          label="Vendeu no último mês"
          value={rede.porSituacao.ULTIMO_MES}
          {...(rede.meses.length ? { hint: `Referência: ${NOME_DO_MES(rede.meses.at(-1)!)}` } : {})}
        />
      </div>

      {pendentes > 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {pendentes} pessoa{pendentes === 1 ? "" : "s"} da rede{" "}
          {pendentes === 1 ? "está" : "estão"} sem e-mail real. Atualize na ficha de cada uma antes
          de mandar o acesso ao portal.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
          <h2 className="text-xl font-semibold">Valor por equipe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Soma das vendas das indicadas diretas de cada gestora.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Gestora</th>
                  <th className="py-2 pr-4 text-right">Diretas</th>
                  <th className="py-2 pr-4 text-right">Rede</th>
                  <th className="py-2 text-right">Valor da equipe</th>
                </tr>
              </thead>
              <tbody>
                {equipes.map((g) => (
                  <tr key={g.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">
                      <Link
                        to="/candidatas/$id"
                        params={{ id: g.id }}
                        className="font-medium hover:underline"
                      >
                        {g.nome}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{g.indicadas.length}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{g.tamanhoDaRede}</td>
                    <td className="py-2 text-right tabular-nums">
                      {money(g.vendasDaEquipeCentavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold">Acompanhamento de vendas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pela última venda registrada nas metas mensais.
          </p>
          <ul className="mt-4 grid gap-3">
            {ORDEM_SITUACOES.filter(
              (k) => rede.porSituacao[k] > 0 || (k !== "SEM_DADOS" && k !== "HA_MAIS_DE_3_MESES"),
            ).map((k) => (
              <li key={k} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span>{ROTULO_SITUACAO_DE_VENDAS[k]}</span>
                  <span className="tabular-nums">
                    {rede.porSituacao[k]}
                    <span className="text-muted-foreground">
                      {" "}
                      ({Math.round((rede.porSituacao[k] / Math.max(1, totalSituacoes)) * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${k === "ULTIMO_MES" ? "bg-primary" : k === "NUNCA" ? "bg-destructive/70" : "bg-muted-foreground/50"}`}
                    style={{ width: `${(rede.porSituacao[k] / maiorSituacao) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-xl border border-border/60 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Árvore da rede</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quem indicou quem, com as vendas e a meta de cada mês.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Buscar na rede"
              placeholder="Buscar pelo nome"
              className="w-56"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() =>
                setEscolhidos(
                  todasAbertas
                    ? new Set()
                    : new Set(
                        [...rede.nos.values()].filter((n) => n.indicadas.length).map((n) => n.id),
                      ),
                )
              }
            >
              {todasAbertas ? "Recolher tudo" : "Abrir tudo"}
            </button>
          </div>
        </div>
        {rede.meses.length > 0 ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Meses: {rede.meses.map(NOME_DO_MES).join(" · ")}</span>
            {(Object.keys(COR_META) as SituacaoMeta[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={`h-3 w-3 rounded-sm ${COR_META[s]}`} aria-hidden="true" />
                {ROTULO_META[s]}
              </span>
            ))}
          </p>
        ) : null}
        <ul className="mt-3">
          {rede.raizes.map((r) => (
            <LinhaDaArvore
              key={r.id}
              no={r}
              meses={rede.meses}
              abertos={abertos}
              alternar={alternar}
              filtro={filtro}
              visiveis={visiveis}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

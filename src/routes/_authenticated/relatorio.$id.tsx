/**
 * Fase 5 — Relatório de evolução da candidata, para salvar em PDF pelo navegador.
 *
 * Fica fora da página da candidata (`/relatorio/$id`, não `/candidatas/$id/relatorio`)
 * para não transformar aquela página em layout. Não usa o AppShell: é um documento, e o
 * que não deve ir para o papel leva `print:hidden`. O que entra e o que fica de fora
 * está em `relatorio.ts`.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { getInfluencer } from "@/lib/mcb/app.functions";
import { QUALIFICATION_LABELS } from "@/lib/mcb/qualification";
import {
  SITUACAO_REQUISITO,
  contarAbertas,
  dataBR,
  formatarDiferenca,
  formatarNumero,
  pontosSeguidores,
  tarefasConcluidas,
  variacao,
} from "@/lib/mcb/relatorio";
import { useWorkspace } from "@/lib/mcb/useWorkspace";

export const Route = createFileRoute("/_authenticated/relatorio/$id")({
  head: () => ({
    meta: [
      { title: "Relatório de evolução — MCB" },
      { name: "description", content: "Evolução, requisitos e tarefas da candidata." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RelatorioPage,
});

const TOM: Record<string, string> = {
  PASS: "text-primary",
  FAIL: "text-destructive",
  UNKNOWN: "text-muted-foreground",
  REVIEW: "text-muted-foreground",
};

function RelatorioPage() {
  const { id } = Route.useParams();
  const { tenantId, active, profile } = useWorkspace();
  const buscar = useServerFn(getInfluencer);

  // A mesma chave da página da candidata: vindo de lá, o relatório abre sem nova consulta.
  const consulta = useQuery({
    queryKey: ["mcb", "influencer", tenantId, id],
    queryFn: () => buscar({ data: { tenantId: tenantId!, influencerId: id } }),
    enabled: Boolean(tenantId),
  });

  if (!tenantId || consulta.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando relatório…</p>;
  }

  const dados = consulta.data;
  if (!dados) {
    return (
      <p className="p-8 text-sm">
        Esta candidata não existe neste ambiente.{" "}
        <Link to="/candidatas" className="underline underline-offset-4">
          Voltar para a lista
        </Link>
      </p>
    );
  }

  const { influencer, evaluation, snapshots, tasks } = dados;
  const seguidores = variacao(snapshots, "followers");
  const publicacoes = variacao(snapshots, "posts");
  const publico = variacao(snapshots, "female");
  const grafico = pontosSeguidores(snapshots);
  const concluidas = tarefasConcluidas(tasks);
  const abertas = contarAbertas(tasks);
  const cumpridos = evaluation.requirements.filter((r) => r.status === "PASS").length;
  const primeiro = snapshots[0];
  const ultimo = snapshots[snapshots.length - 1];
  const local = [influencer.city, influencer.state].filter(Boolean).join(", ");

  const linhas = [
    { rotulo: "Seguidores", v: seguidores, casas: 0, sufixo: "" },
    { rotulo: "Publicações no feed", v: publicacoes, casas: 0, sufixo: "" },
    { rotulo: "Público feminino", v: publico, casas: 1, sufixo: "%" },
  ];

  return (
    <main className="mx-auto max-w-[820px] bg-background p-6 text-foreground print:max-w-none print:p-0">
      {/* Margens da folha. Só vale na impressão; na tela não faz nada. */}
      <style>{"@page { size: A4; margin: 14mm; }"}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link to="/candidatas/$id" params={{ id }}>
            Voltar à candidata
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Na janela que abrir, escolha &ldquo;Salvar como PDF&rdquo; como destino.
          </p>
          <Button size="sm" onClick={() => window.print()}>
            Salvar em PDF
          </Button>
        </div>
      </div>

      <header className="border-b border-border pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Método Criadora Blessing · Relatório de evolução
        </p>
        <h1 className="mt-2 font-serif text-3xl">{influencer.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {[influencer.instagram_handle ? `@${influencer.instagram_handle}` : null, local || null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Acompanhamento: {active?.name ?? "—"}
          {profile?.full_name ? ` · ${profile.full_name}` : ""} · Gerado em{" "}
          {dataBR(new Date().toISOString())}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-4 break-inside-avoid">
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Nível</p>
          <p className="mt-1 font-medium">{evaluation.progress.level}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Índice de progresso</p>
          <p className="mt-1 font-serif text-2xl">{evaluation.progress.score}%</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Requisitos da análise</p>
          <p className="mt-1 font-medium">
            {cumpridos} de {evaluation.requirements.length} cumpridos
          </p>
          <p className="text-xs text-muted-foreground">{QUALIFICATION_LABELS[evaluation.status]}</p>
        </div>
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="font-serif text-xl">Números</h2>
        {primeiro && ultimo ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {snapshots.length > 1
              ? `De ${dataBR(primeiro.capturedAt)} a ${dataBR(ultimo.capturedAt)}, em ${snapshots.length} registros.`
              : `Um registro, em ${dataBR(primeiro.capturedAt)}. A variação aparece a partir do segundo.`}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Ainda não há números registrados.</p>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-normal">Indicador</th>
                <th className="py-2 pr-4 font-normal">Início</th>
                <th className="py-2 pr-4 font-normal">Agora</th>
                <th className="py-2 font-normal">Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ rotulo, v, casas, sufixo }) => (
                <tr key={rotulo} className="border-t border-border/60">
                  <td className="py-2 pr-4">{rotulo}</td>
                  <td className="py-2 pr-4">
                    {formatarNumero(v.inicio, casas)}
                    {v.inicio !== null ? sufixo : ""}
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {formatarNumero(v.atual, casas)}
                    {v.atual !== null ? sufixo : ""}
                  </td>
                  <td className="py-2">
                    {formatarDiferenca(v.diferenca, casas)}
                    {v.diferenca !== null && v.diferenca !== 0 && sufixo ? " p.p." : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {grafico.length > 1 ? (
          <div className="mt-5">
            <p className="text-xs text-muted-foreground">Seguidores ao longo do acompanhamento</p>
            <div className="mt-2 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={grafico} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={52} allowDecimals={false} />
                  <Tooltip />
                  {/* Sem animação: a impressão captura a linha já desenhada. */}
                  <Line
                    type="monotone"
                    dataKey="seguidores"
                    name="Seguidores"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="font-serif text-xl">Requisitos da análise</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {evaluation.requirements.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-2"
            >
              <span>
                {r.label}
                <span className="ml-2 text-xs text-muted-foreground">
                  atual: {r.currentValue ?? "sem dado"} · meta: {r.targetLabel}
                </span>
              </span>
              <span className={TOM[r.status] ?? ""}>{SITUACAO_REQUISITO[r.status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="font-serif text-xl">Tarefas concluídas</h2>
        {concluidas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma tarefa concluída ainda.</p>
        ) : (
          <ul className="mt-3 grid gap-1.5 text-sm">
            {concluidas.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t.completed_at ? dataBR(t.completed_at) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {abertas === 0
            ? "Nenhuma tarefa em aberto."
            : abertas === 1
              ? "1 tarefa em aberto."
              : `${abertas} tarefas em aberto.`}
        </p>
      </section>

      <footer className="mt-10 border-t border-border pt-3 text-xs text-muted-foreground">
        Os números vêm do acompanhamento da gestora — informados, conferidos por print ou lidos do
        Instagram. Os requisitos seguem critérios fixos; atendê-los não garante aprovação em
        programas de terceiros.
      </footer>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";

import { listPlans, listPublicManagers } from "@/lib/mcb/public.functions";
import { METHOD_STAGES, PILLARS } from "@/lib/mcb/labels";
import { Button } from "@/components/ui/button";

const landingQuery = queryOptions({
  queryKey: ["mcb", "landing"],
  queryFn: async () => {
    const [plans, managers] = await Promise.all([listPlans(), listPublicManagers()]);
    return { plans, managers };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MCB — Método Criadora Blessing | Plataforma para gestoras" },
      {
        name: "description",
        content:
          "Plataforma que organiza candidaturas, acompanha a evolução de cada criadora e audita os requisitos de qualificação com critérios claros e auditáveis.",
      },
      { property: "og:title", content: "MCB — Método Criadora Blessing" },
      {
        property: "og:description",
        content:
          "Do perfil pessoal à criadora pronta para análise: candidaturas, jornada guiada e qualificação determinística em um só lugar.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingQuery),
  component: Landing,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar a página agora. Atualize em alguns instantes.
      </p>
    </main>
  ),
});

function Landing() {
  const { data } = useSuspenseQuery(landingQuery);

  return (
    <div className="grain-overlay min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-serif text-2xl tracking-tight">MCB</span>
        <nav className="flex items-center gap-3 text-sm">
          <a className="hidden text-muted-foreground hover:text-foreground sm:block" href="#metodo">
            O método
          </a>
          <a className="hidden text-muted-foreground hover:text-foreground sm:block" href="#planos">
            Planos
          </a>
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </nav>
      </header>

      <section className="gradient-wine relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-20 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">Método Criadora Blessing</p>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
            Do perfil pessoal à criadora de conteúdo pronta para análise.
          </h1>
          <p className="mt-5 max-w-2xl text-base opacity-90">
            Uma plataforma para gestoras acompanharem candidatas com clareza: candidatura estruturada,
            jornada guiada em cinco etapas e auditoria dos requisitos com critérios explícitos — sem
            promessas de aprovação.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">Criar meu ambiente</Link>
            </Button>
            {data.managers[0] ? (
              <Button asChild size="lg" variant="outline">
                <Link to="/g/$slug" params={{ slug: data.managers[0].slug }}>
                  Ver página de candidatura
                </Link>
              </Button>
            ) : null}
          </div>
          <p className="mt-6 max-w-xl font-serif text-lg italic opacity-90">
            “Antes de ensinar você a vender uma marca, vamos ensinar você a construir a sua.”
          </p>
        </div>
      </section>

      <section id="metodo" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl">As cinco etapas da jornada</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cada candidata avança por etapas com tarefas concretas. Os pilares {PILLARS.join(", ")} orientam a
          produção de conteúdo em todas elas.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {METHOD_STAGES.map((stage, index) => (
            <article key={stage.key} className="glass rounded-xl border border-border/60 p-5">
              <span className="text-xs text-muted-foreground">Etapa {index + 1}</span>
              <h3 className="mt-2 font-serif text-xl">{stage.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          <div>
            <h3 className="font-serif text-2xl">Critérios claros</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Seguidores, publicações, recência, tipo de perfil e público feminino avaliados por regras fixas.
              Dado ausente nunca vira aprovação: fica como pendência.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-2xl">Evolução acompanhada</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Índice de progresso, histórico de métricas, tarefas por etapa e registro de cada mudança de status.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-2xl">Cada gestora no seu espaço</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Dados isolados por ambiente, página de candidatura própria e equipe com papéis definidos.
            </p>
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl">Planos</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha o limite de candidatas e de pessoas na equipe. A cobrança online entra em uma próxima etapa.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {data.plans.map((plan) => (
            <article key={plan.id} className="glass flex flex-col rounded-xl border border-border/60 p-6">
              <h3 className="font-serif text-2xl">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-4 font-serif text-3xl">
                {plan.price_cents === 0
                  ? "Gratuito"
                  : `R$ ${(plan.price_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                {plan.price_cents > 0 ? <span className="text-sm text-muted-foreground">/mês</span> : null}
              </p>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                <li>Até {plan.max_candidates} candidatas</li>
                <li>Até {plan.max_members} pessoas na equipe</li>
                <li>{plan.max_ai_analyses} análises assistidas por mês</li>
                <li>{plan.custom_branding ? "Página personalizada" : "Página padrão"}</li>
              </ul>
              <Button asChild className="mt-6">
                <Link to="/auth">Começar</Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      {data.managers.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="font-serif text-2xl">Páginas de candidatura</h2>
          <ul className="mt-4 flex flex-wrap gap-3 text-sm">
            {data.managers.map((manager) => (
              <li key={manager.slug}>
                <Link
                  to="/g/$slug"
                  params={{ slug: manager.slug }}
                  className="rounded-full border border-border px-4 py-2 hover:bg-accent"
                >
                  {manager.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t border-border/60 px-6 py-10 text-center text-xs text-muted-foreground">
        <p>
          MCB — Método Criadora Blessing. Plataforma independente de formação e organização de candidaturas.
          Não garantimos aprovação em nenhum programa de terceiros.
        </p>
      </footer>
    </div>
  );
}

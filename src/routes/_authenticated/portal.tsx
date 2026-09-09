import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getPortal, setPortalTaskStatus, type PortalApplication } from "@/lib/mcb/portal.functions";
import { STATUS_LABELS, type InfluencerStatus } from "@/lib/mcb/labels";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "Seu acompanhamento — MCB" },
      { name: "description", content: "Suas tarefas e sua evolução no Método Criadora Blessing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Portal,
});

const PRIORITY_LABEL: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

/**
 * Shell próprio, não o AppShell da gestora: aquele depende de `useWorkspace`, que
 * assume membresia num ambiente. A candidata não é membro de nenhum — é justamente o
 * que impede que ela veja os dados das outras.
 */
function PortalShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grain-overlay min-h-screen">
        <header className="glass border-b border-border/60 px-5 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <Link to="/" className="font-serif text-2xl tracking-tight">
              MCB
            </Link>
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-4"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              Sair
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-5 py-8">{children}</main>
      </div>
    </div>
  );
}

function Application({
  application,
  onToggleTask,
  busy,
}: {
  application: PortalApplication;
  onToggleTask: (taskId: string, status: "PENDENTE" | "CONCLUIDA") => void;
  busy: boolean;
}) {
  const open = application.tarefas.filter((task) => task.status !== "CONCLUIDA");
  const done = application.tarefas.filter((task) => task.status === "CONCLUIDA");
  const evolucao = [...application.evolucao].reverse();

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">{application.gestora}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {STATUS_LABELS[application.status as InfluencerStatus] ?? application.status} ·{" "}
            {application.nivel}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs">
          {Math.round(Number(application.progresso))}% de progresso
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Suas tarefas</h3>
        {application.tarefas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma tarefa por enquanto. Sua gestora cria as tarefas conforme o acompanhamento
            avança.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {[...open, ...done].map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p
                    className={
                      task.status === "CONCLUIDA" ? "text-muted-foreground line-through" : undefined
                    }
                  >
                    {task.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prioridade {PRIORITY_LABEL[task.prioridade] ?? task.prioridade}
                    {task.prazo ? ` · até ${new Date(task.prazo).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    onToggleTask(task.id, task.status === "CONCLUIDA" ? "PENDENTE" : "CONCLUIDA")
                  }
                >
                  {task.status === "CONCLUIDA" ? "Reabrir" : "Concluir"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Sua evolução</h3>
        {evolucao.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ainda não há registros. Os números aparecem aqui conforme sua gestora os atualiza.
          </p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {evolucao.map((snapshot, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-2">
                <span>
                  {snapshot.seguidores ?? "—"} seguidores · {snapshot.publicacoes ?? "—"}{" "}
                  publicações
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(snapshot.data).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {application.feedbacks.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Feedback da sua gestora
          </h3>
          <ul className="mt-2 grid gap-3 text-sm">
            {application.feedbacks.map((feedback, index) => (
              <li key={index} className="rounded-lg border border-border/60 p-3">
                <p>{feedback.texto}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(feedback.data).toLocaleDateString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Portal() {
  const queryClient = useQueryClient();
  const fetchPortal = useServerFn(getPortal);
  const saveTaskStatus = useServerFn(setPortalTaskStatus);

  const queryKey = ["mcb", "portal"];

  const query = useQuery({ queryKey, queryFn: () => fetchPortal() });

  const taskMutation = useMutation({
    mutationFn: (input: { taskId: string; status: "PENDENTE" | "CONCLUIDA" }) =>
      saveTaskStatus({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível atualizar a tarefa."),
  });

  const applications = query.data?.applications ?? [];

  return (
    <PortalShell>
      <h1 className="font-serif text-3xl tracking-tight">Seu acompanhamento</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suas tarefas e sua evolução no Método Criadora Blessing.
      </p>

      {query.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando...</p>
      ) : applications.length === 0 ? (
        <div className="glass mt-8 rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Nenhuma candidatura encontrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua candidatura é localizada pelo e-mail. Duas coisas costumam explicar isso:
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li>
              — Você entrou com um e-mail diferente do que usou ao se candidatar. Saia e entre com
              aquele e-mail.
            </li>
            <li>
              — Você ainda não confirmou seu e-mail. Procure a mensagem de confirmação que enviamos.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Se nenhuma das duas for o caso, fale com sua gestora.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          {applications.map((application) => (
            <Application
              key={application.id}
              application={application}
              busy={taskMutation.isPending}
              onToggleTask={(taskId, status) => taskMutation.mutate({ taskId, status })}
            />
          ))}
        </div>
      )}
    </PortalShell>
  );
}

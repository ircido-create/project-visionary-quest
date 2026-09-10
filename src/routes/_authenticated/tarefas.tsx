import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/mcb/AppShell";
import { BotaoExportar } from "@/components/mcb/BotaoExportar";
import { exportarTarefas } from "@/lib/mcb/export.functions";
import { createTask, listTasks, setTaskStatus } from "@/lib/mcb/app.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — MCB" },
      { name: "description", content: "Tarefas do acompanhamento por candidata e por etapa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const { tenantId, readOnly } = useWorkspace();
  const exportar = useServerFn(exportarTarefas);
  const queryClient = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const saveTask = useServerFn(createTask);
  const toggle = useServerFn(setTaskStatus);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<"abertas" | "todas">("abertas");

  const query = useQuery({
    queryKey: ["mcb", "tasks", tenantId],
    queryFn: () => fetchTasks({ data: { tenantId: tenantId! } }),
    enabled: Boolean(tenantId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["mcb", "tasks", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "dashboard", tenantId] });
  };

  const guard = () => {
    if (readOnly) {
      toast.error("Ambiente de demonstração: as alterações não são salvas.");
      return false;
    }
    return true;
  };

  const createMutation = useMutation({
    mutationFn: () =>
      saveTask({
        data: {
          tenantId: tenantId!,
          influencerId: null,
          title,
          dueDate: dueDate || null,
          priority: "MEDIA",
        },
      }),
    onSuccess: () => {
      setTitle("");
      setDueDate("");
      toast.success("Tarefa criada.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível criar a tarefa."),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { taskId: string; status: "PENDENTE" | "CONCLUIDA" }) =>
      toggle({ data: { tenantId: tenantId!, ...input } }),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível atualizar a tarefa."),
  });

  const today = new Date().toISOString().slice(0, 10);
  const tasks = (query.data ?? []).filter((task) => filter === "todas" || task.status !== "CONCLUIDA");

  return (
    <AppShell
      title="Tarefas"
      description="O que precisa acontecer para cada candidata avançar de etapa."
      actions={
        <BotaoExportar
          rotulo="Exportar (CSV)"
          desabilitado={!tenantId}
          buscar={() => exportar({ data: { tenantId: tenantId! } })}
        />
      }
    >
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!guard()) return;
          createMutation.mutate();
        }}
      >
        <Input
          aria-label="Título da nova tarefa"
          className="max-w-sm"
          placeholder="Nova tarefa do ambiente"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
        />
        <Input
          className="max-w-[180px]"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          Adicionar
        </Button>
        <div className="ml-auto flex rounded-md border border-border p-1 text-sm">
          {(["abertas", "todas"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded px-3 py-1 capitalize ${filter === option ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </form>

      {query.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando tarefas...</p>
      ) : tasks.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhuma tarefa por aqui.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="glass flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-4 text-sm"
            >
              <input
                type="checkbox"
                aria-label={`Concluir tarefa: ${task.title}`}
                checked={task.status === "CONCLUIDA"}
                onChange={(event) => {
                  if (!guard()) return;
                  toggleMutation.mutate({
                    taskId: task.id,
                    status: event.target.checked ? "CONCLUIDA" : "PENDENTE",
                  });
                }}
              />
              <span className={task.status === "CONCLUIDA" ? "text-muted-foreground line-through" : ""}>
                {task.title}
              </span>
              {task.influencer_id && task.influencerName ? (
                <Link
                  to="/candidatas/$id"
                  params={{ id: task.influencer_id }}
                  className="text-xs text-muted-foreground underline underline-offset-4"
                >
                  {task.influencerName}
                </Link>
              ) : null}
              <span
                className={`ml-auto text-xs ${
                  task.due_date && task.due_date < today && task.status !== "CONCLUIDA"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {task.due_date ?? "sem prazo"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

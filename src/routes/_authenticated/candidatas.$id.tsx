import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/mcb/AppShell";
import { AnalysisSection } from "@/components/mcb/AnalysisSection";
import { EvidenceSection } from "@/components/mcb/EvidenceSection";
import {
  addNote,
  changeInfluencerStatus,
  createTask,
  getInfluencer,
  setTaskStatus,
  updateInfluencerMetrics,
  updateInfluencerProfile,
} from "@/lib/mcb/app.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { STATUS_LABELS, STATUS_ORDER, type InfluencerStatus } from "@/lib/mcb/labels";
import { QUALIFICATION_LABELS } from "@/lib/mcb/qualification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/candidatas/$id")({
  head: () => ({
    meta: [
      { title: "Perfil da candidata — MCB" },
      { name: "description", content: "Requisitos, evolução, tarefas e histórico da candidata." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidateDetail,
});

const REQUIREMENT_TONE: Record<string, string> = {
  PASS: "text-primary",
  FAIL: "text-destructive",
  UNKNOWN: "text-muted-foreground",
  REVIEW: "text-muted-foreground",
};

function CandidateDetail() {
  const { id } = Route.useParams();
  const { tenantId, readOnly } = useWorkspace();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(getInfluencer);
  const saveMetrics = useServerFn(updateInfluencerMetrics);
  const saveProfileData = useServerFn(updateInfluencerProfile);
  const saveStatus = useServerFn(changeInfluencerStatus);
  const saveNote = useServerFn(addNote);
  const saveTask = useServerFn(createTask);
  const toggleTask = useServerFn(setTaskStatus);

  const query = useQuery({
    queryKey: ["mcb", "influencer", tenantId, id],
    queryFn: () => fetchDetail({ data: { tenantId: tenantId!, influencerId: id } }),
    enabled: Boolean(tenantId),
  });

  const detail = query.data;
  const [metrics, setMetrics] = useState({
    followers: "",
    postsCount: "",
    femaleAudiencePct: "",
    recentPosts6m: "NAO_SEI" as "SIM" | "NAO" | "NAO_SEI",
    profileType: "NAO_SEI" as "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI",
    source: "MANUAL" as "MANUAL" | "SCREENSHOT" | "META_API" | "INTERNAL",
  });
  const [noteBody, setNoteBody] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", priority: "MEDIA" as "BAIXA" | "MEDIA" | "ALTA" });
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    whatsapp: "",
    city: "",
    state: "",
    instagramHandle: "",
    profileType: "NAO_SEI" as "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI",
    storiesFrequency: "",
    reelsFrequency: "",
    topics: "",
    profileGoal: "",
    mainDifficulty: "",
  });

  useEffect(() => {
    if (!detail) return;
    setMetrics({
      followers: detail.influencer.followers?.toString() ?? "",
      postsCount: detail.influencer.posts_count?.toString() ?? "",
      femaleAudiencePct: detail.influencer.female_audience_pct?.toString() ?? "",
      recentPosts6m: detail.influencer.recent_posts_6m ?? "NAO_SEI",
      profileType: detail.influencer.profile_type ?? "NAO_SEI",
      source: detail.influencer.data_source,
    });
    setProfileForm({
      fullName: detail.influencer.full_name ?? "",
      email: detail.influencer.email ?? "",
      whatsapp: detail.influencer.whatsapp ?? "",
      city: detail.influencer.city ?? "",
      state: detail.influencer.state ?? "",
      instagramHandle: detail.influencer.instagram_handle ?? "",
      profileType: detail.influencer.profile_type ?? "NAO_SEI",
      storiesFrequency: detail.influencer.stories_frequency ?? "",
      reelsFrequency: detail.influencer.reels_frequency ?? "",
      topics: detail.influencer.topics ?? "",
      profileGoal: detail.influencer.profile_goal ?? "",
      mainDifficulty: detail.influencer.main_difficulty ?? "",
    });
  }, [detail]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["mcb", "influencer", tenantId, id] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "dashboard", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["mcb", "influencers", tenantId] });
    // Duas mutações desta página mexem em tarefas. Sem esta linha, a página Tarefas
    // ficava com o dado velho — hoje isso não aparece porque o staleTime era 0 e tudo
    // se corrigia na navegação seguinte.
    queryClient.invalidateQueries({ queryKey: ["mcb", "tasks", tenantId] });
  };

  const guard = () => {
    if (readOnly) {
      toast.error("Ambiente de demonstração: as alterações não são salvas.");
      return false;
    }
    return true;
  };

  const metricsMutation = useMutation({
    mutationFn: () =>
      saveMetrics({
        data: {
          tenantId: tenantId!,
          influencerId: id,
          followers: metrics.followers === "" ? null : Number(metrics.followers),
          postsCount: metrics.postsCount === "" ? null : Number(metrics.postsCount),
          femaleAudiencePct: metrics.femaleAudiencePct === "" ? null : Number(metrics.femaleAudiencePct),
          recentPosts6m: metrics.recentPosts6m,
          profileType: metrics.profileType,
          source: metrics.source,
        },
      }),
    onSuccess: () => {
      toast.success("Métricas atualizadas e qualificação recalculada.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível salvar as métricas."),
  });

  const profileMutation = useMutation({
    mutationFn: () => saveProfileData({ data: { tenantId: tenantId!, influencerId: id, ...profileForm } }),
    onSuccess: () => {
      toast.success("Dados da candidata atualizados.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível salvar os dados."),
  });


  const statusMutation = useMutation({
    mutationFn: (status: InfluencerStatus) =>
      saveStatus({ data: { tenantId: tenantId!, influencerId: id, status } }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível alterar o status."),
  });

  const noteMutation = useMutation({
    mutationFn: (input: { body: string; kind: "note" | "feedback" }) =>
      saveNote({ data: { tenantId: tenantId!, influencerId: id, ...input } }),
    onSuccess: () => {
      setNoteBody("");
      setFeedbackBody("");
      toast.success("Registro salvo.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível salvar o registro."),
  });

  const taskMutation = useMutation({
    mutationFn: () =>
      saveTask({
        data: {
          tenantId: tenantId!,
          influencerId: id,
          title: taskForm.title,
          dueDate: taskForm.dueDate || null,
          priority: taskForm.priority,
        },
      }),
    onSuccess: () => {
      setTaskForm({ title: "", dueDate: "", priority: "MEDIA" });
      toast.success("Tarefa criada.");
      invalidate();
    },
    onError: () => toast.error("Não foi possível criar a tarefa."),
  });

  const taskStatusMutation = useMutation({
    mutationFn: (input: { taskId: string; status: "PENDENTE" | "CONCLUIDA" }) =>
      toggleTask({ data: { tenantId: tenantId!, ...input } }),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível atualizar a tarefa."),
  });

  if (query.isLoading) {
    return (
      <AppShell title="Candidata">
        <p className="text-sm text-muted-foreground">Carregando perfil...</p>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell title="Candidata não encontrada">
        <p className="text-sm text-muted-foreground">
          Esta candidata não existe neste ambiente.{" "}
          <Link to="/candidatas" className="underline underline-offset-4">
            Voltar para a lista
          </Link>
        </p>
      </AppShell>
    );
  }

  const { influencer, evaluation } = detail;

  return (
    <AppShell
      title={influencer.full_name}
      description={`@${influencer.instagram_handle ?? "—"} · ${influencer.city ?? ""}${influencer.state ? `, ${influencer.state}` : ""}`}
      actions={
        <div className="flex items-center gap-2">
          <select
            aria-label="Status da candidata"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={influencer.status}
            onChange={(event) => {
              if (!guard()) return;
              statusMutation.mutate(event.target.value as InfluencerStatus);
            }}
          >
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl">Requisitos de qualificação</h2>
            <span className="rounded-full border border-border px-3 py-1 text-xs">
              {QUALIFICATION_LABELS[evaluation.status]} · regras {evaluation.ruleSetVersion}
            </span>
          </div>
          <ul className="mt-4 grid gap-3">
            {evaluation.requirements.map((requirement) => (
              <li key={requirement.key} className="rounded-lg border border-border/60 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{requirement.label}</span>
                  <span className={REQUIREMENT_TONE[requirement.status]}>
                    {requirement.status === "PASS"
                      ? "Atendido"
                      : requirement.status === "FAIL"
                        ? "Não atendido"
                        : "Aguardando dado"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atual: {requirement.currentValue ?? "sem dado"} · Meta: {requirement.targetLabel}
                  {requirement.gap ? ` · ${requirement.gap}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Origem: {requirement.source === "MANUAL" ? "informado manualmente" : requirement.source}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Estes critérios são fixos e auditáveis. Nenhuma análise assistida substitui a verificação humana, e
            atender aos requisitos não garante aprovação em programas de terceiros.
          </p>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Índice de progresso</h2>
          <p className="mt-2 font-serif text-4xl">{evaluation.progress.score}%</p>
          <p className="text-sm text-muted-foreground">{evaluation.progress.level}</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {evaluation.progress.breakdown.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2">
                <span className={item.score > 0 ? "" : "text-muted-foreground"}>{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.score}/{item.maxScore}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
          <h2 className="font-serif text-xl">Atualizar métricas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirme os números com print ou conferência no perfil antes de salvar.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              metricsMutation.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="followers">Seguidores</Label>
              <Input
                id="followers"
                type="number"
                min={0}
                value={metrics.followers}
                onChange={(e) => setMetrics((prev) => ({ ...prev, followers: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="posts">Publicações</Label>
              <Input
                id="posts"
                type="number"
                min={0}
                value={metrics.postsCount}
                onChange={(e) => setMetrics((prev) => ({ ...prev, postsCount: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="female">Público feminino (%)</Label>
              <Input
                id="female"
                type="number"
                min={0}
                max={100}
                value={metrics.femaleAudiencePct}
                onChange={(e) => setMetrics((prev) => ({ ...prev, femaleAudiencePct: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recency">12 últimas publicações nos 6 meses</Label>
              <select
                id="recency"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={metrics.recentPosts6m}
                onChange={(e) =>
                  setMetrics((prev) => ({ ...prev, recentPosts6m: e.target.value as typeof prev.recentPosts6m }))
                }
              >
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
                <option value="NAO_SEI">Sem informação</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profileType">Tipo de conta</Label>
              <select
                id="profileType"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={metrics.profileType}
                onChange={(e) =>
                  setMetrics((prev) => ({ ...prev, profileType: e.target.value as typeof prev.profileType }))
                }
              >
                <option value="CRIADOR">Criadora de conteúdo</option>
                <option value="PESSOAL">Pessoal</option>
                <option value="COMERCIAL">Comercial</option>
                <option value="NAO_SEI">Sem informação</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="source">Origem do dado</Label>
              <select
                id="source"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={metrics.source}
                onChange={(e) => setMetrics((prev) => ({ ...prev, source: e.target.value as typeof prev.source }))}
              >
                <option value="MANUAL">Informado manualmente</option>
                <option value="SCREENSHOT">Print confirmado</option>
                <option value="META_API">Integração oficial</option>
                <option value="INTERNAL">Registro interno</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={metricsMutation.isPending}>
                {metricsMutation.isPending ? "Salvando..." : "Salvar e recalcular"}
              </Button>
            </div>
          </form>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Editar dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrija o cadastro da candidata: contato, perfil e objetivos.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              profileMutation.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="pf-name">Nome completo</Label>
              <Input
                id="pf-name"
                value={profileForm.fullName}
                minLength={3}
                required
                onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-email">E-mail</Label>
              <Input
                id="pf-email"
                type="email"
                required
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-whatsapp">WhatsApp</Label>
              <Input
                id="pf-whatsapp"
                value={profileForm.whatsapp}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-instagram">@ do Instagram</Label>
              <Input
                id="pf-instagram"
                value={profileForm.instagramHandle}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, instagramHandle: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-city">Cidade</Label>
              <Input
                id="pf-city"
                value={profileForm.city}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-state">Estado</Label>
              <Input
                id="pf-state"
                value={profileForm.state}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, state: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-type">Tipo de conta</Label>
              <select
                id="pf-type"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={profileForm.profileType}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, profileType: e.target.value as typeof prev.profileType }))
                }
              >
                <option value="CRIADOR">Criadora de conteúdo</option>
                <option value="PESSOAL">Pessoal</option>
                <option value="COMERCIAL">Comercial</option>
                <option value="NAO_SEI">Sem informação</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-stories">Frequência de stories</Label>
              <Input
                id="pf-stories"
                value={profileForm.storiesFrequency}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, storiesFrequency: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-reels">Frequência de reels</Label>
              <Input
                id="pf-reels"
                value={profileForm.reelsFrequency}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, reelsFrequency: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-topics">Temas</Label>
              <Input
                id="pf-topics"
                value={profileForm.topics}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, topics: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="pf-goal">Objetivo com o perfil</Label>
              <Textarea
                id="pf-goal"
                rows={2}
                value={profileForm.profileGoal}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, profileGoal: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="pf-difficulty">Maior dificuldade</Label>
              <Textarea
                id="pf-difficulty"
                rows={2}
                value={profileForm.mainDifficulty}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, mainDifficulty: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>
          </form>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Evolução</h2>
          {detail.snapshots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sem histórico de métricas ainda.</p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {detail.snapshots.map((snapshot, index) => (
                <li key={`${snapshot.capturedAt}-${index}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {new Date(snapshot.capturedAt).toLocaleDateString("pt-BR")}
                  </span>
                  <span>
                    {snapshot.followers ?? "—"} seg. · {snapshot.posts ?? "—"} posts ·{" "}
                    {snapshot.female === null ? "—" : `${snapshot.female}%`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Tarefas</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              taskMutation.mutate();
            }}
          >
            <Input
              aria-label="Título da nova tarefa"
              placeholder="Nova tarefa"
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              required
              minLength={3}
            />
            <div className="flex gap-2">
              <Input
                aria-label="Prazo da tarefa"
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
              <select
                aria-label="Prioridade da tarefa"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm((prev) => ({ ...prev, priority: e.target.value as typeof prev.priority }))
                }
              >
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>
            <Button type="submit" variant="outline" disabled={taskMutation.isPending}>
              Adicionar tarefa
            </Button>
          </form>
          <ul className="mt-4 grid gap-2 text-sm">
            {detail.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`Concluir tarefa: ${task.title}`}
                  checked={task.status === "CONCLUIDA"}
                  onChange={(event) => {
                    if (!guard()) return;
                    taskStatusMutation.mutate({
                      taskId: task.id,
                      status: event.target.checked ? "CONCLUIDA" : "PENDENTE",
                    });
                  }}
                />
                <span className={task.status === "CONCLUIDA" ? "text-muted-foreground line-through" : ""}>
                  {task.title}
                  {task.due_date ? (
                    <span className="ml-1 text-xs text-muted-foreground">({task.due_date})</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Notas internas</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              noteMutation.mutate({ body: noteBody, kind: "note" });
            }}
          >
            <Textarea rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} required minLength={3} />
            <Button type="submit" variant="outline" disabled={noteMutation.isPending}>
              Salvar nota
            </Button>
          </form>
          <ul className="mt-4 grid gap-3 text-sm">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-border/60 p-3">
                <p>{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Feedback para a candidata</h2>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              noteMutation.mutate({ body: feedbackBody, kind: "feedback" });
            }}
          >
            <Textarea
              rows={3}
              value={feedbackBody}
              onChange={(e) => setFeedbackBody(e.target.value)}
              required
              minLength={3}
            />
            <Button type="submit" variant="outline" disabled={noteMutation.isPending}>
              Salvar feedback
            </Button>
          </form>
          <ul className="mt-4 grid gap-3 text-sm">
            {detail.feedbacks.map((feedback) => (
              <li key={feedback.id} className="rounded-lg border border-border/60 p-3">
                <p>{feedback.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(feedback.created_at).toLocaleString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <EvidenceSection tenantId={tenantId!} influencerId={id} readOnly={readOnly} />

        <AnalysisSection tenantId={tenantId!} influencerId={id} readOnly={readOnly} />

        <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-3">
          <h2 className="font-serif text-xl">Histórico de status</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {detail.history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {entry.from_status ? `${STATUS_LABELS[entry.from_status]} → ` : ""}
                  {STATUS_LABELS[entry.to_status]}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

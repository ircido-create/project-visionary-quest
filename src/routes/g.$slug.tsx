import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getManagerPage, submitApplication, type ApplicationInput } from "@/lib/mcb/public.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { METHOD_STAGES } from "@/lib/mcb/labels";

export const Route = createFileRoute("/g/$slug")({
  loader: async ({ params }) => {
    const page = await getManagerPage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Página indisponível — MCB" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Candidatura — ${loaderData.branding?.managerName ?? loaderData.tenant.name} | MCB`;
    const description =
      loaderData.branding?.subheadline ??
      "Preencha a candidatura e receba um diagnóstico do seu perfil com base em critérios claros.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ManagerLanding,
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-serif text-2xl">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira o link com a gestora que te convidou.</p>
        <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-4">
          Voltar ao início
        </Link>
      </div>
    </main>
  ),
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">Não foi possível carregar a página agora.</p>
    </main>
  ),
});

type FormState = Omit<ApplicationInput, "slug" | "consent"> & { consent: boolean };

const initialState: FormState = {
  fullName: "",
  email: "",
  whatsapp: "",
  city: "",
  state: "",
  instagramHandle: "",
  instagramUrl: "",
  followers: null,
  postsCount: null,
  recentPosts6m: "NAO_SEI",
  femaleAudiencePct: null,
  profileType: "NAO_SEI",
  storiesFrequency: "Algumas vezes por semana",
  reelsFrequency: "Às vezes",
  topics: "",
  askedAbout: "",
  profileGoal: "",
  mainDifficulty: "",
  dailyTime: "30 a 60 minutos",
  instagramGoal: "",
  consent: false,
};

function ManagerLanding() {
  const page = Route.useLoaderData();
  const params = Route.useParams();
  const send = useServerFn(submitApplication);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const handle = form.instagramHandle.trim().replace(/^@/, "");
      return send({
        data: {
          ...form,
          slug: params.slug,
          instagramHandle: handle,
          instagramUrl: form.instagramUrl.trim() || `https://instagram.com/${handle}`,
          consent: true,
        } as ApplicationInput,
      });
    },
    onError: () =>
      setError("Não foi possível enviar sua candidatura. Revise os campos obrigatórios e tente novamente."),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const numberValue = (value: string) => (value.trim() === "" ? null : Number(value));

  if (mutation.data?.ok) {
    return (
      <main className="grain-overlay flex min-h-screen items-center justify-center bg-background px-6 py-16">
        <div className="glass max-w-xl rounded-2xl border border-border/60 p-8 text-center">
          <h1 className="font-serif text-3xl">Candidatura recebida</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mutation.data.duplicated
              ? "Já tínhamos uma candidatura com este e-mail. A gestora vai retomar o seu acompanhamento."
              : `${page.branding?.managerName ?? page.tenant.name} vai analisar o seu perfil e retornar com o próximo passo da jornada.`}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Esta candidatura não garante aprovação em nenhum programa. O foco é preparar o seu perfil com
            critérios claros.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm underline underline-offset-4">
            Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="grain-overlay min-h-screen bg-background text-foreground">
      <section className="gradient-wine">
        <div className="mx-auto max-w-4xl px-6 py-16 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">
            {page.branding?.managerName ?? page.tenant.name}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight">
            {page.branding?.headline ?? "Do perfil pessoal à criadora de conteúdo pronta para análise."}
          </h1>
          <p className="mt-4 max-w-2xl text-sm opacity-90">
            {page.branding?.subheadline ??
              "Uma jornada prática para estruturar seu perfil, criar presença e alcançar os requisitos com autenticidade."}
          </p>
          {page.branding?.authorityQuote ? (
            <p className="mt-6 font-serif text-lg italic opacity-90">“{page.branding.authorityQuote}”</p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid gap-4 md:grid-cols-5">
          {METHOD_STAGES.map((stage, index) => (
            <div key={stage.key} className="rounded-xl border border-border/60 p-4">
              <span className="text-xs text-muted-foreground">Etapa {index + 1}</span>
              <h2 className="mt-1 font-serif text-lg">{stage.title}</h2>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="glass rounded-2xl border border-border/60 p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Porta de entrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Responda com sinceridade. Se não souber um número agora, deixe em branco — vamos tratar como
            pendência, e não como falha.
          </p>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (!form.consent) {
                setError("É necessário autorizar o uso dos seus dados para o acompanhamento.");
                return;
              }
              mutation.mutate();
            }}
          >
            <Field label="Nome completo" required>
              <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required minLength={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail" required>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label="WhatsApp" required>
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} required minLength={8} />
              </Field>
              <Field label="Cidade" required>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} required minLength={2} />
              </Field>
              <Field label="Estado" required>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} required minLength={2} />
              </Field>
              <Field label="@ do Instagram" required>
                <Input
                  value={form.instagramHandle}
                  onChange={(e) => set("instagramHandle", e.target.value)}
                  placeholder="seuperfil"
                  required
                />
              </Field>
              <Field label="Link do perfil">
                <Input
                  value={form.instagramUrl}
                  onChange={(e) => set("instagramUrl", e.target.value)}
                  placeholder="https://instagram.com/seuperfil"
                />
              </Field>
              <Field label="Seguidores">
                <Input
                  type="number"
                  min={0}
                  value={form.followers ?? ""}
                  onChange={(e) => set("followers", numberValue(e.target.value))}
                />
              </Field>
              <Field label="Publicações no feed">
                <Input
                  type="number"
                  min={0}
                  value={form.postsCount ?? ""}
                  onChange={(e) => set("postsCount", numberValue(e.target.value))}
                />
              </Field>
              <Field label="Público feminino (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.femaleAudiencePct ?? ""}
                  onChange={(e) => set("femaleAudiencePct", numberValue(e.target.value))}
                />
              </Field>
              <Field label="As 12 últimas publicações são dos últimos 6 meses?">
                <Choice
                  value={form.recentPosts6m}
                  onChange={(value) => set("recentPosts6m", value as FormState["recentPosts6m"])}
                  options={[
                    ["SIM", "Sim"],
                    ["NAO", "Não"],
                    ["NAO_SEI", "Não sei"],
                  ]}
                />
              </Field>
              <Field label="Tipo de conta no Instagram">
                <Choice
                  value={form.profileType}
                  onChange={(value) => set("profileType", value as FormState["profileType"])}
                  options={[
                    ["PESSOAL", "Pessoal"],
                    ["CRIADOR", "Criadora de conteúdo"],
                    ["COMERCIAL", "Comercial"],
                    ["NAO_SEI", "Não sei"],
                  ]}
                />
              </Field>
              <Field label="Com que frequência você faz stories?">
                <Choice
                  value={form.storiesFrequency}
                  onChange={(value) => set("storiesFrequency", value)}
                  options={[
                    ["Todos os dias", "Todos os dias"],
                    ["Algumas vezes por semana", "Algumas vezes por semana"],
                    ["Raramente", "Raramente"],
                    ["Nunca", "Nunca"],
                  ]}
                />
              </Field>
              <Field label="Você grava Reels?">
                <Choice
                  value={form.reelsFrequency}
                  onChange={(value) => set("reelsFrequency", value)}
                  options={[
                    ["Frequentemente", "Frequentemente"],
                    ["Às vezes", "Às vezes"],
                    ["Nunca", "Nunca"],
                  ]}
                />
              </Field>
              <Field label="Quanto tempo por dia você tem para o Instagram?">
                <Choice
                  value={form.dailyTime}
                  onChange={(value) => set("dailyTime", value)}
                  options={[
                    ["Menos de 30 minutos", "Menos de 30 minutos"],
                    ["30 a 60 minutos", "30 a 60 minutos"],
                    ["1 a 2 horas", "1 a 2 horas"],
                    ["Mais de 2 horas", "Mais de 2 horas"],
                  ]}
                />
              </Field>
            </div>

            <Field label="Sobre o que você mais gosta de falar?">
              <Textarea value={form.topics} onChange={(e) => set("topics", e.target.value)} rows={3} />
            </Field>
            <Field label="O que as pessoas mais te perguntam?">
              <Textarea value={form.askedAbout} onChange={(e) => set("askedAbout", e.target.value)} rows={3} />
            </Field>
            <Field label="Hoje seu perfil é mais pessoal ou já fala com um público?">
              <Textarea value={form.profileGoal} onChange={(e) => set("profileGoal", e.target.value)} rows={3} />
            </Field>
            <Field label="Qual sua maior dificuldade ao aparecer?">
              <Textarea
                value={form.mainDifficulty}
                onChange={(e) => set("mainDifficulty", e.target.value)}
                rows={3}
              />
            </Field>
            <Field label="O que você quer alcançar com o Instagram?">
              <Textarea
                value={form.instagramGoal}
                onChange={(e) => set("instagramGoal", e.target.value)}
                rows={3}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-lg border border-border/60 p-4 text-sm">
              {/* A regra procura o rótulo dentro do próprio controle e não sobe até o
                  `<label>` que o envolve. O campo está rotulado pelo texto abaixo. */}
              {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
              <input
                type="checkbox"
                className="mt-1"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
              />
              <span className="text-muted-foreground">
                Autorizo o uso dos meus dados para análise do meu perfil e acompanhamento na jornada do Método
                Criadora Blessing. Posso pedir a exclusão a qualquer momento.
              </span>
            </label>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? "Enviando..." : "Enviar candidatura"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O envio não garante aprovação em nenhum programa de terceiros.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Choice({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

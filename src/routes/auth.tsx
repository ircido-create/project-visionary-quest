import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import "@lovable.dev/cloud-auth-js/styles.css";

import { supabase } from "@/integrations/supabase/client";
import { resolveLanding } from "@/lib/mcb/portal.functions";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — MCB Método Criadora Blessing" },
      { name: "description", content: "Acesse seu ambiente de gestora para acompanhar candidatas e a jornada." },
      { property: "og:title", content: "Entrar — MCB" },
      { property: "og:description", content: "Acesse seu ambiente de gestora no MCB." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const resolveDestination = useServerFn(resolveLanding);

  const syncLovableProfile = useCallback(async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    const user = data.user;
    if (userError || !user) return;

    const provider = user.app_metadata.provider;
    const providers = Array.isArray(user.app_metadata.providers) ? user.app_metadata.providers : [];
    if (provider !== "lovable" && !providers.includes("lovable")) return;

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("full_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const metadata = user.user_metadata;
    const metadataName =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : null;
    const metadataAvatar =
      typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : typeof metadata.picture === "string"
          ? metadata.picture
          : null;

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: metadataName || currentProfile?.full_name || null,
      email: user.email || currentProfile?.email || null,
      avatar_url: metadataAvatar || currentProfile?.avatar_url || null,
    });
  }, []);

  // Candidata vai para o portal, gestora para o painel. A decisão é do servidor: o
  // navegador não consegue consultar a candidatura, que fica atrás de RPC.
  const goToLanding = useCallback(async () => {
    await syncLovableProfile();
    const { to } = await resolveDestination();
    navigate({ to: to === "portal" ? "/portal" : "/dashboard" });
  }, [navigate, resolveDestination, syncLovableProfile]);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToLanding();
    });
  }, [goToLanding]);

  // O Supabase distingue os motivos da recusa por código. Repetir "e-mail ou senha
  // incorretos" para todos eles esconde justamente o caso mais comum aqui: conta criada
  // pelo Google, que não tem senha para digitar.
  function describeAuthError(cause: unknown): string {
    const code = (cause as { code?: string } | null)?.code;
    const text = cause instanceof Error ? cause.message.toLowerCase() : "";
    if (code === "email_not_confirmed" || text.includes("not confirmed")) {
      return "Seu e-mail ainda não foi confirmado. Procure a mensagem de confirmação que enviamos.";
    }
    if (code === "weak_password" || text.includes("weak")) {
      return "Essa senha é fácil de descobrir. Escolha outra, mais longa e única.";
    }
    if (code === "user_already_exists" || text.includes("already registered")) {
      return "Já existe uma conta com esse e-mail. Entre com sua senha ou use \"Esqueci minha senha\".";
    }
    if (code === "over_email_send_rate_limit" || text.includes("rate limit")) {
      return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
    }
    if (code === "invalid_credentials" || text.includes("invalid login")) {
      return "E-mail ou senha incorretos. Se você criou sua conta pelo Google, entre pelo botão \"Continuar com Google\" — ou use \"Esqueci minha senha\" para definir uma senha.";
    }
    return "Não foi possível concluir. Verifique os dados e tente novamente.";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage(
          "Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também o spam.",
        );
      } else if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await goToLanding();
          return;
        }
        setMessage("Cadastro criado. Confirme o e-mail que enviamos para acessar sua conta.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await goToLanding();
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  }


  async function handleSocial(provider: "google" | "lovable") {
    setError(null);

    // O endpoint de OAuth (/~oauth/initiate) é servido pela infraestrutura do
    // Lovable, não pelo app. Rodando localmente ele não existe, e o redirecionamento
    // levava a candidata a uma tela 404 sem explicação nenhuma. A checagem abaixo
    // troca o beco sem saída por uma instrução. Se ela falhar por qualquer motivo,
    // o fluxo segue normal em vez de bloquear quem conseguiria entrar.
    try {
      const probe = await fetch("/~oauth/initiate", { method: "HEAD", redirect: "manual" });
      if (probe.status === 404) {
        setError(
          `Entrar com ${provider === "lovable" ? "Lovable" : "Google"} só funciona no aplicativo publicado. Neste ambiente, use e-mail e senha.`,
        );
        return;
      }
    } catch {
      // Sem rede ou requisição bloqueada: não dá para concluir nada, então segue.
    }

    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(`Não foi possível entrar com ${provider === "lovable" ? "Lovable" : "Google"} agora.`);
      return;
    }
    if (result.redirected) return;
    await goToLanding();
  }

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl border border-border/60 p-8">
        <Link to="/" className="font-serif text-2xl">
          MCB
        </Link>
        <h1 className="mt-4 font-serif text-2xl">
          {mode === "signin"
            ? "Entrar no seu ambiente"
            : mode === "signup"
              ? "Criar sua conta de gestora"
              : "Recuperar o acesso"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "Informe seu e-mail e enviamos um link para você criar uma nova senha."
            : "Acompanhe candidaturas, evolução e qualificação em um só lugar."}
        </p>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            className="lovable-auth-button"
            onClick={() => void handleSocial("lovable")}
          >
            Continuar com Lovable
          </button>
          <Button type="button" variant="outline" className="w-full" onClick={() => void handleSocial("google")}>
            Continuar com Google
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode === "forgot" ? null : (
            <div className="grid gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <Button type="submit" disabled={busy}>
            {busy
              ? "Aguarde..."
              : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link"}
          </Button>
        </form>

        <div className="mt-5 grid gap-2 text-sm">
          <button
            type="button"
            className="justify-self-start text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "signup" ? "Já tenho conta" : "Ainda não tenho conta"}
          </button>
          <button
            type="button"
            className="justify-self-start text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => {
              setMode(mode === "forgot" ? "signin" : "forgot");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "forgot" ? "Voltar para entrar" : "Esqueci minha senha"}
          </button>
        </div>

      </div>
    </main>
  );
}

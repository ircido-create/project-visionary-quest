import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar nova senha — MCB" },
      { name: "description", content: "Defina uma nova senha para acessar seu ambiente no MCB." },
      { property: "og:title", content: "Criar nova senha — MCB" },
      { property: "og:description", content: "Defina uma nova senha para acessar seu ambiente no MCB." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // O link do e-mail chega com o token no endereço. O Supabase troca esse token por
  // uma sessão de recuperação de forma assíncrona, por isso esperamos o evento em vez
  // de olhar a sessão apenas uma vez.
  useEffect(() => {
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setHasSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    // Em uma sessão de recuperação não se envia a senha atual: quem chegou aqui pelo
    // link do e-mail justamente não a conhece.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      const code = (updateError as { code?: string }).code;
      if (code === "weak_password" || updateError.message.toLowerCase().includes("weak")) {
        setError(
          "Essa senha é fácil de descobrir e apareceu em vazamentos conhecidos. Escolha outra, mais longa e única.",
        );
      } else if (code === "same_password") {
        setError("A nova senha precisa ser diferente da anterior.");
      } else {
        setError("Não foi possível salvar a nova senha. Peça um novo link e tente de novo.");
      }
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1200);
  }

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl border border-border/60 p-8">
        <Link to="/" className="font-serif text-2xl">
          MCB
        </Link>
        <h1 className="mt-4 font-serif text-2xl">Criar nova senha</h1>

        {!ready ? (
          <p className="mt-3 text-sm text-muted-foreground">Verificando seu link...</p>
        ) : done ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Senha alterada. Levando você para o seu ambiente...
          </p>
        ) : !hasSession ? (
          <div className="mt-3 grid gap-4">
            <p className="text-sm text-muted-foreground">
              Este link não é mais válido — ele expira depois de algum tempo e só pode ser usado uma vez.
              Peça um novo na tela de entrada.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">Voltar para entrar</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="newPassword">Nova senha</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

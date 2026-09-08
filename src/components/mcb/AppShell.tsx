import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Visão geral" },
  { to: "/candidatas", label: "Candidatas" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/configuracoes", label: "Configurações" },
] as const;

export function AppShell({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const { tenants, active, setActive, profile, readOnly } = useWorkspace();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grain-overlay flex min-h-screen flex-col lg:flex-row">
        <aside className="glass border-b border-border/60 px-5 py-5 lg:w-72 lg:border-b-0 lg:border-r">
          <Link to="/" className="font-serif text-2xl tracking-tight">
            MCB
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Método Criadora Blessing
          </p>

          <div className="mt-6">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tenant-switch">
              Ambiente
            </label>
            <select
              id="tenant-switch"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={active?.id ?? ""}
              onChange={(event) => setActive(event.target.value)}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                  {tenant.readOnly ? " (demonstração)" : ""}
                </option>
              ))}
            </select>
          </div>

          <nav className="mt-6 flex flex-wrap gap-1 lg:flex-col">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <p className="truncate">{profile?.email ?? "Gestora"}</p>
            <button
              type="button"
              className="mt-2 underline underline-offset-4 hover:text-foreground"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              Sair
            </button>
          </div>
        </aside>

        <main className="flex-1 px-5 py-8 lg:px-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions}
          </header>

          {readOnly ? (
            <p className="mt-6 rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              Você está em um ambiente de demonstração: os dados são fictícios e as alterações não são salvas.
              Crie o seu próprio ambiente em Configurações.
            </p>
          ) : null}

          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <div className="glass rounded-xl border border-border/60 p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-serif text-3xl",
          tone === "positive" && "text-primary",
          tone === "warning" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

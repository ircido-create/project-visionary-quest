import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/mcb/AppShell";
import { createTenant, getSettings, inviteMember, updateBranding } from "@/lib/mcb/app.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — MCB" },
      { name: "description", content: "Ambiente, página pública, equipe e plano." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tenantId, tenants, readOnly, setActive, refetch } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const saveBranding = useServerFn(updateBranding);
  const saveTenant = useServerFn(createTenant);
  const sendInvite = useServerFn(inviteMember);

  const hasOwnTenant = tenants.some((tenant) => !tenant.readOnly);
  const [newTenant, setNewTenant] = useState({ name: "", managerName: "" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [branding, setBranding] = useState({
    managerName: "",
    headline: "",
    subheadline: "",
    authorityQuote: "",
    bio: "",
    instagramHandle: "",
    whatsapp: "",
  });

  const query = useQuery({
    queryKey: ["mcb", "settings", tenantId],
    queryFn: () => fetchSettings({ data: { tenantId: tenantId! } }),
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    const data = query.data?.branding;
    if (!data) return;
    setBranding({
      managerName: data.manager_name ?? "",
      headline: data.headline ?? "",
      subheadline: data.subheadline ?? "",
      authorityQuote: data.authority_quote ?? "",
      bio: data.bio ?? "",
      instagramHandle: data.instagram_handle ?? "",
      whatsapp: data.whatsapp ?? "",
    });
  }, [query.data]);

  const guard = () => {
    if (readOnly) {
      toast.error("Ambiente de demonstração: crie o seu ambiente para salvar alterações.");
      return false;
    }
    return true;
  };

  const brandingMutation = useMutation({
    mutationFn: () => saveBranding({ data: { tenantId: tenantId!, ...branding } }),
    onSuccess: () => {
      toast.success("Página atualizada.");
      queryClient.invalidateQueries({ queryKey: ["mcb", "settings", tenantId] });
    },
    onError: () => toast.error("Não foi possível salvar a página."),
  });

  const tenantMutation = useMutation({
    mutationFn: () =>
      saveTenant({ data: { name: newTenant.name, managerName: newTenant.managerName || newTenant.name } }),
    onSuccess: async (result) => {
      toast.success("Ambiente criado.");
      await refetch();
      setActive(result.id);
      setNewTenant({ name: "", managerName: "" });
    },
    onError: () => toast.error("Não foi possível criar o ambiente."),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      sendInvite({ data: { tenantId: tenantId!, email: inviteEmail, role: "manager_member" } }),
    onSuccess: () => {
      setInviteEmail("");
      toast.success("Convite registrado.");
      queryClient.invalidateQueries({ queryKey: ["mcb", "settings", tenantId] });
    },
    onError: () => toast.error("Não foi possível registrar o convite."),
  });

  const settings = query.data;
  const publicUrl = settings?.tenant ? `/g/${settings.tenant.slug}` : null;

  return (
    <AppShell title="Configurações" description="Seu ambiente, sua página de candidatura, sua equipe e seu plano.">
      <div className="grid gap-6 lg:grid-cols-2">
        {!hasOwnTenant ? (
          <section className="glass rounded-xl border border-border/60 p-6 lg:col-span-2">
            <h2 className="font-serif text-xl">Criar meu ambiente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Você está apenas visitando a demonstração. Crie seu próprio ambiente para receber candidaturas reais.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                tenantMutation.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="tenantName">Nome do ambiente</Label>
                <Input
                  id="tenantName"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  minLength={3}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="managerName">Seu nome como gestora</Label>
                <Input
                  id="managerName"
                  value={newTenant.managerName}
                  onChange={(e) => setNewTenant((prev) => ({ ...prev, managerName: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={tenantMutation.isPending}>
                  Criar ambiente
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="glass rounded-xl border border-border/60 p-6">
          <h2 className="font-serif text-xl">Página de candidatura</h2>
          {publicUrl ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Link público: <span className="font-medium">{publicUrl}</span>
            </p>
          ) : null}
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!guard()) return;
              brandingMutation.mutate();
            }}
          >
            <Field label="Seu nome">
              <Input
                value={branding.managerName}
                onChange={(e) => setBranding((prev) => ({ ...prev, managerName: e.target.value }))}
              />
            </Field>
            <Field label="Título principal">
              <Input
                value={branding.headline}
                onChange={(e) => setBranding((prev) => ({ ...prev, headline: e.target.value }))}
              />
            </Field>
            <Field label="Subtítulo">
              <Textarea
                rows={3}
                value={branding.subheadline}
                onChange={(e) => setBranding((prev) => ({ ...prev, subheadline: e.target.value }))}
              />
            </Field>
            <Field label="Frase de autoridade">
              <Input
                value={branding.authorityQuote}
                onChange={(e) => setBranding((prev) => ({ ...prev, authorityQuote: e.target.value }))}
              />
            </Field>
            <Field label="Sua bio">
              <Textarea
                rows={3}
                value={branding.bio}
                onChange={(e) => setBranding((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="@ do Instagram">
                <Input
                  value={branding.instagramHandle}
                  onChange={(e) => setBranding((prev) => ({ ...prev, instagramHandle: e.target.value }))}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={branding.whatsapp}
                  onChange={(e) => setBranding((prev) => ({ ...prev, whatsapp: e.target.value }))}
                />
              </Field>
            </div>
            <Button type="submit" disabled={brandingMutation.isPending}>
              Salvar página
            </Button>
          </form>
        </section>

        <div className="grid gap-6">
          <section className="glass rounded-xl border border-border/60 p-6">
            <h2 className="font-serif text-xl">Plano e uso</h2>
            {settings?.plan ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">{settings.plan.name}</p>
                <p className="text-muted-foreground">
                  {settings.usage.candidates} de {settings.plan.max_candidates} candidatas ·{" "}
                  {settings.usage.members} de {settings.plan.max_members} pessoas na equipe
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  A cobrança online entra em uma próxima etapa; os limites já são acompanhados aqui.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Sem plano atribuído a este ambiente.</p>
            )}
          </section>

          <section className="glass rounded-xl border border-border/60 p-6">
            <h2 className="font-serif text-xl">Equipe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings?.members.length ?? 0} pessoa(s) com acesso.
            </p>
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!guard()) return;
                inviteMutation.mutate();
              }}
            >
              <Input
                type="email"
                className="max-w-xs"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
              <Button type="submit" variant="outline" disabled={inviteMutation.isPending}>
                Convidar
              </Button>
            </form>
            {settings?.invitations.length ? (
              <ul className="mt-4 grid gap-2 text-sm">
                {settings.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex justify-between gap-2">
                    <span>{invitation.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {invitation.accepted_at ? "aceito" : "pendente"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="glass rounded-xl border border-border/60 p-6">
            <h2 className="font-serif text-xl">Privacidade</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cada candidatura registra o consentimento com data, finalidade e origem. Para excluir os dados de uma
              candidata, arquive o perfil e solicite a remoção definitiva pelo suporte.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

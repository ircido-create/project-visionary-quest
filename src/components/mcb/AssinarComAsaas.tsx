import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CICLOS } from "@/lib/mcb/asaas";
import { assinarPeloAsaas, situacaoDaCobranca } from "@/lib/mcb/asaas.functions";
import { useWorkspace } from "@/lib/mcb/useWorkspace";

/**
 * Assinatura pelo provedor de cobrança. A gestora informa quem paga, escolhe o ciclo e
 * abre o link: Pix, boleto ou cartão são escolhidos na página do Asaas. Dos meses
 * seguintes cuida o provedor, e o pagamento volta pelo webhook.
 */
export function AssinarComAsaas({ tenantId }: { tenantId: string }) {
  const { profile } = useWorkspace();
  const buscar = useServerFn(situacaoDaCobranca);
  const assinar = useServerFn(assinarPeloAsaas);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    nome: profile?.full_name ?? "",
    email: profile?.email ?? "",
    cpfCnpj: "",
    whatsapp: "",
    ciclo: "MONTHLY" as (typeof CICLOS)[number]["ciclo"],
  });
  const [link, setLink] = useState<string | null>(null);

  const situacao = useQuery({
    queryKey: ["mcb", "cobranca", tenantId],
    queryFn: () => buscar({ data: { tenantId } }),
  });

  const envio = useMutation({
    mutationFn: () =>
      assinar({
        data: {
          tenantId,
          nome: form.nome,
          email: form.email,
          cpfCnpj: form.cpfCnpj,
          whatsapp: form.whatsapp || null,
          ciclo: form.ciclo,
        },
      }),
    onSuccess: (resultado) => {
      setLink(resultado.link);
      if (resultado.link) {
        window.open(resultado.link, "_blank", "noopener,noreferrer");
        toast.success("Assinatura criada. A página de pagamento abriu em outra aba.");
      } else {
        toast.success("Assinatura criada. O Asaas vai enviar a cobrança por e-mail.");
      }
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível criar a assinatura."),
  });

  // Sem chave configurada não há o que oferecer, e um botão que só dá erro é pior que nada.
  if (!situacao.data?.disponivel) return null;

  return (
    <div className="mt-5 rounded-lg border border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {situacao.data.assinada ? "Cobrança automática ativa" : "Pagar automaticamente"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {situacao.data.assinada
              ? "A cobrança de cada período é gerada pelo provedor. O vencimento do ambiente é empurrado assim que o pagamento entra."
              : "Pix, boleto ou cartão, escolhidos na página de pagamento. Nos meses seguintes a cobrança vem sozinha."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : situacao.data.assinada ? "Trocar plano de cobrança" : "Assinar"}
        </Button>
      </div>

      {aberto ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            envio.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cobranca-nome">Nome de quem paga</Label>
            <Input
              id="cobranca-nome"
              required
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cobranca-email">E-mail para a cobrança</Label>
            <Input
              id="cobranca-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cobranca-documento">CPF ou CNPJ</Label>
            <Input
              id="cobranca-documento"
              required
              inputMode="numeric"
              placeholder="Só números"
              value={form.cpfCnpj}
              onChange={(e) => setForm((p) => ({ ...p, cpfCnpj: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cobranca-whatsapp">WhatsApp (opcional)</Label>
            <Input
              id="cobranca-whatsapp"
              value={form.whatsapp}
              onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cobranca-ciclo">Periodicidade</Label>
            <select
              id="cobranca-ciclo"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.ciclo}
              onChange={(e) => setForm((p) => ({ ...p, ciclo: e.target.value as typeof p.ciclo }))}
            >
              {CICLOS.map((c) => (
                <option key={c.ciclo} value={c.ciclo}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={envio.isPending}>
              {envio.isPending ? "Criando…" : "Criar assinatura"}
            </Button>
          </div>

          {link ? (
            <p className="text-xs sm:col-span-2">
              Se a página não abriu,{" "}
              <a href={link} target="_blank" rel="noopener noreferrer" className="underline">
                use este link de pagamento
              </a>
              .
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            O pagamento acontece no provedor. O MCB não recebe nem guarda dados de cartão.
          </p>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Fase 7 — Na administração, a assinatura de cada ambiente e o registro de pagamento.
 * O pagamento é combinado fora do sistema; aqui só se registra o que foi pago e por
 * quantos meses. O banco calcula o novo vencimento e reativa o ambiente suspenso por
 * vencimento.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AmbienteNaVisaoGeral } from "@/lib/mcb/admin.functions";
import {
  centavosDoCampo,
  estadoDaAssinatura,
  precoParaCampo,
  textoDaSituacao,
} from "@/lib/mcb/assinatura";
import { registrarPagamento } from "@/lib/mcb/assinatura.functions";
import { dataBR } from "@/lib/mcb/relatorio";

const MESES = [1, 2, 3, 6, 12];

export function AssinaturaDoAmbiente({
  ambiente,
  onAtualizado,
}: {
  ambiente: AmbienteNaVisaoGeral;
  onAtualizado: () => void;
}) {
  const registrar = useServerFn(registrarPagamento);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(precoParaCampo(ambiente.precoCentavos));
  const [meses, setMeses] = useState(1);
  const [forma, setForma] = useState("Pix");
  const [observacao, setObservacao] = useState("");

  const envio = useMutation({
    mutationFn: () => {
      const valorCentavos = centavosDoCampo(valor);
      if (valorCentavos === null) throw new Error("Valor inválido. Use o formato 97 ou 97,50.");
      return registrar({
        data: { tenantId: ambiente.id, valorCentavos, meses, forma, observacao },
      });
    },
    onSuccess: (resultado) => {
      toast.success(`Pagamento registrado. O ambiente vence em ${dataBR(resultado.venceEm)}.`);
      setAberto(false);
      setObservacao("");
      onAtualizado();
    },
    onError: (erro: Error) =>
      toast.error(erro.message || "Não foi possível registrar o pagamento."),
  });

  if (ambiente.isDemo) return null;

  const estado = estadoDaAssinatura({
    cobranca: ambiente.cobranca,
    venceEm: ambiente.venceEm,
    status: ambiente.status,
    suspensaoMotivo: ambiente.suspensaoMotivo,
    isDemo: ambiente.isDemo,
  });

  return (
    <div className="mt-4 rounded-lg border border-border/60 p-4 text-sm">
      <p>
        <span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
          Assinatura
        </span>
        {textoDaSituacao(estado)}
      </p>
      {aberto ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            envio.mutate();
          }}
        >
          <div className="grid gap-1 text-xs text-muted-foreground">
            <label htmlFor={`valor-${ambiente.id}`}>Valor pago (R$)</label>
            <Input
              id={`valor-${ambiente.id}`}
              className="w-28"
              inputMode="decimal"
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              required
            />
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Meses
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              value={meses}
              onChange={(event) => setMeses(Number(event.target.value))}
            >
              {MESES.map((quantidade) => (
                <option key={quantidade} value={quantidade}>
                  {quantidade}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <label htmlFor={`forma-${ambiente.id}`}>Forma</label>
            <Input
              id={`forma-${ambiente.id}`}
              className="w-32"
              value={forma}
              onChange={(event) => setForma(event.target.value)}
            />
          </div>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <label htmlFor={`observacao-${ambiente.id}`}>Observação</label>
            <Input
              id={`observacao-${ambiente.id}`}
              className="w-56"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={envio.isPending}>
            {envio.isPending ? "Registrando..." : "Registrar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>
            Fechar
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setAberto(true)}
        >
          Registrar pagamento
        </Button>
      )}
    </div>
  );
}

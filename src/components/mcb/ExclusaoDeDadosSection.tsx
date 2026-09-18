/**
 * Fase 6 — "Exclusão de dados a pedido", na área de administração da plataforma.
 *
 * Busca pelo e-mail (é assim que o pedido costuma chegar), mostra o que vai sumir e só
 * libera o botão depois que o e-mail é digitado de novo. As regras estão em
 * `exclusao.ts`; a exclusão e a checagem de papel, em `exclusao.functions.ts`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmacaoConfere, resumoExclusao } from "@/lib/mcb/exclusao";
import {
  buscarParaExclusao,
  excluirCandidata,
  type CandidataParaExclusao,
} from "@/lib/mcb/exclusao.functions";

const DESTINO_DA_CONTA = {
  excluida: "apagada",
  mantida: "mantida",
  sem_conta: "ela não tinha",
} as const;

export function ExclusaoDeDadosSection() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(buscarParaExclusao);
  const excluir = useServerFn(excluirCandidata);

  const [email, setEmail] = useState("");
  const [resultados, setResultados] = useState<CandidataParaExclusao[] | null>(null);
  const [alvo, setAlvo] = useState<CandidataParaExclusao | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluirConta, setExcluirConta] = useState(true);

  const escolher = (afiliada: CandidataParaExclusao | null) => {
    setAlvo(afiliada);
    setConfirmacao("");
    setExcluirConta(true);
  };

  const busca = useMutation({
    mutationFn: () => buscar({ data: { email } }),
    onSuccess: (r) => {
      setResultados(r);
      escolher(null);
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível buscar."),
  });

  const exclusao = useMutation({
    mutationFn: (afiliada: CandidataParaExclusao) =>
      excluir({
        data: {
          influencerId: candidata.id,
          confirmacao,
          excluirConta: excluirConta && candidata.motivoParaManterConta === null,
        },
      }),
    onSuccess: (r, afiliada) => {
      const arquivos =
        r.arquivosNoArmazenamento > 0
          ? `; ${r.arquivosNoArmazenamento} arquivo(s) no armazenamento`
          : "";
      toast.success(
        `Dados excluídos: ${resumoExclusao(r.contagem)}${arquivos}. Conta de acesso: ${DESTINO_DA_CONTA[r.conta]}.`,
      );
      if (r.aviso) toast.warning(r.aviso);
      setResultados((atual) => atual?.filter((c) => c.id !== candidata.id) ?? null);
      escolher(null);
      queryClient.invalidateQueries({ queryKey: ["mcb", "admin", "overview"] });
    },
    onError: (erro: Error) => toast.error(erro.message || "Não foi possível excluir."),
  });

  const podeExcluir = alvo !== null && confirmacaoConfere(confirmacao, alvo.email);

  return (
    <section className="glass rounded-xl border border-border/60 p-6">
      <h2 className="font-serif text-xl">Exclusão de dados a pedido</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quando uma afiliada pedir a exclusão dos dados, busque pelo e-mail dela. A exclusão é
        definitiva: apaga cadastro, inscrição, consentimentos, tarefas, notas, números, avaliações,
        análises e arquivos. No log fica só o registro de que houve a exclusão, sem nome nem e-mail.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          busca.mutate();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="exclusao-email">E-mail da afiliada</Label>
          <Input
            id="exclusao-email"
            type="email"
            className="w-72 max-w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={busca.isPending}>
          {busca.isPending ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {resultados !== null && resultados.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma inscrição com esse e-mail, em nenhum ambiente.
        </p>
      ) : null}

      {resultados && resultados.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm">
          {resultados.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.email} · {c.ambiente} · inscrição em{" "}
                    {new Date(c.criadaEm).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acesso ao portal: {c.temConta ? "sim" : "não"} · {c.tarefas} tarefa(s) ·{" "}
                    {c.arquivos} arquivo(s)
                  </p>
                </div>
                {alvo?.id === c.id ? null : (
                  <Button type="button" size="sm" variant="outline" onClick={() => escolher(c)}>
                    Excluir esta inscrição
                  </Button>
                )}
              </div>

              {alvo?.id === c.id ? (
                <div className="mt-3 grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm">
                    Isto apaga de vez os dados de <strong>{c.nome}</strong> no ambiente {c.ambiente}
                    . Não há como desfazer.
                  </p>

                  {c.temConta ? (
                    c.motivoParaManterConta === null ? (
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={excluirConta}
                          onChange={(e) => setExcluirConta(e.target.checked)}
                          aria-labelledby={`exclusao-conta-${c.id}`}
                        />
                        <span id={`exclusao-conta-${c.id}`}>
                          Apagar também a conta de acesso ao portal
                        </span>
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        A conta de acesso ao portal fica: {c.motivoParaManterConta}
                      </p>
                    )
                  ) : null}

                  <div className="grid gap-1.5">
                    <Label htmlFor={`exclusao-confirmacao-${c.id}`}>
                      Para confirmar, digite o e-mail da afiliada
                    </Label>
                    <Input
                      id={`exclusao-confirmacao-${c.id}`}
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!podeExcluir || exclusao.isPending}
                      onClick={() => exclusao.mutate(c)}
                    >
                      {exclusao.isPending ? "Excluindo…" : "Excluir definitivamente"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => escolher(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

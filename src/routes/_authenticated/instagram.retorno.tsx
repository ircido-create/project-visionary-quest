/**
 * Retorno do OAuth do Instagram.
 *
 * Fica sob `_authenticated` de propósito: a troca do código pelo token precisa saber
 * quem está logado, porque é a sessão que prova que quem voltou é a dona da
 * candidatura. Sem isso, um código capturado poderia ser trocado por outra pessoa.
 *
 * O `state` traz o id da candidatura. Ele não é a defesa — quem recusa chamador errado
 * é `instagram_connect` no banco. Serve para saber de qual candidatura se trata.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { concluirConexaoInstagram } from "@/lib/mcb/instagram.functions";

// `exactOptionalPropertyTypes` está ligado no projeto: `code?: string` recusaria o
// valor `undefined` explícito que a normalização abaixo produz.
type Busca = {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
  error_description: string | undefined;
};

export const Route = createFileRoute("/_authenticated/instagram/retorno")({
  validateSearch: (search: Record<string, unknown>): Busca => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Conectando Instagram — MCB" }, { name: "robots", content: "noindex" }],
  }),
  component: Retorno,
});

function Retorno() {
  const { code, state, error, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const concluir = useServerFn(concluirConexaoInstagram);

  // O código da Meta é de uso único: uma segunda tentativa falharia com uma mensagem
  // confusa. Em desenvolvimento o React monta duas vezes, então sem esta trava o
  // fluxo quebraria só no ambiente local — e pareceria bug de produção.
  const jaTentou = useRef(false);

  const troca = useMutation({
    mutationFn: (input: { code: string; state: string }) => concluir({ data: input }),
    onSuccess: ({ usuario }) => {
      toast.success(usuario ? `Instagram conectado como @${usuario}.` : "Instagram conectado.");
      void navigate({ to: "/portal" });
    },
    onError: (erro: Error) => {
      toast.error(erro.message);
      void navigate({ to: "/portal" });
    },
  });

  useEffect(() => {
    if (jaTentou.current) return;
    jaTentou.current = true;

    if (error) {
      // Recusar a autorização é uma escolha legítima, não uma falha.
      toast.message(error_description ?? "Autorização não concluída.");
      void navigate({ to: "/portal" });
      return;
    }
    if (!code || !state) {
      toast.error("Retorno da Meta veio incompleto.");
      void navigate({ to: "/portal" });
      return;
    }
    troca.mutate({ code, state });
    // Roda uma vez, na volta da Meta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="font-serif text-2xl">Conectando sua conta…</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Estamos confirmando a autorização com o Instagram. Isso leva alguns segundos.
      </p>
    </main>
  );
}

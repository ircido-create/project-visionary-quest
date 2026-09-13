/**
 * Fase 6 — A área logada pede o aceite dos Termos de Uso e da Política de Privacidade a
 * quem ainda não aceitou a versão exigida (revisão jurídica, T1).
 *
 * Quem cria conta por e-mail já aceita no cadastro e não vê esta tela. Ela aparece uma vez
 * para quem entrou pelo Google ou pelo Lovable e para contas anteriores ao registro. Se a
 * consulta falhar, a tela não trava o acesso: o aceite fica para a próxima entrada.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { aceitarTermos, situacaoDoAceite } from "@/lib/mcb/aceiteTermos.functions";
import { VERSAO_TERMOS, descreverVersao } from "@/lib/mcb/documentosLegais";

export function AceiteDosTermosGate({ userId, children }: { userId: string; children: ReactNode }) {
  const buscar = useServerFn(situacaoDoAceite);
  const aceitar = useServerFn(aceitarTermos);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [marcado, setMarcado] = useState(false);
  const chave = ["mcb", "aceite-termos", userId];

  const situacao = useQuery({
    queryKey: chave,
    queryFn: () => buscar(),
    staleTime: Infinity,
    retry: 1,
  });
  const envio = useMutation({
    mutationFn: () => aceitar(),
    onSuccess: () => queryClient.setQueryData(chave, { emDia: true }),
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (situacao.isPending) return null;
  if (situacao.isError || situacao.data.emDia) return <>{children}</>;

  return (
    <main className="grain-overlay flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="glass w-full max-w-md rounded-2xl border border-border/60 p-8">
        <h1 className="font-serif text-2xl">Termos de Uso e Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Antes de continuar, confirme que leu e aceita a versão de {descreverVersao(VERSAO_TERMOS)}
          . A plataforma registra a versão e a data do seu aceite.
        </p>
        <label className="mt-6 flex items-start gap-3 rounded-lg border border-border/60 p-4 text-sm">
          {/* A regra procura o rótulo dentro do próprio controle e não sobe até o
              `<label>` que o envolve. O campo está rotulado pelo texto ao lado. */}
          {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
          <input
            type="checkbox"
            className="mt-1"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
          />
          <span className="text-muted-foreground">
            Li e aceito os{" "}
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Política de Privacidade
            </a>
            .
          </span>
        </label>
        {envio.isError ? (
          <p className="mt-3 text-sm text-destructive">
            Não foi possível registrar o aceite. Tente de novo em instantes.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button
            type="button"
            disabled={!marcado || envio.isPending}
            onClick={() => envio.mutate()}
          >
            {envio.isPending ? "Registrando..." : "Aceitar e continuar"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => void sair()}
          >
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}

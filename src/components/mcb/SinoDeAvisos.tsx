/**
 * Fase 9 — O sininho de avisos, no painel da gestora e no portal da afiliada.
 *
 * Consulta a cada minuto. Se a consulta falhar, o sininho some em vez de mostrar erro:
 * aviso é conveniência, não pode atrapalhar o resto da página.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { avisoDaCandidata, contagemNoSino, haQuanto } from "@/lib/mcb/avisos";
import { listarAvisos, marcarAvisosComoLidos, type Aviso } from "@/lib/mcb/avisos.functions";

function Sino() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function SinoDeAvisos() {
  const listar = useServerFn(listarAvisos);
  const marcar = useServerFn(marcarAvisosComoLidos);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const chave = ["mcb", "avisos"];

  const consulta = useQuery({
    queryKey: chave,
    queryFn: () => listar(),
    refetchInterval: 60_000,
    retry: false,
  });
  const marcacao = useMutation({
    mutationFn: (ids?: string[]) => marcar({ data: ids ? { ids } : {} }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chave }),
  });

  if (consulta.isError || !consulta.data) return null;
  const { avisos, naoLidos } = consulta.data;
  const contagem = contagemNoSino(naoLidos);

  function abrir(aviso: Aviso) {
    setAberto(false);
    if (!aviso.lido) marcacao.mutate([aviso.id]);
    if (avisoDaCandidata(aviso.tipo) || !aviso.influencerId) {
      void navigate({ to: "/portal" });
    } else {
      void navigate({ to: "/candidatas/$id", params: { id: aviso.influencerId } });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={naoLidos > 0 ? `Avisos: ${naoLidos} não lidos` : "Avisos"}
        aria-expanded={aberto}
        onClick={() => setAberto((valor) => !valor)}
        className="relative rounded-full border border-border/60 p-2 text-foreground hover:bg-accent"
      >
        <Sino />
        {contagem ? (
          <span className="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-destructive-foreground">
            {contagem}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <>
          <button
            type="button"
            aria-label="Fechar avisos"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAberto(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border/60 bg-background p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Avisos</p>
              {naoLidos > 0 ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => marcacao.mutate(undefined)}
                >
                  Marcar todos como lidos
                </button>
              ) : null}
            </div>
            {avisos.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>
            ) : (
              <ul className="mt-2 grid max-h-96 gap-1 overflow-y-auto">
                {avisos.map((aviso) => (
                  <li key={aviso.id}>
                    <button
                      type="button"
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent ${aviso.lido ? "text-muted-foreground" : ""}`}
                      aria-label={aviso.lido ? aviso.titulo : `Não lido: ${aviso.titulo}`}
                      onClick={() => abrir(aviso)}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${aviso.lido ? "bg-transparent" : "bg-primary"}`}
                      />
                      <span className="min-w-0">
                        <span className="block">{aviso.titulo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {haQuanto(aviso.criadoEm)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

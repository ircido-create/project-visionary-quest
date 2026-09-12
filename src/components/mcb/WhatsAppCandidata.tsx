/**
 * Fase 5 — Botões de WhatsApp no topo da página da candidata.
 *
 * - "Convidar para o portal": só para quem ainda não tem acesso.
 * - "Lembrar tarefas atrasadas": só quando há tarefa pendente com prazo vencido.
 *
 * Os botões abrem o WhatsApp da gestora com a mensagem pronta; ela revisa e envia. As
 * mensagens estão em `whatsapp.ts`.
 */

import { Button } from "@/components/ui/button";
import { hojeEmBrasilia } from "@/lib/mcb/modelosTarefa";
import {
  linkWhatsApp,
  mensagemConvite,
  mensagemLembrete,
  numeroWhatsApp,
  tarefasAtrasadas,
  type TarefaParaLembrete,
} from "@/lib/mcb/whatsapp";

export function WhatsAppCandidata({
  nome,
  email,
  whatsapp,
  temPortal,
  tarefas,
  gestora,
}: {
  nome: string;
  email: string;
  whatsapp: string | null;
  temPortal: boolean;
  tarefas: TarefaParaLembrete[];
  gestora: string | null;
}) {
  const numero = numeroWhatsApp(whatsapp);
  if (!numero) {
    return (
      <span className="text-xs text-muted-foreground">
        {whatsapp ? "WhatsApp em formato desconhecido" : "Sem WhatsApp cadastrado"}
      </span>
    );
  }

  const origem = window.location.origin;
  const atrasadas = tarefasAtrasadas(tarefas, hojeEmBrasilia());

  return (
    <>
      {temPortal ? null : (
        <Button asChild variant="outline" size="sm">
          <a
            href={linkWhatsApp(
              numero,
              mensagemConvite({
                nome,
                email,
                linkCadastro: `${origem}/auth?modo=cadastro`,
                gestora,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Convidar para o portal
          </a>
        </Button>
      )}
      {atrasadas.length > 0 ? (
        <Button asChild variant="outline" size="sm">
          <a
            href={linkWhatsApp(
              numero,
              mensagemLembrete({
                nome,
                tarefas: atrasadas,
                gestora,
                linkPortal: temPortal ? `${origem}/portal` : null,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            {atrasadas.length === 1
              ? "Lembrar tarefa atrasada"
              : `Lembrar ${atrasadas.length} tarefas atrasadas`}
          </a>
        </Button>
      ) : null}
    </>
  );
}

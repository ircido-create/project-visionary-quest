/**
 * Fase 5 — Convite e lembrete pelo WhatsApp, sem API.
 *
 * O sistema só monta o link `wa.me` com a mensagem pronta; quem envia é a gestora, do
 * próprio WhatsApp. Sem secret, sem custo por mensagem e sem envio automático. Por isso
 * nada aqui registra "enviado": o sistema não sabe se ela apertou enviar.
 */

/**
 * O número no formato do wa.me: só dígitos, com o 55 do Brasil. `null` quando não dá
 * para confiar — um link para o número errado é pior do que nenhum botão.
 *
 * Na Porta de Entrada o número chega com DDD e sem o 55, com ou sem máscara.
 */
export function numeroWhatsApp(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  // O 0 de discagem ("011 9...") não faz parte do número.
  const digitos = bruto.replace(/\D/g, "").replace(/^0+/, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) return digitos;
  return null;
}

export function linkWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome.trim();
}

/** "2026-09-15" → "15/09". */
export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export type TarefaParaLembrete = { title: string; due_date: string | null; status: string };

/** Pendentes ou em andamento com prazo antes de hoje, da mais antiga para a mais recente. */
export function tarefasAtrasadas<T extends TarefaParaLembrete>(tarefas: T[], hoje: string): T[] {
  return tarefas
    .filter(
      (t) =>
        (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO") &&
        t.due_date !== null &&
        t.due_date < hoje,
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
}

const apresentacao = (gestora: string | null) =>
  gestora ? `Aqui é ${primeiroNome(gestora)}. ` : "";

export function mensagemConvite(entrada: {
  nome: string;
  email: string;
  linkCadastro: string;
  gestora: string | null;
}): string {
  return [
    `Oi, ${primeiroNome(entrada.nome)}! ${apresentacao(entrada.gestora)}Seu acompanhamento no Método Criadora Blessing agora tem um portal: lá você vê suas tarefas, seus números e o que falta para a análise.`,
    // O vínculo com a candidatura é pelo e-mail: com outro e-mail ela entra num portal vazio.
    `Para entrar, crie sua conta com o mesmo e-mail da sua inscrição (${entrada.email}): ${entrada.linkCadastro}`,
    "Depois é só confirmar o e-mail que chega na sua caixa de entrada.",
  ].join("\n\n");
}

export function mensagemLembrete(entrada: {
  nome: string;
  tarefas: { title: string; due_date: string | null }[];
  gestora: string | null;
  linkPortal: string | null;
}): string {
  const uma = entrada.tarefas.length === 1;
  const lista = entrada.tarefas
    .map((t) => `• ${t.title}${t.due_date ? ` (prazo ${dataCurta(t.due_date)})` : ""}`)
    .join("\n");
  const partes = [
    `Oi, ${primeiroNome(entrada.nome)}! ${apresentacao(entrada.gestora)}Passando para lembrar ${uma ? "da tarefa que passou" : "das tarefas que passaram"} do prazo:`,
    lista,
    "Se travou em alguma coisa, me conta que a gente ajusta.",
  ];
  if (entrada.linkPortal) partes.push(`Está tudo no seu portal: ${entrada.linkPortal}`);
  return partes.join("\n\n");
}

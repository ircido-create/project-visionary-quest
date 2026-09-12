import { describe, expect, it } from "vitest";

import {
  dataCurta,
  linkWhatsApp,
  mensagemConvite,
  mensagemLembrete,
  numeroWhatsApp,
  tarefasAtrasadas,
} from "./whatsapp";

describe("número do WhatsApp", () => {
  it("aceita o formato da Porta de Entrada, com ou sem máscara", () => {
    expect(numeroWhatsApp("(11) 98765-4321")).toBe("5511987654321");
    expect(numeroWhatsApp("11987654321")).toBe("5511987654321");
  });

  it("aceita quem já digitou o 55 ou o 0 de discagem", () => {
    expect(numeroWhatsApp("+55 11 98765-4321")).toBe("5511987654321");
    expect(numeroWhatsApp("011 98765-4321")).toBe("5511987654321");
  });

  it("não confunde o DDD 55 com o código do país", () => {
    expect(numeroWhatsApp("(55) 99999-8888")).toBe("5555999998888");
  });

  it("aceita fixo com DDD", () => {
    expect(numeroWhatsApp("(11) 3333-4444")).toBe("551133334444");
  });

  it("recusa o que não dá para confiar", () => {
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp("98765-4321")).toBeNull();
    expect(numeroWhatsApp("1 2345 6789 0123 45")).toBeNull();
  });
});

describe("link", () => {
  it("leva a mensagem codificada, com as quebras de linha", () => {
    const link = linkWhatsApp("5511987654321", "Oi, Ana!\n\nTudo bem?");
    expect(link).toBe("https://wa.me/5511987654321?text=Oi%2C%20Ana!%0A%0ATudo%20bem%3F");
  });
});

describe("tarefas atrasadas", () => {
  const hoje = "2026-09-12";
  const tarefa = (title: string, due_date: string | null, status = "PENDENTE") => ({
    title,
    due_date,
    status,
  });

  it("só pendentes e em andamento, com prazo antes de hoje, da mais antiga à mais nova", () => {
    const r = tarefasAtrasadas(
      [
        tarefa("vence hoje", "2026-09-12"),
        tarefa("recente", "2026-09-10", "EM_ANDAMENTO"),
        tarefa("antiga", "2026-09-01"),
        tarefa("concluída", "2026-09-01", "CONCLUIDA"),
        tarefa("cancelada", "2026-09-01", "CANCELADA"),
        tarefa("sem prazo", null),
      ],
      hoje,
    );
    expect(r.map((t) => t.title)).toEqual(["antiga", "recente"]);
  });
});

describe("mensagens", () => {
  it("convite diz o e-mail da inscrição e leva o link de cadastro", () => {
    const m = mensagemConvite({
      nome: "Helena Duarte Campos",
      email: "helena@exemplo.com",
      linkCadastro: "https://mcblessing.com.br/auth?modo=cadastro",
      gestora: "Ircido Silva",
    });
    expect(m).toMatch(/^Oi, Helena! Aqui é Ircido\./);
    expect(m).toContain("(helena@exemplo.com): https://mcblessing.com.br/auth?modo=cadastro");
  });

  it("sem o nome da gestora, não se apresenta", () => {
    const m = mensagemConvite({ nome: "Ana", email: "a@b.c", linkCadastro: "x", gestora: null });
    expect(m).not.toContain("Aqui é");
  });

  it("lembrete no singular, com a data curta", () => {
    const m = mensagemLembrete({
      nome: "Camila Souza",
      tarefas: [{ title: "Enviar print dos Insights", due_date: "2026-09-10" }],
      gestora: null,
      linkPortal: null,
    });
    expect(m).toContain("da tarefa que passou do prazo");
    expect(m).toContain("• Enviar print dos Insights (prazo 10/09)");
    expect(m).not.toContain("portal");
  });

  it("lembrete no plural, com o portal só para quem tem acesso", () => {
    const m = mensagemLembrete({
      nome: "Camila",
      tarefas: [
        { title: "A", due_date: "2026-09-01" },
        { title: "B", due_date: null },
      ],
      gestora: "Ircido",
      linkPortal: "https://mcblessing.com.br/portal",
    });
    expect(m).toContain("das tarefas que passaram do prazo");
    expect(m).toContain("• B\n");
    expect(m).toMatch(/Está tudo no seu portal: https:\/\/mcblessing\.com\.br\/portal$/);
  });

  it("data curta em dia/mês", () => {
    expect(dataCurta("2026-09-05")).toBe("05/09");
  });
});

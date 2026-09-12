import { describe, expect, it } from "vitest";

import {
  CONJUNTO_INICIAL,
  NIVEIS,
  PRAZO_MAXIMO_DIAS,
  descreverPrazo,
  hojeEmBrasilia,
  modelosQueFaltam,
  prazoDoModelo,
  somarDias,
  sugestoesParaNivel,
  type ModeloTarefa,
} from "./modelosTarefa";
import { LEVELS } from "./qualification";

const modelo = (id: string, level: string, title: string, sort_order = 0): ModeloTarefa => ({
  id,
  level,
  title,
  description: null,
  due_in_days: 7,
  priority: "MEDIA",
  sort_order,
});

const biblioteca = [
  modelo("m1", LEVELS.ONE, "Reescrever a bio", 1),
  modelo("m2", LEVELS.ONE, "Definir o nicho", 0),
  modelo("m3", LEVELS.ONE, "Organizar os destaques", 2),
  modelo("m4", LEVELS.TWO, "Publicar 3 Reels", 0),
];

describe("sugestões de tarefa", () => {
  it("sugere só o nível da candidata, na ordem da biblioteca", () => {
    const r = sugestoesParaNivel(LEVELS.ONE, biblioteca, []);
    expect(r.map((m) => m.id)).toEqual(["m2", "m1", "m3"]);
  });

  it("não sugere o que já virou tarefa dela", () => {
    const r = sugestoesParaNivel(LEVELS.ONE, biblioteca, [
      { title: "Qualquer título", template_id: "m2" },
    ]);
    expect(r.map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("reconhece tarefa criada à mão pelo título, sem ligar para maiúsculas e espaços", () => {
    const r = sugestoesParaNivel(LEVELS.ONE, biblioteca, [
      { title: "  reescrever   a BIO ", template_id: null },
    ]);
    expect(r.map((m) => m.id)).toEqual(["m2", "m3"]);
  });

  it("nível sem modelo não sugere nada", () => {
    expect(sugestoesParaNivel(LEVELS.QUALIFIED, biblioteca, [])).toEqual([]);
  });

  it("no servidor, filtra os pedidos repetidos independentemente do nível", () => {
    const r = modelosQueFaltam(biblioteca, [{ title: "Publicar 3 Reels", template_id: null }]);
    expect(r.map((m) => m.id)).not.toContain("m4");
  });
});

describe("prazo da tarefa", () => {
  it("conta a partir de hoje no horário de Brasília, não em UTC", () => {
    // 02h UTC do dia 12 ainda é 23h do dia 11 em Brasília.
    const agora = new Date("2026-09-12T02:00:00Z");
    expect(hojeEmBrasilia(agora)).toBe("2026-09-11");
    expect(prazoDoModelo(7, agora)).toBe("2026-09-18");
  });

  it("atravessa o fim do mês", () => {
    expect(somarDias("2026-09-28", 7)).toBe("2026-10-05");
  });

  it("modelo sem prazo gera tarefa sem prazo", () => {
    expect(prazoDoModelo(null)).toBeNull();
  });

  it("descreve o prazo por extenso", () => {
    expect(descreverPrazo(null)).toBe("sem prazo");
    expect(descreverPrazo(0)).toBe("prazo no mesmo dia");
    expect(descreverPrazo(1)).toBe("prazo de 1 dia");
    expect(descreverPrazo(14)).toBe("prazo de 14 dias");
  });
});

describe("conjunto inicial", () => {
  it("cobre os cinco níveis da jornada", () => {
    const niveis = new Set(CONJUNTO_INICIAL.map((m) => m.level));
    expect([...niveis].sort()).toEqual([...NIVEIS].sort());
  });

  it("não repete título dentro do mesmo nível", () => {
    const chaves = CONJUNTO_INICIAL.map((m) => `${m.level}|${m.title.toLowerCase()}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("respeita os limites que o servidor valida", () => {
    for (const m of CONJUNTO_INICIAL) {
      expect(m.title.length).toBeGreaterThanOrEqual(3);
      expect(m.title.length).toBeLessThanOrEqual(160);
      expect(m.description.length).toBeLessThanOrEqual(1000);
      expect(m.dueInDays).toBeGreaterThanOrEqual(0);
      expect(m.dueInDays).toBeLessThanOrEqual(PRAZO_MAXIMO_DIAS);
    }
  });
});

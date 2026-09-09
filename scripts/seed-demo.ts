/**
 * Popula um ambiente com candidatas fictícias para testes.
 *
 *   bun run scripts/seed-demo.ts --slug=gestora-ircido
 *   bun run scripts/seed-demo.ts --slug=gestora-ircido --portal-email=voce@seudominio.com
 *   bun run scripts/seed-demo.ts --slug=gestora-ircido --limpar
 *
 * ATENÇÃO: usa SUPABASE_SERVICE_ROLE_KEY, que ignora TODAS as políticas de RLS.
 * Rode só contra um ambiente de teste, e apague a chave do .env.local depois.
 *
 * Tudo que o script cria leva `origin: 'seed'`, então `--limpar` remove exatamente
 * o que ele criou e nada mais. Candidata que entrou pela Porta de Entrada tem
 * origin 'landing' e não é tocada.
 *
 * Os status não são inventados: passam pelo mesmo `evaluateQualification` que a
 * aplicação usa, então o que aparece na tela é coerente com as regras de verdade.
 */

import { createClient } from "@supabase/supabase-js";

import { evaluateQualification } from "../src/lib/mcb/qualification";
import type { Database } from "../src/integrations/supabase/types";

const SEED_ORIGIN = "seed";

function arg(name: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const url = process.env["SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceKey) {
  console.error(
    "Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Coloque a service role key no .env.local (nunca no .env, que é versionado).",
  );
  process.exit(1);
}

const slug = arg("slug") ?? "gestora-ircido";
const portalEmail = arg("portal-email");
const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Seed = {
  nome: string;
  handle: string;
  cidade: string;
  uf: string;
  followers: number | null;
  posts: number | null;
  female: number | null;
  recentes: "SIM" | "NAO" | "NAO_SEI";
  tipo: "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI";
  temas: string;
  objetivo: string;
  dificuldade: string;
  /** Meses de histórico de métricas, do mais antigo ao mais recente. */
  curva: Array<{ followers: number; posts: number }>;
  tarefas: Array<{
    titulo: string;
    status: "PENDENTE" | "CONCLUIDA";
    prioridade: "BAIXA" | "MEDIA" | "ALTA";
  }>;
  notas: string[];
  feedbacks: string[];
  sinais: {
    nicheDefined?: boolean;
    bioReady?: boolean;
    profileOrganized?: boolean;
    storiesActive?: boolean;
    consistentContent?: boolean;
  };
};

const CANDIDATAS: Seed[] = [
  {
    nome: "Mariana Alves Ribeiro",
    handle: "mari.alves.faz",
    cidade: "Belo Horizonte",
    uf: "MG",
    followers: 12400,
    posts: 186,
    female: 72.5,
    recentes: "SIM",
    tipo: "CRIADOR",
    temas: "Organização da casa e rotina com filhos pequenos",
    objetivo: "Viver de conteúdo sem depender de indicação",
    dificuldade: "Constância — some por semanas quando a rotina aperta",
    curva: [
      { followers: 8100, posts: 132 },
      { followers: 9300, posts: 148 },
      { followers: 10500, posts: 161 },
      { followers: 11600, posts: 174 },
      { followers: 12400, posts: 186 },
    ],
    tarefas: [
      { titulo: "Reescrever a bio com o nicho explícito", status: "CONCLUIDA", prioridade: "ALTA" },
      { titulo: "Publicar 3 Reels sobre rotina matinal", status: "CONCLUIDA", prioridade: "MEDIA" },
      { titulo: "Organizar destaques por tema", status: "PENDENTE", prioridade: "MEDIA" },
    ],
    notas: ["Respondeu rápido no WhatsApp. Perfil já estava bem estruturado antes da candidatura."],
    feedbacks: [
      "Seu perfil está pronto para a auditoria. Mantenha a frequência de Reels nas próximas duas semanas.",
    ],
    sinais: {
      nicheDefined: true,
      bioReady: true,
      profileOrganized: true,
      storiesActive: true,
      consistentContent: true,
    },
  },
  {
    nome: "Juliana Prado Marques",
    handle: "ju.prado.oficial",
    cidade: "Curitiba",
    uf: "PR",
    followers: 520,
    posts: 34,
    female: 51.2,
    recentes: "SIM",
    tipo: "CRIADOR",
    temas: "Receitas rápidas para quem mora sozinha",
    objetivo: "Chegar a mil seguidores até o fim do trimestre",
    dificuldade: "Não sabe o que postar quando não tem receita nova",
    curva: [
      { followers: 310, posts: 18 },
      { followers: 372, posts: 23 },
      { followers: 428, posts: 27 },
      { followers: 486, posts: 31 },
      { followers: 520, posts: 34 },
    ],
    tarefas: [
      { titulo: "Definir 3 pilares de conteúdo", status: "CONCLUIDA", prioridade: "ALTA" },
      { titulo: "Gravar 5 Stories por semana", status: "PENDENTE", prioridade: "ALTA" },
    ],
    notas: ["Passou nos requisitos no limite. Vale acompanhar de perto para não regredir."],
    feedbacks: ["Você bateu os números mínimos. Agora o foco é constância, não crescimento."],
    sinais: { nicheDefined: true, bioReady: true, storiesActive: true },
  },
  {
    nome: "Camila Souza Nogueira",
    handle: "camilanogueira.co",
    cidade: "Recife",
    uf: "PE",
    followers: null,
    posts: 45,
    female: null,
    recentes: "NAO_SEI",
    tipo: "CRIADOR",
    temas: "Moda plus size acessível",
    objetivo: "Fechar parcerias com lojas locais",
    dificuldade: "Não sabe onde ver os dados de público no Instagram",
    curva: [],
    tarefas: [
      { titulo: "Enviar print dos insights de público", status: "PENDENTE", prioridade: "ALTA" },
      { titulo: "Enviar print do total de seguidores", status: "PENDENTE", prioridade: "ALTA" },
    ],
    notas: ["Não conseguiu achar a aba de insights. Enviar o passo a passo com imagens."],
    feedbacks: [],
    sinais: { nicheDefined: true },
  },
  {
    nome: "Patrícia Lima Fonseca",
    handle: "paty.fonseca",
    cidade: "Goiânia",
    uf: "GO",
    followers: 210,
    posts: 12,
    female: 38.0,
    recentes: "NAO",
    tipo: "PESSOAL",
    temas: "Ainda não definido — posta sobre viagem, comida e trabalho",
    objetivo: "Entender se isso é para ela",
    dificuldade: "Não sabe por onde começar",
    curva: [
      { followers: 190, posts: 9 },
      { followers: 198, posts: 10 },
      { followers: 205, posts: 11 },
      { followers: 210, posts: 12 },
    ],
    tarefas: [
      {
        titulo: "Escolher um nicho entre os três temas atuais",
        status: "PENDENTE",
        prioridade: "ALTA",
      },
      { titulo: "Trocar o perfil para conta de criador", status: "PENDENTE", prioridade: "MEDIA" },
    ],
    notas: ["Perfil ainda pessoal. Conversa inicial mostrou pouca clareza sobre objetivo."],
    feedbacks: [
      "Antes dos números, precisamos definir sobre o que é o seu perfil. Vamos começar por aí.",
    ],
    sinais: {},
  },
  {
    nome: "Renata Barbosa Teixeira",
    handle: "renata.teixeira.studio",
    cidade: "Florianópolis",
    uf: "SC",
    followers: 7800,
    posts: 240,
    female: 64.0,
    recentes: "SIM",
    tipo: "COMERCIAL",
    temas: "Estúdio de fotografia — bastidores e ensaios",
    objetivo: "Separar a marca do estúdio do perfil pessoal",
    dificuldade: "O perfil é comercial e ela não sabe se isso a desqualifica",
    curva: [
      { followers: 7100, posts: 211 },
      { followers: 7300, posts: 221 },
      { followers: 7550, posts: 231 },
      { followers: 7800, posts: 240 },
    ],
    tarefas: [
      { titulo: "Avaliar migração para conta de criador", status: "PENDENTE", prioridade: "MEDIA" },
    ],
    notas: ["Números bons, mas o tipo de perfil manda para revisão manual. Decidir caso a caso."],
    feedbacks: [],
    sinais: { nicheDefined: true, bioReady: true, profileOrganized: true, consistentContent: true },
  },
  {
    nome: "Aline Costa Menezes",
    handle: "alinecmenezes",
    cidade: "Salvador",
    uf: "BA",
    followers: 860,
    posts: 28,
    female: 61.4,
    recentes: "SIM",
    tipo: "CRIADOR",
    temas: "Maternidade atípica",
    objetivo: "Criar comunidade com outras mães",
    dificuldade: "Medo de expor o filho",
    curva: [
      { followers: 640, posts: 17 },
      { followers: 712, posts: 21 },
      { followers: 790, posts: 25 },
      { followers: 860, posts: 28 },
    ],
    tarefas: [
      { titulo: "Chegar a 31 publicações", status: "PENDENTE", prioridade: "ALTA" },
      {
        titulo: "Definir o que não será mostrado sobre o filho",
        status: "CONCLUIDA",
        prioridade: "ALTA",
      },
    ],
    notas: ["Falta pouco em publicações. Seguidores e público já passam."],
    feedbacks: ["Faltam 3 publicações para o requisito. O resto já está no lugar."],
    sinais: { nicheDefined: true, bioReady: true, storiesActive: true, consistentContent: true },
  },
  {
    nome: "Beatriz Andrade Rocha",
    handle: "bia.rocha.escreve",
    cidade: "Porto Alegre",
    uf: "RS",
    followers: 1500,
    posts: 62,
    female: null,
    recentes: "SIM",
    tipo: "CRIADOR",
    temas: "Escrita criativa e leitura",
    objetivo: "Lançar um curso próprio",
    dificuldade: "Audiência engajada, mas não sabe converter",
    curva: [
      { followers: 1180, posts: 44 },
      { followers: 1290, posts: 51 },
      { followers: 1400, posts: 57 },
      { followers: 1500, posts: 62 },
    ],
    tarefas: [
      {
        titulo: "Enviar print da divisão de público por gênero",
        status: "PENDENTE",
        prioridade: "ALTA",
      },
    ],
    notas: ["Só falta o dado de público feminino para fechar a qualificação."],
    feedbacks: [],
    sinais: {
      nicheDefined: true,
      bioReady: true,
      profileOrganized: true,
      storiesActive: true,
      consistentContent: true,
    },
  },
];

/** Datas dos snapshots: um por mês, terminando hoje. */
function monthsAgo(count: number, index: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - (count - 1 - index));
  return d.toISOString();
}

async function main() {
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("id, name, slug, is_demo")
    .eq("slug", slug)
    .maybeSingle();

  if (tenantError) throw new Error(tenantError.message);
  if (!tenant) throw new Error(`Ambiente "${slug}" não encontrado.`);
  if (tenant.is_demo) {
    throw new Error(
      `"${slug}" é um ambiente de demonstração — ninguém o administra, então candidata criada ali não recebe tarefa nem métrica. Use o slug da sua gestora.`,
    );
  }

  console.log(`Ambiente: ${tenant.name} (${tenant.slug})`);

  if (hasFlag("limpar")) {
    const { data: antigas } = await db
      .from("influencers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("origin", SEED_ORIGIN);
    const ids = (antigas ?? []).map((r) => r.id);
    if (ids.length > 0) {
      // As demais tabelas caem por cascade no influencer_id.
      await db.from("influencers").delete().in("id", ids);
      console.log(`Removidas ${ids.length} candidatas do seed anterior.`);
    } else {
      console.log("Nada do seed anterior para remover.");
    }
  }

  const lista = [...CANDIDATAS];
  if (portalEmail) {
    lista.push({
      ...CANDIDATAS[0]!,
      nome: "Sofia Martins Vieira",
      handle: "sofia.martins.v",
      cidade: "São Paulo",
      uf: "SP",
      temas: "Bem-estar e rotina de autocuidado",
      objetivo: "Testar o portal da candidata",
      dificuldade: "—",
    });
  }

  let criadas = 0;
  let puladas = 0;

  for (const [indice, c] of lista.entries()) {
    const ehPortal = Boolean(portalEmail) && indice === lista.length - 1;
    const email = ehPortal
      ? portalEmail!.toLowerCase()
      : `${c.handle.replace(/[^a-z0-9]/g, ".")}@exemplo.test`;

    const { data: existente } = await db
      .from("influencers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .maybeSingle();

    if (existente) {
      console.log(`  · ${c.nome} — já existe, pulando`);
      puladas++;
      continue;
    }

    const evaluation = evaluateQualification(
      {
        followers: c.followers,
        postsCount: c.posts,
        recentPosts6m: c.recentes,
        profileType: c.tipo,
        femaleAudiencePct: c.female,
        source: "MANUAL",
        capturedAt: new Date().toISOString(),
      },
      c.sinais,
    );

    const status =
      evaluation.status === "QUALIFIED"
        ? "PRONTA_AUDITORIA"
        : evaluation.status === "NEEDS_EVIDENCE"
          ? "AGUARDANDO_EVIDENCIAS"
          : evaluation.status === "MANUAL_REVIEW"
            ? "AGUARDANDO_DIAGNOSTICO"
            : "EM_ESTRUTURACAO";

    const { data: influencer, error } = await db
      .from("influencers")
      .insert({
        tenant_id: tenant.id,
        full_name: c.nome,
        email,
        whatsapp: null,
        city: c.cidade,
        state: c.uf,
        instagram_handle: c.handle,
        instagram_url: `https://instagram.com/${c.handle}`,
        followers: c.followers,
        posts_count: c.posts,
        recent_posts_6m: c.recentes,
        female_audience_pct: c.female,
        profile_type: c.tipo,
        topics: c.temas,
        profile_goal: c.objetivo,
        main_difficulty: c.dificuldade,
        status,
        level: evaluation.progress.level,
        progress_score: evaluation.progress.score,
        data_source: "MANUAL",
        origin: SEED_ORIGIN,
        consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  · ${c.nome} — FALHOU: ${error.message}`);
      continue;
    }

    const base = { tenant_id: tenant.id, influencer_id: influencer.id };

    await db.from("qualification_results").insert({
      ...base,
      rule_set_version: evaluation.ruleSetVersion,
      status: evaluation.status,
      requirements: evaluation.requirements as never,
      progress: evaluation.progress as never,
    });

    if (c.curva.length > 0) {
      await db.from("metric_snapshots").insert(
        c.curva.map((ponto, i) => ({
          ...base,
          followers: ponto.followers,
          posts_count: ponto.posts,
          female_audience_pct: c.female,
          source: "MANUAL" as const,
          captured_at: monthsAgo(c.curva.length, i),
        })),
      );
    }

    if (c.tarefas.length > 0) {
      await db.from("tasks").insert(
        c.tarefas.map((t, i) => {
          const prazo = new Date();
          prazo.setDate(prazo.getDate() + (i + 1) * 7);
          return {
            ...base,
            title: t.titulo,
            status: t.status,
            priority: t.prioridade,
            due_date: prazo.toISOString().slice(0, 10),
          };
        }),
      );
    }

    if (c.notas.length > 0) {
      await db.from("notes").insert(c.notas.map((body) => ({ ...base, body })));
    }
    if (c.feedbacks.length > 0) {
      await db.from("feedbacks").insert(c.feedbacks.map((body) => ({ ...base, body })));
    }

    await db.from("status_history").insert({
      ...base,
      from_status: null,
      to_status: status,
      note: "Registro criado pelo seed de testes.",
    });

    console.log(
      `  · ${c.nome} — ${evaluation.status}, ${evaluation.progress.score}% ${ehPortal ? `(PORTAL: ${email})` : ""}`,
    );
    criadas++;
  }

  console.log(`\n${criadas} criadas, ${puladas} puladas.`);
  if (portalEmail) {
    console.log(
      `\nPara fechar o portal: cadastre-se em /auth com ${portalEmail}, confirme o e-mail e entre.`,
    );
  }
}

main().catch((error) => {
  console.error("\nErro:", error instanceof Error ? error.message : error);
  process.exit(1);
});

insert into public.plans (id, code, name, description, price_cents, max_candidates, max_members, max_ai_analyses, storage_mb, custom_branding, sort_order) values
 ('00000000-0000-4000-8000-000000000f01', 'essencial', 'Essencial', 'Para quem está começando a acompanhar candidatas com método.', 9700, 25, 2, 20, 512, false, 1),
 ('00000000-0000-4000-8000-000000000f02', 'profissional', 'Profissional', 'Para gestoras com equipe e volume constante de candidatas.', 19700, 120, 6, 120, 2048, false, 2),
 ('00000000-0000-4000-8000-000000000f03', 'premium', 'Premium', 'Limites altos, identidade personalizada e recursos avançados.', 39700, 500, 20, 500, 10240, true, 3);

insert into public.qualification_rule_sets (id, tenant_id, name, version, is_active, requirements, weights) values
 ('00000000-0000-4000-8000-000000000e01', null, 'Template Ybera', 'v1', true,
  '[{"key":"followers","label":"Seguidores","operator":"gte","target":500},
    {"key":"posts","label":"Publicações no feed","operator":"gt","target":30},
    {"key":"recency","label":"12 publicações nos últimos 6 meses","operator":"is_true","target":true},
    {"key":"profile_type","label":"Perfil de criadora de conteúdo","operator":"equals","target":"CRIADOR"},
    {"key":"female_audience","label":"Público feminino","operator":"gt","target":50}]'::jsonb,
  '{"nicho":10,"bio":10,"perfil_organizado":10,"stories":10,"conteudo_consistente":15,"posts_30":10,"seguidores_500":20,"publico_feminino":10,"posts_recentes":5}'::jsonb);

insert into public.tenants (id, name, slug, plan_id, is_demo, is_public_page_enabled) values
 ('11111111-1111-1111-1111-111111111111', 'Equipe Blessing', 'blessing', '00000000-0000-4000-8000-000000000f03', true, true),
 ('22222222-2222-2222-2222-222222222222', 'Gestora Aline — Demo', 'aline-demo', '00000000-0000-4000-8000-000000000f02', true, true),
 ('33333333-3333-3333-3333-333333333333', 'Gestora Patrícia — Demo', 'patricia-demo', '00000000-0000-4000-8000-000000000f01', true, true);

insert into public.tenant_branding (tenant_id, manager_name, headline, subheadline, authority_quote, bio, instagram_handle) values
 ('11111111-1111-1111-1111-111111111111', 'Equipe Blessing', 'Do perfil pessoal à criadora de conteúdo pronta para análise.', 'Uma jornada prática para estruturar seu perfil, desenvolver presença, criar conexão e alcançar os requisitos necessários com autenticidade.', 'Antes de ensinar você a vender uma marca, vamos ensinar você a construir a sua.', 'A equipe que criou o Método Criadora Blessing.', 'metodocriadorablessing'),
 ('22222222-2222-2222-2222-222222222222', 'Aline (demonstração)', 'Do perfil pessoal à criadora de conteúdo pronta para análise.', 'Estruture seu perfil, apareça com constância e conquiste os requisitos com acompanhamento próximo.', 'Antes de ensinar você a vender uma marca, vamos ensinar você a construir a sua.', 'Gestora de demonstração usada para explorar a plataforma.', 'gestora.aline.demo'),
 ('33333333-3333-3333-3333-333333333333', 'Patrícia (demonstração)', 'Sua presença digital construída com método e verdade.', 'Um caminho claro para sair do perfil pessoal e chegar à análise oficial preparada.', 'Antes de ensinar você a vender uma marca, vamos ensinar você a construir a sua.', 'Gestora de demonstração usada para explorar a plataforma.', 'gestora.patricia.demo');

insert into public.influencers (id, tenant_id, full_name, email, whatsapp, city, state, instagram_handle, instagram_url,
  followers, posts_count, recent_posts_6m, female_audience_pct, profile_type, stories_frequency, reels_frequency,
  topics, asked_about, profile_goal, main_difficulty, daily_time, instagram_goal,
  initial_followers, initial_posts_count, status, level, progress_score, data_source, consent_at) values
 ('aaaaaaa1-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Camila Rocha (demo)', 'camila.demo@exemplo.com', '(11) 90000-0001', 'Campinas', 'SP', 'camila.demo', 'https://instagram.com/camila.demo',
  1240, 58, 'SIM', 68.00, 'CRIADOR', 'Todos os dias', 'Frequentemente',
  'Rotina de cuidados com cabelo', 'Indicação de produtos e finalização', 'Referência em cuidado capilar acessível', 'Organizar a agenda de gravações', '30–60 min', 'Ser aprovada como afiliada',
  620, 31, 'QUALIFICADA', 'Qualificada para análise', 92.00, 'MANUAL', now() - interval '40 days'),
 ('aaaaaaa1-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 'Juliana Mendes (demo)', 'juliana.demo@exemplo.com', '(11) 90000-0002', 'Sorocaba', 'SP', 'juliana.demo', 'https://instagram.com/juliana.demo',
  438, 28, 'SIM', 62.00, 'CRIADOR', 'Algumas vezes por semana', 'Às vezes',
  'Maternidade e autoestima', 'Como conciliar rotina e autocuidado', 'Conteúdo leve e verdadeiro', 'Constância nas publicações', '15–30 min', 'Crescer para 1.000 seguidoras',
  310, 19, 'EM_CRESCIMENTO', 'Nível 3 — Crescer', 68.00, 'MANUAL', now() - interval '25 days'),
 ('aaaaaaa1-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222222', 'Beatriz Alves (demo)', 'beatriz.demo@exemplo.com', '(11) 90000-0003', 'Jundiaí', 'SP', 'beatriz.demo', 'https://instagram.com/beatriz.demo',
  null, null, 'NAO_SEI', null, 'NAO_SEI', 'Raramente', 'Ainda não',
  'Moda acessível', 'Onde comprar peças bonitas e baratas', 'Inspiração de looks do dia', 'Não sei o que postar', 'Até 15 min', 'Entender se tenho perfil para isso',
  null, null, 'AGUARDANDO_EVIDENCIAS', 'Nível 1 — Estruturar', 20.00, 'MANUAL', now() - interval '6 days'),
 ('aaaaaaa1-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333333', 'Larissa Duarte (demo)', 'larissa.demo@exemplo.com', '(21) 90000-0004', 'Niterói', 'RJ', 'larissa.demo', 'https://instagram.com/larissa.demo',
  780, 34, 'NAO', 44.00, 'PESSOAL', 'Algumas vezes por semana', 'Já tentei',
  'Culinária afetiva', 'Receitas rápidas', 'Uma cozinha real e possível', 'Aparecer em vídeo', '15–30 min', 'Transformar o perfil em criadora',
  700, 30, 'EM_ESTRUTURACAO', 'Nível 1 — Estruturar', 45.00, 'MANUAL', now() - interval '18 days'),
 ('aaaaaaa1-0000-4000-8000-000000000005', '33333333-3333-3333-3333-333333333333', 'Renata Lima (demo)', 'renata.demo@exemplo.com', '(21) 90000-0005', 'Rio de Janeiro', 'RJ', 'renata.demo', 'https://instagram.com/renata.demo',
  2100, 96, 'SIM', 71.00, 'CRIADOR', 'Todos os dias', 'Frequentemente',
  'Beleza e autoestima madura', 'Cuidados com cabelos grisalhos', 'Autoestima em qualquer idade', 'Organizar ideias de conteúdo', 'Mais de 1h', 'Ser afiliada oficial',
  1500, 70, 'PRONTA_AUDITORIA', 'Pronta para auditoria', 88.00, 'MANUAL', now() - interval '60 days');

insert into public.applications (tenant_id, influencer_id, answers) 
select i.tenant_id, i.id, jsonb_build_object('origem','landing demo','assunto', i.topics, 'meta', i.instagram_goal)
from public.influencers i where i.tenant_id in ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');

insert into public.metric_snapshots (tenant_id, influencer_id, followers, posts_count, female_audience_pct, source, captured_at)
values
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001', 620, 31, 60.00, 'MANUAL', now() - interval '60 days'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001', 890, 42, 64.00, 'MANUAL', now() - interval '30 days'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001', 1240, 58, 68.00, 'MANUAL', now() - interval '2 days'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002', 310, 19, 58.00, 'MANUAL', now() - interval '45 days'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002', 380, 24, 60.00, 'MANUAL', now() - interval '20 days'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002', 438, 28, 62.00, 'MANUAL', now() - interval '3 days'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000004', 700, 30, 42.00, 'MANUAL', now() - interval '30 days'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000004', 780, 34, 44.00, 'MANUAL', now() - interval '4 days'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000005', 1500, 70, 68.00, 'MANUAL', now() - interval '50 days'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000005', 2100, 96, 71.00, 'MANUAL', now() - interval '1 days');

insert into public.tasks (tenant_id, influencer_id, title, description, level, due_date, priority, status) values
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002','Publicar 3 Reels de conexão','Um Reel por pilar: Atrair, Conectar e Ensinar.','Nível 3 — Crescer', current_date - 2, 'ALTA', 'PENDENTE'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002','Revisar bio com foco em nicho','Deixar claro para quem fala e o que entrega.','Nível 1 — Estruturar', current_date + 3, 'MEDIA', 'EM_ANDAMENTO'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000003','Enviar print dos Insights','Visão geral, público por gênero e seguidores.','Nível 1 — Estruturar', current_date - 1, 'ALTA', 'PENDENTE'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001','Preparar material para análise oficial','Selecionar melhores conteúdos e organizar destaques.','Qualificada para análise', current_date + 5, 'MEDIA', 'PENDENTE'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000004','Trocar para conta de criadora de conteúdo','Ajuste nas configurações do Instagram.','Nível 1 — Estruturar', current_date + 1, 'ALTA', 'PENDENTE'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000005','Auditoria final do perfil','Checar requisitos antes do envio.','Pronta para auditoria', current_date + 7, 'MEDIA', 'PENDENTE');

insert into public.notes (tenant_id, influencer_id, body) values
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002','Muito comprometida. Precisa de ajuda com constância.'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000004','Perfil ainda pessoal; público feminino abaixo do mínimo.');

insert into public.feedbacks (tenant_id, influencer_id, body) values
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001','Perfil pronto para a análise oficial. Excelente evolução em 60 dias.'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002','Faltam 62 seguidoras e 3 publicações. Vamos focar em Reels nesta semana.');

insert into public.status_history (tenant_id, influencer_id, from_status, to_status, note) values
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000001','EM_CRESCIMENTO','QUALIFICADA','Todos os requisitos comprovados.'),
 ('22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-4000-8000-000000000002','EM_PRODUCAO','EM_CRESCIMENTO','Constância melhorou.'),
 ('33333333-3333-3333-3333-333333333333','aaaaaaa1-0000-4000-8000-000000000005','EM_CRESCIMENTO','PRONTA_AUDITORIA','Requisitos atingidos, aguardando auditoria.');

insert into public.consent_logs (tenant_id, influencer_id, purpose, source)
select i.tenant_id, i.id, 'Análise de perfil e acompanhamento do método', 'landing demo'
from public.influencers i where i.consent_at is not null;
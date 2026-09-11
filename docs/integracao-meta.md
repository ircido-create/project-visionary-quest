# Integração oficial Meta/Instagram

O código está pronto e desligado. Ele só aparece na tela quando as três variáveis
abaixo existirem — sem elas, `InstagramSection` devolve `null` e nada muda para
ninguém. Isso é de propósito: botão que só dá erro é pior que botão nenhum.

## O que já funciona sem você fazer nada

Nada. Esta é a parte honesta: a integração depende de um app da Meta, que só você
pode criar, e de uma revisão da Meta que leva dias. Até lá o fluxo de print com
confirmação humana continua sendo o caminho — e continua sendo necessário mesmo
depois, pelo motivo explicado em "O que a Meta não entrega".

## Passo a passo

### 1. Criar o app

Em <https://developers.facebook.com/apps> → **Criar app** → caso de uso
**"Outro"** → tipo **Empresa**. Depois, no painel do app, adicione o produto
**Instagram** → **API com login do Instagram**.

Anote o **ID do app do Instagram** e a **Chave secreta do app do Instagram** (não
são os mesmos do app do Facebook — a tela do Instagram tem os dela).

### 2. Configurar o redirecionamento

Em **Instagram → Configuração da API → Login do negócio**, no campo de URIs de
redirecionamento OAuth válidos, cadastre exatamente:

```
https://mcblessing.com.br/instagram/retorno
```

Precisa ser idêntico ao valor de `META_REDIRECT_URI`, incluindo `https` e sem barra
no fim. A Meta compara string por string; qualquer diferença devolve um erro que não
explica o motivo.

Use o domínio `.com.br`, não o `mcblessing.lovable.app`: o endereço do Lovable
redireciona tudo para o `.com.br`, e o login da candidata fica guardado por domínio —
o retorno da Meta precisa cair onde ela está logada.

Não foi verificado se a Meta aceita URI sem HTTPS (como `http://localhost`). Para
testar, use o domínio publicado.

### 3. Variáveis de ambiente

Em produção, cadastre como secrets no Lovable. Localmente, em `.env.local` —
**nunca** no `.env`, que é versionado num repositório público.

```
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=https://mcblessing.com.br/instagram/retorno
```

### 4. Publicar e conferir

Commit na `main` atualiza só o **preview** do Lovable. O site `mcblessing.com.br` só
muda quando alguém clica em **Publicar** no editor. Os secrets, ao contrário, valem na
requisição seguinte, sem publicar.

Para conferir a configuração sem acesso ao painel, a função
`integracaoMetaDisponivel` devolve:

- `disponivel` — se os três nomes existem e têm valor;
- `faltando` — quais dos três não existem ou estão vazios;
- `parecidos` — nomes que lembram os esperados mas não batem exatamente
  (maiúscula trocada, espaço sobrando), a causa mais comum de "cadastrei e não
  funciona".

Só nomes, nunca valores.

### 5. Revisão da Meta (App Review)

Antes da aprovação, **só contas com papel no app** (administradora, testadora)
conseguem conectar. Ou seja: dá para testar com a sua própria conta, mas não para
liberar para as candidatas.

Para produção, peça revisão de:

- `instagram_business_basic` — perfil, seguidores, publicações
- `instagram_business_manage_insights` — divisão de público por gênero

A Meta pede um vídeo mostrando o fluxo e uma explicação do uso. O uso aqui é
verificável e simples de descrever: a candidata autoriza a leitura dos próprios
números para acompanhar a evolução dela no método, e pode desconectar a qualquer
momento pela mesma tela.

## O que a Meta não entrega

| dado | disponível? |
| --- | --- |
| seguidores, publicações | sempre |
| divisão de público por gênero | **só a partir de 100 seguidores** |
| conta pessoal (não profissional) | a API recusa; a conta precisa ser Business ou Criador |

O limite de 100 seguidores não tem contorno pela API. É por isso que o fluxo de print
com confirmação humana **não é redundante** com a integração: ele é o que cobre as
candidatas pequenas, que são justamente as que estão começando.

Quando a demografia não vem, o sync grava seguidores e publicações e **preserva** o
percentual de público feminino que já existia — em vez de apagá-lo. Sobrescrever um
dado confirmado por uma pessoa com um vazio seria perder informação boa em troca de
nada.

## Como a segurança está montada

O token da candidata fica **cifrado no Vault** do Supabase. A tabela
`instagram_connections` guarda só o uuid do segredo, tem RLS ligada e **nenhuma
política** — ninguém a alcança diretamente. Todo acesso passa por funções
`security definer` que checam quem está chamando.

Consequência prática: **a gestora nunca lê o token da candidata.** Ela vê o status da
conexão (usuário, data do último sync, último erro) e os números resultantes.

Isso não é promessa: está verificado em `supabase/tests/instagram.test.sql`, que roda
dentro de transação desfeita e pode ser executado em produção. O teste tem controle
embutido — a dona e a gestora chamam a *mesma* função, com o mesmo acesso ao Vault; a
dona recebe o token e a gestora recebe exceção. A única diferença entre os dois casos
é a checagem de dono.

## Limitação conhecida: o sync é sob demanda

Não há sincronização noturna. Um job agendado precisaria rodar sem ninguém logado, e
a única credencial capaz disso seria a service role key — que este projeto
deliberadamente não usa.

Então os números têm a idade da última visita da candidata ao portal, e a tela mostra
essa data ("atualizado em ..."). Se isso virar incômodo, o caminho é uma Edge Function
agendada com a service role key, decidindo antes se vale abrir essa porta.

## Onde está cada coisa

| arquivo | o quê |
| --- | --- |
| `supabase/migrations/20260910150000_fase4_integracao_meta.sql` | tabela e funções |
| `supabase/tests/instagram.test.sql` | prova de que o token não vaza |
| `src/lib/mcb/instagram.ts` | constantes e leitura das respostas (puro, testado) |
| `src/lib/mcb/instagram.functions.ts` | OAuth, chamadas à Meta, gravação |
| `src/components/mcb/InstagramSection.tsx` | a tela, nos dois modos |
| `src/routes/_authenticated/instagram.retorno.tsx` | retorno do OAuth |

# Finanças+ — Controle Financeiro Pessoal

App web de gestão financeira pessoal: receitas, despesas (variáveis, fixas e
parceladas no cartão/boleto), categorias, dashboard com gráficos, filtros,
busca e exportação em CSV. Construído com Next.js (App Router), TypeScript,
Tailwind CSS, shadcn/ui, Supabase (Auth + PostgreSQL + Row Level Security) e
Recharts.

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react
- **Gráficos:** Recharts
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Row Level Security) — sem backend próprio
- **Deploy:** Vercel

## 1. Pré-requisitos

- Node.js 20+ e npm
- Uma conta gratuita em [supabase.com](https://supabase.com)

## 2. Criar o projeto Supabase

1. Crie um novo projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
3. Em **Authentication → Providers**, confirme que **Email** está habilitado
   (é o padrão). Se quiser testar rapidamente sem confirmação de e-mail, em
   **Authentication → Settings** desative "Confirm email".
4. Abra o **SQL Editor** do projeto e rode, nesta ordem:
   - o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) — cria as
     tabelas, índices e políticas de Row Level Security;
   - cada arquivo em [`supabase/migrations/`](supabase/migrations), em ordem
     numérica (0002, 0003, ...) — adicionam formas de pagamento/cartões,
     categorias editáveis pelo usuário, lançamentos recorrentes, etc.;
   - o conteúdo de [`supabase/seed.sql`](supabase/seed.sql) — popula as
     categorias e subcategorias padrão (Alimentação, Transporte, Moradia,
     Lazer, Saúde, Educação, Salário, Freelance, Outros...).

## 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com os dados do seu projeto Supabase:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Crie uma conta em
`/signup` — cada usuário só enxerga suas próprias transações (RLS).

## 5. Estrutura do projeto

```
src/
  app/
    (marketing)/         landing page pública ("/")
    (auth)/login/        login
    (auth)/signup/       criar conta
    dashboard/           área autenticada (protegida pelo proxy/middleware)
      page.tsx           visão geral: cards, gráfico por categoria, DFC mensal
      transacoes/        CRUD de transações, filtros, busca, export CSV
      parcelamentos/     compras parceladas + resumo mensal
      cadastros/         categorias, subcategorias e formas de pagamento
  components/
    dashboard/           componentes da área logada
    auth/                formulários de login/cadastro
    ui/                  componentes shadcn/ui
  lib/
    actions/              Server Actions (mutações: criar/editar/excluir)
    data/                 funções de leitura (Server Components)
    supabase/             clients (browser, server, middleware)
    types/                tipos TypeScript do banco
supabase/
  schema.sql              schema inicial: tabelas, índices, RLS
  seed.sql                 categorias e subcategorias padrão
  migrations/               alterações incrementais (rodar em ordem, depois do schema.sql)
```

## 6. Modelo de dados (resumo)

- **categories / subcategories** — categorias padrão do sistema (globais,
  `user_id` nulo) mais as que cada usuário cria para si (Cadastros). Um
  usuário pode "excluir" uma categoria padrão: ela só fica oculta para a
  conta dele (`hidden_categories`/`hidden_subcategories`), sem afetar os
  demais usuários.
- **payment_methods** — formas de pagamento e cartões de crédito do usuário
  (dinheiro, PIX, boleto, cartão com dia de fechamento/vencimento/limite).
- **transactions** — receitas e despesas do usuário. Despesas têm uma
  `expense_kind`: `variavel`, `fixa`, `parcelada_cartao` ou `parcelada_boleto`.
- **purchases** — uma compra parcelada (cartão ou boleto). Ao criar, o app
  gera automaticamente uma linha em `transactions` para cada parcela (uma por
  mês), permitindo saber exatamente quantas parcelas já foram pagas, quantas
  estão pendentes e até quando a renda futura está comprometida.
- **recurring_series** — despesas/receitas fixas que se repetem por um
  número de meses ou por tempo indeterminado; também geram uma linha em
  `transactions` por ocorrência.

Toda leitura/escrita é protegida por Row Level Security (RLS habilitado em
todas as tabelas): cada usuário só acessa as próprias linhas
(`user_id = auth.uid()`), exceto as categorias padrão, que são de leitura
compartilhada.

## 7. Segurança: o que é seguro expor no frontend

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` **são feitas
para ir ao navegador** — o prefixo `NEXT_PUBLIC_` existe justamente para
isso, e qualquer app Supabase depende disso para funcionar. Elas não são
"secretas": a segurança real dos dados vem do **Row Level Security** no
Postgres (seção acima), não do sigilo dessas duas variáveis.

O que **nunca** deve ir para `NEXT_PUBLIC_*`, para o repositório, nem para
o código do app:

- a **senha do banco** ou qualquer *connection string* direta ao Postgres
  (`postgres://...`);
- uma **service_role key** do Supabase (ela ignora RLS por completo). Este
  projeto não usa nenhuma — toda a aplicação fala com o Supabase só pela
  anon key, que respeita RLS.

Essas variáveis não existem no `.env.local.example` nem em nenhum arquivo
do repositório; se algum dia precisar delas (ex.: um script administrativo),
mantenha-as fora do código, em uma variável de ambiente sem prefixo
`NEXT_PUBLIC_`, usada apenas em código que roda no servidor.

## 8. Deploy na Vercel

1. Suba o repositório para o GitHub (branch `master`/`main` atualizada).
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório —
   a Vercel detecta o Next.js automaticamente, não precisa de configuração
   extra de build.
3. Em **Environment Variables**, adicione (ambiente Production, e também
   Preview se for usar):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. A cada push na branch principal, a Vercel gera um novo deploy
   automaticamente.
5. **Depois do primeiro deploy**, configure a URL de produção no Supabase
   (senão login/cadastro funcionam, mas o link do e-mail de confirmação
   redireciona para `localhost`):
   - **Authentication → URL Configuration → Site URL**: coloque a URL da
     Vercel (ex.: `https://seu-app.vercel.app`).
   - **Authentication → URL Configuration → Redirect URLs**: adicione a
     mesma URL (e `http://localhost:3000` também, se for continuar
     testando localmente).
6. As migrações em `supabase/migrations/` são aplicadas direto no projeto
   Supabase (SQL Editor), não fazem parte do build da Vercel — rode-as uma
   vez no projeto de produção antes ou logo depois do primeiro deploy.

## Scripts

```bash
npm run dev     # ambiente de desenvolvimento (Turbopack)
npm run build   # build de produção
npm run start   # servir o build de produção
npm run lint    # ESLint
```

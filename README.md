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
    (marketing)/        landing page pública ("/")
    (auth)/login/        login
    (auth)/signup/        criar conta
    dashboard/            área autenticada (protegida pelo proxy/middleware)
      page.tsx            visão geral: cards + gráfico por categoria
      transacoes/         CRUD de transações, filtros, busca, export CSV
      parcelamentos/       compras parceladas + renda futura comprometida
  components/
    dashboard/            componentes da área logada
    auth/                 formulários de login/cadastro
    ui/                   componentes shadcn/ui
  lib/
    actions/               Server Actions (mutações: criar/editar/excluir)
    data/                   funções de leitura (Server Components)
    supabase/               clients (browser, server, middleware)
    types/                  tipos TypeScript do banco
supabase/
  schema.sql               tabelas, índices, RLS
  seed.sql                 categorias e subcategorias padrão
```

## 6. Modelo de dados (resumo)

- **categories / subcategories** — dados de referência (somente leitura no
  app), compartilhados por todos os usuários autenticados.
- **transactions** — receitas e despesas do usuário. Despesas têm uma
  `expense_kind`: `variavel`, `fixa`, `parcelada_cartao` ou `parcelada_boleto`.
- **purchases** — uma compra parcelada (cartão ou boleto). Ao criar, o app
  gera automaticamente uma linha em `transactions` para cada parcela (uma por
  mês), permitindo saber exatamente quantas parcelas já foram pagas, quantas
  estão pendentes e até quando a renda futura está comprometida.

Toda leitura/escrita é protegida por Row Level Security: cada usuário só
acessa `transactions` e `purchases` onde `user_id = auth.uid()`.

## 7. Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Configure as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` no projeto da Vercel.
4. Deploy. A cada push na branch principal, a Vercel gera um novo deploy
   automaticamente.

## Scripts

```bash
npm run dev     # ambiente de desenvolvimento (Turbopack)
npm run build   # build de produção
npm run start   # servir o build de produção
npm run lint    # ESLint
```

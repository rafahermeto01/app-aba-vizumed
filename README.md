# LovABA

Web app para clínicas de terapia ABA: cadastro de aprendizes, programas de ensino, coleta de dados durante a sessão (funciona sem internet) e visualização da evolução.

- Especificação do produto: [`docs/product.md`](docs/product.md)
- Arquitetura aprovada (pastas, banco, segurança): [`docs/etapa-0-arquitetura.md`](docs/etapa-0-arquitetura.md)

## Situação das fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Projeto, banco completo + RLS, dados fictícios, primeiro Coordenador, login, troca obrigatória de senha, layout | ✅ pronta |
| 2. Equipe e aprendizes | Convites, perfis, cadastro de aprendizes | ⏳ |
| 3. Programas | Níveis de ajuda, biblioteca, programas, alvos, playlists | ⏳ |
| 4. Coleta offline | Os 6 passos da coleta, fila de sincronização, assinatura | ⏳ |
| 5. Evolução | Gráficos, sessões, maestria | ⏳ |
| 6. Acabamento | PWA instalável, revisão final, deploy | ⏳ |

---

## Como rodar no seu computador

Você precisa do **Node.js 22** ou mais novo ([nodejs.org](https://nodejs.org)).

### 1. Criar o projeto no Supabase

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Nome: `lovaba-dev` (este é o projeto de **testes**, com dados fictícios). Região: **South America (São Paulo)**.
3. Guarde a senha do banco num lugar seguro.

> Mais tarde, para uso real, crie um segundo projeto `lovaba-prod` e repita os passos **sem** rodar o `seed:demo`.

### 2. Ajustar o login no painel do Supabase

Em **Authentication**:

- **Sign In / Providers** → desligue **Allow new users to sign up** (não existe cadastro público).
- **Sign In / Providers → Email** → **Minimum password length**: `8`.
- **URL Configuration**:
  - **Site URL**: `http://localhost:5173` (depois, o endereço da Vercel)
  - **Redirect URLs**: adicione `http://localhost:5173/redefinir-senha` (e depois `https://SEU-APP.vercel.app/redefinir-senha`)
- **Sessions**: deixe sem limite de tempo ("Time-box user sessions" desligado), para a terapeuta não ser deslogada no meio de um atendimento.

### 3. Criar o arquivo `.env.local`

Copie o `.env.example` para um arquivo novo chamado `.env.local` (na mesma pasta) e preencha. Os valores ficam em **Project Settings → API Keys** no Supabase.

| Variável | O que é | Vai para o navegador? |
|---|---|---|
| `VITE_SUPABASE_URL` | Endereço do projeto (`https://xxxx.supabase.co`) | sim (é público) |
| `VITE_SUPABASE_ANON_KEY` | Chave **pública** (`anon` ou `sb_publishable_…`) | sim (é pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave **secreta** (`service_role` ou `sb_secret_…`). Só para os scripts | **NUNCA** |
| `FIRST_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` | Primeiro(a) Coordenador(a) | não |
| `FIRST_CLINIC_NAME` | Nome da clínica (opcional) | não |
| `DEMO_PASSWORD` | Senha das 4 contas fictícias de teste | não |

> ⚠️ O `.env.local` nunca vai para o GitHub (está no `.gitignore`). Nunca coloque a chave secreta numa variável que começa com `VITE_`. O app se recusa a abrir se isso acontecer.

### 4. Instalar e criar o banco

Num terminal, dentro da pasta do projeto:

```bash
npm install
```

```bash
npx supabase login
```

```bash
npm run db:link
```

(escolha o projeto `lovaba-dev` na lista)

```bash
npm run db:push
```

Isso cria todas as tabelas, regras de segurança, pastas de arquivos e a lista de CIDs.

### 5. Dados de teste e primeiro(a) Coordenador(a)

Só no projeto de **testes**, crie os dados fictícios:

```bash
npm run seed:demo
```

Contas criadas (senha = `DEMO_PASSWORD`): `coordenadora@demo.lovaba.test`, `supervisora@demo.lovaba.test`, `ana.at@demo.lovaba.test`, `bruno.at@demo.lovaba.test`.

Crie a sua conta de Coordenador(a) (lê `FIRST_ADMIN_*` do `.env.local`):

```bash
npm run admin:create
```

Depois apague `FIRST_ADMIN_PASSWORD` do `.env.local`.

### 6. Abrir o app

```bash
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

---

## Testes

| Comando | O que verifica | Precisa do Supabase? |
|---|---|---|
| `npm test` | Cálculos, CPF, iniciais, datas | não |
| `npm run test:db` | Todas as regras de segurança, num banco temporário no seu computador | não |
| `npm run test:rls` | As regras no projeto real de testes, entrando como a AT fictícia | sim (depois do `seed:demo`) |
| `npm run typecheck` | Erros de tipo no código | não |

---

## "Esqueci minha senha": configurar e-mail próprio (SMTP)

O envio de e-mails padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para testes. Para uso real, use um serviço de e-mail, por exemplo o **Resend**:

1. Crie uma conta em [resend.com](https://resend.com) e adicione o domínio da clínica (ex.: `clinica.com.br`), seguindo as instruções de DNS.
2. Em **API Keys**, crie uma chave.
3. No Supabase: **Authentication → Emails → SMTP Settings** → ative **Custom SMTP**:
   - Host: `smtp.resend.com` · Porta: `465` · Usuário: `resend` · Senha: a chave do Resend
   - Remetente: `nao-responda@clinica.com.br` · Nome: `LovABA`
4. Em **Authentication → Emails → Templates → Reset Password**, traduza o texto do e-mail para português.

---

## Publicar na Vercel

(O passo a passo final vem na fase 6.)

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório do GitHub.
2. Framework: **Vite** (detectado sozinho).
3. Em **Environment Variables**, adicione **só** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (do projeto de produção).
4. **Deploy**. Depois, coloque o endereço da Vercel em **Site URL** e **Redirect URLs** no Supabase (passo 2).

---

## Estrutura

```
docs/        especificação e arquitetura
scripts/     scripts locais (primeiro admin, dados fictícios, teste de RLS)
supabase/    migrations do banco (tabelas, RLS, storage, views)
src/         o app (features/ por área, components/, lib/)
tests/       testes (unit/ e db/)
```

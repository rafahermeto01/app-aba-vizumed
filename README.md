# LovABA

Web app para clínicas de terapia ABA: cadastro de aprendizes, programas de ensino, coleta de dados durante a sessão (funciona sem internet) e visualização da evolução.

- Especificação do produto: [`docs/product.md`](docs/product.md)
- Arquitetura aprovada (pastas, banco, segurança): [`docs/etapa-0-arquitetura.md`](docs/etapa-0-arquitetura.md)

## Situação das fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1. Fundação | Projeto, banco completo + RLS, dados fictícios, primeiro Coordenador, login, troca obrigatória de senha, layout | ✅ pronta |
| 2. Equipe e aprendizes | Equipe (cadastrar, editar, redefinir senha, desativar), Meu perfil, aprendizes (lista, cadastro, página), responsáveis, CIDs, equipe vinculada, consentimento LGPD, dados da clínica | ✅ pronta |
| 3. Programas | Níveis de ajuda (ordem, nomes, cores), biblioteca com pastas e filtros, programas do aprendiz (da biblioteca ou do zero), alvos com fila e fases, masterizar/manutenção, playlists, histórico de mudanças | ✅ pronta |
| 4. Coleta offline | Os 6 passos da coleta, cada toque salvo no aparelho, fila de sincronização sem duplicar, retomar sessão, assinatura, resumo, app abre sem internet | ✅ pronta |
| 5. Evolução | Aba Desempenho (período, números, gráfico Aquisição/Redução), gráfico por alvo colorido pelo nível de ajuda, lista de sessões agrupada com filtros, detalhe da sessão com correções auditadas, prontos para masterizar e revisões de manutenção na tela inicial | ✅ pronta |
| 6. Acabamento | PWA instalável (ícone, nome, telas de abertura), ajuda para instalar, aviso de nova versão, app mais leve, revisão de acessibilidade (WCAG 2.1 AA), cabeçalhos de segurança, publicação na Vercel | ✅ pronta |

---

## Como rodar no seu computador

Você precisa do **Node.js 22** ou mais novo ([nodejs.org](https://nodejs.org)).

### 1. Criar o projeto no Supabase

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Nome: `lovaba-dev` (este é o projeto de **testes**, com dados fictícios). Região: **South America (São Paulo)**.
3. Guarde a senha do banco num lugar seguro.

> Para uso real, veja a seção **Publicar para uso real** (um segundo projeto, só com dados reais).

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
| `SUPABASE_ACCESS_TOKEN` | Chave da ferramenta do Supabase só para este projeto (opcional, ver abaixo) | **NUNCA** |

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

Depois, publique a função do servidor que gerencia a equipe (criar membros, redefinir senha, desativar):

```bash
npm run fn:deploy
```

> **Login da ferramenta do Supabase trocando sozinho?** Se você usa o Supabase em outros projetos, outro programa pode trocar a conta conectada. Para evitar isso, crie uma chave só deste projeto em **supabase.com → Account → Access Tokens → Generate new token** (escopo: só o projeto do LovABA) e coloque em `SUPABASE_ACCESS_TOKEN` no `.env.local`. Os comandos `npm run db:*` e `fn:deploy` usam essa chave automaticamente.

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
| `npm test` | Cálculos, CPF, iniciais, datas, e a fila de sincronização (offline, recarregar, reenviar sem duplicar, ordem de envio) | não |
| `npm run test:db` | Todas as regras de segurança, num banco temporário no seu computador | não |
| `npm run test:rls` | As regras no projeto real de testes, entrando como a AT fictícia (não vê quem não atende, não muda programas, nível de ajuda nem maestria) | sim (depois do `seed:demo`) |
| `npm run test:equipe` | Gestão de equipe: só a coordenação cria membros, troca obrigatória de senha, desativação | sim (depois do `seed:demo` e `fn:deploy`) |
| `npm run test:fotos` | Fotos em pasta privada: só quem atende o aprendiz abre a foto | sim (depois do `seed:demo`) |
| `npm run test:offline` | **Coleta sem internet num Chrome de verdade**: registra offline, recarrega a página, finaliza, volta a internet e confere no banco que tudo chegou sem duplicar | sim (depois do `seed:demo`; usa o Chrome instalado) |
| `npm run test:a11y` | **Acessibilidade (WCAG 2.1 AA)** em todas as telas, no celular e no computador, e se a política de segurança bloqueia algo do app | sim (depois do `seed:demo`; usa o Chrome instalado) |
| `npm run typecheck` | Erros de tipo no código | não |

---

## Como a equipe entra no sistema

1. A coordenação vai em **Configurações → Equipe → Adicionar membro**: nome, e-mail, perfil de acesso e uma senha provisória (o sistema sugere uma).
2. A tela mostra o e-mail e a senha provisória para repassar à pessoa (botão **Copiar dados**).
3. No primeiro acesso, a pessoa é obrigada a criar uma senha nova antes de ver qualquer tela.
4. Esqueceu a senha? A própria pessoa usa **Esqueci minha senha** (e-mail) ou a coordenação usa **Redefinir senha** (nova senha provisória).
5. **Desativar acesso** corta o acesso na hora; as sessões que a pessoa registrou continuam guardadas.

Para um aprendiz aparecer para alguém, a coordenação marca essa pessoa em **Equipe** no cadastro do aprendiz.

---

## Como funcionam os programas

- **Biblioteca** (menu Biblioteca, coordenação e supervisão): modelos de programas com objetivo, procedimento, tipo de medida (Tentativa, Frequência ou Duração), aquisição/redução, protocolo, alvos sugeridos e critério de maestria. Organize em pastas.
- **Programa do aprendiz** (página do aprendiz → Programas → Novo programa): escolha um modelo ou crie do zero. O programa vira uma **cópia própria**: mudar o modelo depois não altera o programa do aprendiz.
- **Alvos** ficam em quatro grupos: **Em intervenção**, **Na fila**, **Manutenção** e **Masterizados**. Toque na etiqueta colorida do nível de ajuda para mudar com um toque (vale a partir da próxima sessão).
- **Masterizar**: o alvo vai para Masterizados ou para Manutenção (com revisão a cada N dias), e o **próximo da fila entra em intervenção sozinho**. O selo “Pronto para masterizar” aparece quando o critério é atingido, mas **quem decide é a supervisão**.
- **Histórico**: toda mudança de nível e de fase fica registrada (quem, quando, de onde para onde).
- **Playlists**: grupos de programas para iniciar a sessão com um toque.
- **Níveis de ajuda** (Configurações → Níveis de ajuda, só coordenação): ordem, nomes, siglas e cores. Verde, amarelo e vermelho ficam reservados para acerto, dica e erro.

---

## Coleta (sessão) e funcionamento sem internet

**Como registrar:** página do aprendiz → aba **Sessões** → botão **Registrar sessão** → escolha os programas (os da última sessão já vêm marcados; também dá para usar uma **playlist**) → **Ver resumo** → **Registrar** (o cronômetro começa) → toque **−**, **DICA** ou **+** em cada alvo → **Finalizar** (checklist, avaliação, notas e assinatura) → resumo da sessão.

**Nenhum dado se perde:**
- Cada toque é salvo **primeiro no aparelho** e entra numa fila. Depois vai para o servidor, sozinho, quando houver internet (ao voltar a conexão, ao reabrir o app e a cada 5 segundos com pendências).
- No topo da coleta: **Salvo** (verde, tudo no servidor), **Salvo no aparelho, sincronizando…** (amarelo) ou **Sem internet, salvo no aparelho** (cinza).
- Reenviar nunca duplica (cada registro tem um código único gerado no aparelho).
- Se o navegador fechar ou a bateria acabar, ao abrir o app aparece **Sessão em andamento → Continuar**, exatamente de onde parou.
- **Desfazer** não apaga: marca o toque como desfeito (ele some da conta, mas fica rastreável).
- Ao tentar **Sair** da conta com registros ainda não enviados, o app avisa.

**Abrir sem internet:** depois do primeiro acesso com internet, o app fica guardado no aparelho e baixa sozinho os aprendizes e programas de quem está logado.

---

## Evolução (gráficos e sessões)

- **Desempenho** (página do aprendiz): escolha o período (padrão: últimos 30 dias). Mostra sessões realizadas, programas concluídos, alvos masterizados e o % de acerto independente, sempre com o número de tentativas. Em **Aquisição**, o gráfico de % por sessão; em **Redução**, um gráfico por programa (ocorrências por sessão, com a média por hora ao tocar na barra).
- **Gráfico por alvo** (programa → aba **Evolução**): % de acerto independente por sessão com o **fundo colorido pelo nível de ajuda** daquela sessão (a sigla aparece escrita em cada faixa), **linhas tracejadas onde o nível mudou** e a linha do critério de maestria. Mostra também quantas tentativas foram feitas em cada nível.
- **Sessões** (página do aprendiz): agrupadas em “Nesta semana”, “Semana passada” e por mês, com filtros de período, aplicador e situação. Toque numa sessão para ver tudo: tentativas, ajuda usada nas DICAs, notas, avaliação e assinatura.
- **Correções**: supervisão vinculada e coordenação podem corrigir uma sessão finalizada (notas, avaliação, resultado de uma tentativa, remover/restaurar tentativa). Cada correção fica registrada (quem, quando, de quê para quê) na própria sessão. Só a coordenação exclui uma sessão (exclusão lógica).
- **Tela inicial**: **Prontos para masterizar** (supervisão e coordenação; o sistema só sugere) e **Revisões de manutenção** do dia.

---

## "Esqueci minha senha": configurar e-mail próprio (SMTP)

O envio de e-mails padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para testes. Para uso real, use um serviço de e-mail, por exemplo o **Resend**:

1. Crie uma conta em [resend.com](https://resend.com) e adicione o domínio da clínica (ex.: `clinica.com.br`), seguindo as instruções de DNS.
2. Em **API Keys**, crie uma chave.
3. No Supabase: **Authentication → Emails → SMTP Settings** → ative **Custom SMTP**:
   - Host: `smtp.resend.com` · Porta: `465` · Usuário: `resend` · Senha: a chave do Resend
   - Remetente: `nao-responda@clinica.com.br` · Nome: `LovABA`
4. Em **Authentication → Emails → Templates → Reset Password**, troque o texto por algo em português, por exemplo:
   - Assunto: `Redefinir sua senha do LovABA`
   - Mensagem: `<p>Olá! Para criar uma senha nova no LovABA, toque no link abaixo:</p><p><a href="{{ .ConfirmationURL }}">Criar nova senha</a></p><p>Se você não pediu, ignore este e-mail.</p>`

---

## Instalar no celular (PWA)

O LovABA é um **PWA**: instala direto pelo navegador, sem App Store nem Google Play. Fica com ícone na tela inicial, abre em tela cheia e funciona sem internet. No app, o menu da sua foto tem **Instalar o app** com o passo a passo, e no celular aparece um aviso na tela inicial.

- **Android (Chrome):** toque em **Instalar** no aviso do app, ou no menu ⋮ → **Instalar app**.
- **iPhone/iPad (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**. (No iPhone, só pelo Safari.)
- **Computador (Chrome/Edge):** ícone de instalar no fim da barra de endereço.

**Atualizações:** quando sai uma versão nova, aparece **"Nova versão do LovABA disponível · Atualizar"** nas telas comuns. O app **nunca recarrega sozinho durante uma sessão de coleta**.

> Ícones e telas de abertura: `public/icons/`. Para trocar o desenho, edite `scripts/generate-icons.mjs` e rode `node scripts/generate-icons.mjs`.

---

## Publicar para uso real (produção)

Use um projeto do Supabase **separado** do de testes, só com dados reais (nunca rode o `seed:demo` nele).

### 1. Supabase de produção

1. Em [supabase.com](https://supabase.com) → **New project** → nome `lovaba-prod`, região **South America (São Paulo)** (os dados de saúde ficam no Brasil e o app fica mais rápido).
2. Recomendado: plano **Pro**, que tem backup diário automático. Para dados clínicos, vale a pena.
3. Faça os ajustes de login do passo 2 de "Como rodar no seu computador" (sem cadastro público, senha mínima 8, sessão sem limite de tempo).
4. Configure o e-mail próprio (SMTP), na seção abaixo, para o "Esqueci minha senha" funcionar sem limite.

### 2. Arquivo `.env.producao.local`

Copie o `.env.example` para um arquivo novo chamado `.env.producao.local` e preencha com os dados do projeto **de produção**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` (uma chave em **Account → Access Tokens** com acesso só ao projeto de produção) e `FIRST_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` / `FIRST_CLINIC_NAME`. Esse arquivo também nunca vai para o GitHub.

### 3. Criar o banco, a função da equipe e a sua conta

```bash
npm run prod:db:push
```

```bash
npm run prod:fn:deploy
```

```bash
npm run prod:admin:create
```

Depois apague `FIRST_ADMIN_PASSWORD` do `.env.producao.local`.

### 4. Vercel

1. Em [vercel.com](https://vercel.com) (pode entrar com o GitHub) → **Add New → Project** → importe o repositório `app-aba-vizumed`.
2. Framework: **Vite** (detectado sozinho; as configurações já estão no `vercel.json`).
3. Em **Environment Variables**, adicione **só** estas duas, do projeto **de produção**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (a chave **pública**)

   ⚠️ Nunca coloque a chave secreta na Vercel.
4. **Deploy**. Em 1 a 2 minutos sai um endereço como `https://lovaba.vercel.app` (dá para trocar por um domínio próprio em **Settings → Domains**).
5. No Supabase de produção → **Authentication → URL Configuration**:
   - **Site URL**: o endereço da Vercel
   - **Redirect URLs**: `https://SEU-ENDERECO/redefinir-senha`
6. Abra o endereço no celular, entre com a sua conta e instale o app.

A cada envio para o GitHub (`main`), a Vercel publica a versão nova sozinha, e os aparelhos mostram o aviso **Atualizar**.

### Segurança já configurada

- Todas as tabelas com regras de acesso (RLS); a chave secreta só existe nos scripts do seu computador e na função do servidor.
- Cabeçalhos de segurança no `vercel.json`: o app só conversa com o Supabase (Content-Security-Policy), não pode ser aberto dentro de outro site, HTTPS obrigatório, sem acesso a câmera, microfone ou localização.
- Fotos e assinaturas em pastas privadas, abertas só por link temporário.

---

## Estrutura

```
docs/        especificação e arquitetura
scripts/     scripts locais (primeiro admin, dados fictícios, testes no projeto real, ícones)
supabase/    migrations do banco (tabelas, RLS, storage, views) e a função admin-users
src/         o app (features/ por área, components/, lib/, offline/ = cofre do aparelho, pwa/)
public/      ícones e telas de abertura do app
tests/       testes (unit/, db/ e e2e/ — o teste da coleta sem internet)
```

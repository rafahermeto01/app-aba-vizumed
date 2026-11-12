# PROMPT: LovABA, sistema de coleta e evolução ABA (web app)

Você vai construir comigo, do zero, o **LovABA**: um web app para uma clínica de terapia ABA (Análise do Comportamento Aplicada) que atende crianças, a maioria com TEA. O sistema substitui o uso que a clínica faz hoje de uma plataforma de mercado, mas com escopo enxuto: **cadastro de pacientes, programas de ensino, coleta de dados durante a sessão e visualização da evolução**. Nada além disso nesta versão.

Eu não sou programador. Trabalhe em fases, explique em linguagem simples o que fez em cada uma, me diga exatamente como testar, e só avance para a próxima fase quando eu aprovar.

---

## 0. Regras de trabalho (leia antes de tudo)

1. **Antes de escrever código**, me mostre: a estrutura de pastas, o schema completo do banco (tabelas, colunas, relações) e as políticas de segurança (RLS). Espere minha aprovação.
2. Construa **uma fase por vez** (seção 8). No fim de cada fase: rode o projeto, corrija erros de build e de tipos, e me passe um roteiro de teste passo a passo.
3. **Use apenas dados fictícios** em seeds, testes e exemplos. Nunca nomes reais de crianças.
4. Toda a interface em **português do Brasil**. Datas em DD/MM/AAAA, fuso America/Sao_Paulo.
5. Se algo deste documento estiver ambíguo, **pergunte** em vez de assumir.
6. Nunca coloque a chave `service_role` do Supabase no frontend. Todas as tabelas com RLS ativado, sem exceção.
7. Mantenha um `README.md` atualizado com: como rodar localmente, variáveis de ambiente e como publicar.

---

## 1. Quem usa o sistema

A clínica tem uma equipe com perfis diferentes. Mais de uma pessoa coleta dados do mesmo paciente.

| Perfil | O que faz |
|---|---|
| **Coordenador(a)** | Dona/gestora da clínica. Acesso total: equipe, pacientes, programas, sessões, relatórios. |
| **Supervisor(a)** | Analista do comportamento. Cria e ajusta programas e alvos, muda níveis de ajuda, masteriza alvos, analisa a evolução. Vê os pacientes aos quais está vinculado(a). |
| **Terapeuta / AT / Estagiária** | Aplica as sessões e registra os dados. Vê **apenas os pacientes aos quais está vinculada**. Não cria nem edita programas, não apaga sessões. |

Pais e responsáveis **não acessam** o sistema.

**Contexto de uso crítico:** a coleta acontece **durante o atendimento**, com o celular ou o notebook ao lado da terapeuta, enquanto ela está com a criança. Cada interação precisa ser de **um toque**, com botões grandes, sem formulários longos e sem risco de perder dados.

---

## 2. Stack (obrigatória)

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query
- **Backend:** Supabase (Postgres, Auth, Storage, RLS). Projeto criado na região **São Paulo (sa-east-1)**
- **Offline:** IndexedDB via **Dexie**, PWA via **vite-plugin-pwa**
- **Gráficos:** Recharts
- **Assinatura:** react-signature-canvas
- **Deploy:** Vercel

---

## 3. Autenticação

- Login por **e-mail + senha** (Supabase Auth). Senha com no mínimo 8 caracteres.
- **Não existe cadastro público.** A tela de login não tem botão "criar conta".
- **Primeiro usuário (Coordenador):** eu vou te informar o e-mail e a senha. **Não escreva essas credenciais em nenhum arquivo do código nem em commits.** Crie um script `scripts/create-first-admin.ts` que lê `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD` e `FIRST_ADMIN_NAME` do arquivo `.env.local` (que está no `.gitignore`), cria a clínica e o usuário com perfil Coordenador, e roda uma única vez. Me diga exatamente onde colocar os valores e como rodar.
- **Demais membros:** o(a) Coordenador(a) cadastra na tela de Equipe (nome, e-mail, perfil, **senha provisória**). No primeiro login, o sistema **obriga a troca da senha** antes de liberar qualquer tela. A criação de usuários roda numa **Supabase Edge Function** (a chave `service_role` fica só no servidor).
- Coordenador(a) pode **desativar** um membro (ele perde o acesso na hora, mas o histórico de sessões dele continua) e **redefinir a senha provisória** de alguém.
- "Esqueci minha senha": link de redefinição por e-mail. No README, explique como configurar um SMTP próprio (ex.: Resend) no Supabase, porque o envio padrão de e-mails do Supabase tem limite baixo.
- Sessão longa: a terapeuta não pode ser deslogada no meio de um atendimento.

---

## 4. Modelo de dados

Tudo pertence a uma **clínica** (`clinic_id` em todas as tabelas), mesmo que hoje exista só uma. Isso permite vender para outras clínicas depois sem refazer o banco.

Toda tabela tem `id` (uuid), `created_at`, `updated_at`, `created_by`. Exclusões são **lógicas** (`deleted_at`), nunca apagar dado clínico de verdade.

### Pessoas
- **clinics**: nome, logo.
- **profiles**: usuário (ligado ao auth.users), clinic_id, nome, e-mail, foto, `role` (coordenador | supervisor | aplicador), ativo.
- **learners** (aprendizes/pacientes): nome completo, **iniciais (geradas automaticamente do nome, editáveis)**, CPF (opcional, com máscara e validação), data de nascimento, foto (opcional), observações, ativo.
- **cid_codes**: tabela de referência com código e descrição. Seed com os códigos mais usados em clínicas ABA (família F84, F90, F80 e outros relevantes) e permitir que a coordenação adicione códigos.
- **learner_cids**: um aprendiz pode ter vários CIDs.
- **guardians** (responsáveis): learner_id, nome, parentesco, telefone, e-mail.
- **learner_team**: vínculo entre aprendiz e membros da equipe. **É esse vínculo que faz o paciente aparecer para cada profissional.**
- **consents**: registro do consentimento LGPD do responsável (learner_id, quem registrou, data/hora, texto aceito).

### Programas e alvos
- **prompt_levels** (níveis de ajuda): lista **configurável por clínica**, com nome, sigla, cor e ordem (da maior ajuda para a independência). Seed padrão, editável:
  1. Ajuda física total (AFT)
  2. Ajuda física parcial (AFP)
  3. Modelo (demonstração) (MOD)
  4. Duas opções (2OP)
  5. Dica gestual (GES)
  6. Dica verbal (VER)
  7. Independente (IND)
- **program_templates** (biblioteca da clínica): nome, objetivo (até 500 caracteres), descrição/procedimento (texto rico simples), **tipo de medida**, **objetivo** (aquisição | redução), protocolo de referência (opcional: VB-MAPP, ABLLS-R, Denver/ESDM, PEAK, AFLS, Portage, Marcos do Comportamento Verbal, outro), categoria, critério de maestria padrão.
- **Tipos de medida nesta versão:**
  - **Tentativa** (principal): cada tentativa é registrada como `+`, `−` ou `Dica`.
  - **Frequência**: contador de ocorrências (usado em programas de redução, ex.: fugas, birras).
  - **Duração**: cronômetro iniciar/parar por ocorrência.
  - Deixe o código preparado para depois adicionar "Análise de tarefas" e "Múltiplas instruções", mas **não implemente agora**.
- **learner_programs**: programa atribuído a um aprendiz (copiado de um template ou criado direto). Guarda uma cópia própria dos campos, para que editar o template não altere o histórico do paciente. Status: ativo | pausado | concluído. Critério de maestria próprio (herdado do template, editável).
- **targets** (alvos): pertencem a um learner_program. Nome (ex.: "Boi"), **posição na fila**, **nível de ajuda atual** (FK para prompt_levels), status:
  - `fila` (aguardando)
  - `intervencao` (em treino)
  - `manutencao` (já dominado, revisado periodicamente; guardar `next_maintenance_date`)
  - `masterizado` (concluído)
- **target_prompt_history**: log de toda mudança de nível de ajuda (alvo, nível anterior, nível novo, quem mudou, quando).
- **target_status_history**: log de toda mudança de status do alvo.
- **playlists**: conjunto nomeado de programas de um aprendiz (ex.: "PDI 2026"), para iniciar a sessão com um toque.

### Sessões e coleta
- **sessions**: learner_id, aplicador (profile_id), início, fim, duração, status (em_andamento | finalizada), avaliação geral (1 a 5), notas da sessão (texto livre, "registro de evolução diária"), assinatura do aplicador (imagem no Storage), assinatura do responsável técnico (opcional), `client_id` (uuid gerado no aparelho, para sincronização sem duplicar), número sequencial por aprendiz (Sessão #24).
- **session_programs**: quais programas foram aplicados na sessão.
- **trials** (registros de coleta): session_id, target_id, `result` (`acerto` | `erro` | `dica`), `prompt_level_id` (**snapshot** do nível de ajuda no momento do registro), valor numérico para frequência/duração, timestamp, `client_id` (uuid do aparelho, único).

> Regra importante: o nível de ajuda é salvo **em cada tentativa**. Assim o gráfico mostra a evolução real mesmo depois que o supervisor muda o nível do alvo.

---

## 5. Permissões (RLS)

- Ninguém vê dados de outra clínica.
- **Aplicador:** lê só aprendizes em que está em `learner_team`; lê os programas e alvos deles; cria sessões e trials apenas para esses aprendizes; edita só as próprias sessões **enquanto estiverem em andamento**. Depois de finalizada, a sessão fica somente leitura para ele.
- **Supervisor:** tudo do aplicador + cria/edita programas, alvos, níveis de ajuda e status dos aprendizes vinculados. Pode corrigir uma sessão finalizada, e a correção fica registrada (quem, quando, o que mudou).
- **Coordenador:** tudo da clínica, incluindo equipe, convites, biblioteca, níveis de ajuda e CIDs.
- **Storage:** buckets **privados** para fotos e assinaturas, acesso apenas por URL assinada.
- Crie um script de teste que prove as políticas: um aplicador **não** consegue ler um paciente ao qual não está vinculado.

---

## 6. Telas

Duas experiências: **gestão** (pensada para computador, funciona no celular) e **coleta** (pensada para celular, funciona no computador).

### 6.1 Gestão (Coordenador / Supervisor)
1. **Início:** saudação, nº de aprendizes, última sessão realizada, lista de "alvos prontos para masterizar" (ver 7.2).
2. **Aprendizes:** lista com foto/iniciais, nome, última sessão ("há 22 horas"), data de cadastro; busca, filtro (ativos/inativos) e ordenação. Configuração da clínica para **exibir só as iniciais** nas listas (privacidade).
3. **Cadastrar/editar aprendiz:** dados pessoais, CID (busca com autocomplete), foto opcional, responsáveis (adicionar vários), equipe (lista com busca e checkbox), checkbox obrigatório de consentimento LGPD com o texto: *"Declaro que obtive o consentimento informado do responsável pelo(a) aprendiz para a coleta, armazenamento e uso de dados sensíveis, incluindo fotos, em conformidade com a LGPD."*
4. **Página do aprendiz**, com abas:
   - **Desempenho:** período (padrão 30 dias, editável), sessões realizadas, programas concluídos, alvos masterizados, gráfico de % de acertos independentes por sessão, alternância Aquisição / Redução.
   - **Programas:** lista dos programas com mini-gráfico das últimas 5 sessões, total de registros, nº de sessões, avatares de quem aplicou. Filtros: "apenas os meus", aplicador, tipo. Botões: novo programa (do zero ou da biblioteca), ordenar, playlists.
   - **Detalhe do programa:** alvos agrupados por status (Em intervenção, Na fila, Manutenção, Masterizados), cada um com nível de ajuda atual, % recente e ações: **mudar nível de ajuda**, **masterizar**, **mover para manutenção**, **reordenar fila**. Gráfico por alvo (ver 7.3).
   - **Sessões:** lista agrupada por "Nesta semana / Semana passada / mês", com nº da sessão, data/hora, duração, aplicador, nº de programas e alvos, % de acerto e um trecho das notas. Filtros: período, aplicador, status. Clicar abre o detalhe completo da sessão.
5. **Biblioteca de programas:** lista com busca, filtros por tipo, objetivo e protocolo, pastas/categorias. Formulário de modelo com abas: **Descrição** (nome, objetivo, procedimento, tipo, aquisição/redução, protocolo, categoria), **Alvos sugeridos**, **Critério de maestria**.
6. **Configurações:** dados da clínica, equipe e convites, níveis de ajuda (reordenar, renomear, cores), CIDs, preferência de exibir iniciais.

### 6.2 Coleta (todos os perfis), fluxo em 6 passos
1. **Aprendizes:** o aplicador vê só os seus pacientes. Toca no paciente → aba Sessões → botão flutuante **"Registrar sessão"**.
2. **Selecionar programas:** filtros **Última sessão** (pré-seleciona o que foi aplicado na última vez), **Playlists** e **Meus programas**. Cada programa mostra fase (Intervenção/Manutenção), quando foi aplicado e quem aplica. Botão "Ver resumo (N programas)" e opção "Registrar sem programas" (só notas).
3. **Confirmação:** "Pronto para registrar a sessão?" listando programas e alvos ativos. Botão **Registrar** inicia o cronômetro.
4. **Coleta:**
   - Topo fixo: contador de tentativas da sessão, cronômetro, botão de notas e botão de finalizar. Barra de progresso.
   - Cada alvo é um card com nome, nível de ajuda atual e fase. Programas agrupados, com etiqueta Aquisição/Redução.
   - **Tipo Tentativa:** três botões grandes (mínimo 56px): **`−`** (vermelho, erro), **`DICA`** (amarelo, acerto com ajuda), **`+`** (verde, acerto independente). Um toque = uma tentativa. Ao tocar em DICA, abrir seleção rápida do tipo de ajuda usado, já com o nível atual do alvo pré-selecionado (um toque confirma).
   - Abaixo dos botões, uma linha com as tentativas do alvo nesta sessão (ex.: `+ + D − +`) e a % em tempo real.
   - **Botão desfazer** sempre visível para a última marcação (toque errado acontece o tempo todo).
   - **Tipo Frequência:** botão grande "+1" com contador e desfazer.
   - **Tipo Duração:** botão iniciar/parar com lista das durações.
   - Feedback tátil (vibração) a cada toque, quando o aparelho suportar.
   - Manter a tela acesa durante a coleta (Wake Lock API).
5. **Notas da sessão:** campo de texto livre ("Registro de evolução diária"), com suporte ao ditado do teclado do celular.
6. **Finalizar:** resumo com aplicador, início, fim e duração; checklist (execução: programas concluídos? / avaliação da sessão / notas preenchidas); avaliação com 5 carinhas (Muito ruim, Ruim, Regular, Bom, Ótimo); **assinatura desenhada na tela** ("Desenhe aqui", botões Limpar e Finalizar) com o texto *"Ao prosseguir, declaro que sou responsável pelo lançamento dos dados e que assinei este registro de forma legítima."* Depois, tela de **resumo da sessão**: % de acerto independente, total de tentativas, cada programa com seus alvos e resultado. Botão "Voltar para a tela inicial".

---

## 7. Regras de negócio

### 7.1 Cálculos
- **% de acerto independente** = acertos `+` ÷ total de tentativas.
- **% de acerto total** = (`+` + `DICA`) ÷ total.
- **Distribuição de ajuda** = quantas tentativas em cada nível de ajuda.
- Para frequência: total por sessão e média por hora. Para duração: total e média por ocorrência.
- Mostre sempre o número de tentativas junto da % (50% de 2 tentativas não é igual a 50% de 20).

### 7.2 Maestria (o sistema sugere, o supervisor decide)
- Cada programa tem um critério configurável. Padrão: **≥ 80% de acerto independente em 3 sessões consecutivas, com no mínimo 5 tentativas por sessão**.
- Quando um alvo atinge o critério, ele ganha o selo **"Pronto para masterizar"** e aparece na tela inicial do supervisor. **Nunca masterizar automaticamente.**
- Ao masterizar: o alvo vai para "Masterizados" (ou "Manutenção", à escolha do supervisor, com frequência de revisão, ex.: a cada 7 dias) e o **próximo alvo da fila entra automaticamente em intervenção**.
- Alvos em manutenção aparecem para a coleta quando chegar a data da revisão, com a etiqueta "Manutenção".

### 7.3 Evolução de ajuda (prompt fading)
- O supervisor muda o nível de ajuda de um alvo com um toque. A mudança vale a partir da próxima sessão e aparece imediatamente no card de coleta.
- Gráfico por alvo: % de acerto independente por sessão (linha), com o **fundo ou os pontos coloridos pelo nível de ajuda vigente**, e linhas verticais marcando cada mudança de nível. É esse gráfico que mostra a criança saindo da ajuda física até chegar à independência.

### 7.4 Integridade
- Sessão em andamento pertence ao aplicador que a iniciou. Dois aplicadores podem ter sessões simultâneas do mesmo paciente (ex.: AT e terapeuta em salas diferentes).
- Sessões finalizadas são imutáveis para o aplicador. Correções do supervisor geram registro de auditoria.

---

## 8. Requisito crítico: nenhum dado pode ser perdido

Este é o requisito mais importante do sistema. Se uma sessão se perder, a clínica abandona o produto.

- **Cada toque é salvo primeiro no aparelho (IndexedDB/Dexie)** e entra numa fila de sincronização. Só depois vai para o Supabase.
- Todo registro carrega um `client_id` (uuid gerado no aparelho). O servidor faz **upsert** por esse id, então reenvios nunca duplicam dados.
- A fila sincroniza sozinha: ao voltar a conexão, ao reabrir o app e a cada poucos segundos enquanto houver pendências.
- Indicador sempre visível no topo da coleta: **"Salvo"** (verde, tudo sincronizado), **"Salvo no aparelho, sincronizando..."** (amarelo), **"Sem internet, salvo no aparelho"** (cinza). Nunca mostrar erro técnico para a terapeuta.
- Se o navegador fechar, a bateria acabar ou a página recarregar no meio da sessão, ao reabrir o app **retomar a sessão exatamente de onde parou**.
- Avisar antes de sair da tela de coleta com sessão em andamento.
- O app precisa abrir e funcionar sem internet depois do primeiro acesso (PWA com cache dos pacientes e programas do aplicador).
- Escreva testes para: registrar tentativas offline, recarregar a página, voltar online e conferir que tudo chegou ao banco sem duplicar.

---

## 9. Fora do escopo desta versão

Não construa: agenda, financeiro, faturamento, chat/conversas, feed ou mural, acesso para pais, avaliações padronizadas (VB-MAPP, ABLLS-R etc. como instrumentos), anamnese, upload de arquivos/laudos, relatórios em PDF, notificações, IA. Se achar que algo dessa lista é necessário para o resto funcionar, me pergunte.

---

## 10. Fases de construção

Ao fim de cada fase, pare, me mostre o que foi feito e como testar.

1. **Fundação:** projeto Vite + React + TS + Tailwind + shadcn, Supabase conectado, schema completo com migrations, RLS, seed com dados fictícios (1 clínica, 1 coordenadora, 1 supervisora, 2 ATs, 4 aprendizes fictícios, níveis de ajuda, 10 programas de exemplo), script do primeiro Coordenador (seção 3), login por e-mail e senha com troca obrigatória da senha provisória, layout base com menu lateral (desktop) e barra inferior (celular).
2. **Equipe e aprendizes:** convites, perfis, CRUD de aprendizes com responsáveis, CID, equipe vinculada e consentimento.
3. **Programas:** níveis de ajuda, biblioteca, atribuição de programas ao aprendiz, alvos com fila e status, playlists, histórico de mudanças.
4. **Coleta offline-first:** os 6 passos da seção 6.2, fila de sincronização, assinatura, resumo da sessão. **Esta é a fase mais importante: teste no celular, com o modo avião ligado.**
5. **Evolução:** aba Desempenho, gráficos por programa e alvo, lista e detalhe de sessões, sugestão de maestria, fluxo de masterizar e manutenção.
6. **Acabamento:** PWA instalável com o nome **LovABA** (ícone, nome, tela de abertura), estados vazios, carregamentos, mensagens de erro amigáveis, revisão de acessibilidade, README final e instruções de deploy na Vercel.

---

## 11. Design

- Nome do produto: **LovABA**, exibido no login, no menu e no título das páginas. Crie um logotipo simples em texto (com um pequeno ícone de coração ou folha), fácil de trocar depois.
- Visual limpo, claro e calmo (é ferramenta clínica, usada várias horas por dia). Cor primária azul, cards brancos com cantos arredondados, bastante espaço.
- Verde, amarelo e vermelho **reservados** para acerto, dica e erro, sem usar essas cores para outras coisas.
- Fonte legível, tamanho mínimo de 16px no celular.
- Tudo utilizável com uma mão no celular durante a sessão.

Comece pela etapa 0: me mostre a estrutura de pastas, o schema e as políticas de RLS, e espere minha aprovação.

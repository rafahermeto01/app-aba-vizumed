# LovABA · Etapa 0: estrutura, banco de dados e segurança

> Proposta para aprovação. **Nenhum código foi escrito ainda.**
> Baseado em [`docs/product.md`](product.md).

---

## 1. Estrutura de pastas

```
app-aba/
├── docs/                      Documentação (este arquivo, product.md)
├── public/                    Ícones do app, logotipo, manifest do PWA
├── scripts/                   Scripts que rodam no seu computador, nunca no navegador
│   ├── create-first-admin.ts  Cria a clínica + o(a) primeiro(a) Coordenador(a) (lê o .env.local)
│   ├── seed-demo.ts           Cria os dados fictícios (clínica demo, equipe, aprendizes, programas)
│   └── test-rls.ts            Prova que um aplicador NÃO vê paciente ao qual não está vinculado
├── supabase/                  Tudo do servidor
│   ├── migrations/            Criação do banco, em passos numerados
│   │   ├── 0001_base.sql          extensões, tipos, funções auxiliares
│   │   ├── 0002_pessoas.sql       clínicas, perfis, aprendizes, CIDs, responsáveis, equipe, consentimento
│   │   ├── 0003_programas.sql     níveis de ajuda, biblioteca, programas, alvos, históricos, playlists
│   │   ├── 0004_sessoes.sql       sessões, programas da sessão, tentativas, auditoria
│   │   ├── 0005_rls.sql           todas as regras de permissão
│   │   ├── 0006_storage.sql       pastas privadas de fotos e assinaturas
│   │   └── 0007_views.sql         cálculos prontos (maestria, % por sessão)
│   └── functions/
│       └── admin-users/       Edge Function: criar membro, desativar, redefinir senha provisória
├── src/                       O app (o que roda no navegador/celular)
│   ├── main.tsx · App.tsx · routes.tsx
│   ├── components/
│   │   ├── ui/                Componentes do shadcn/ui (botões, campos, diálogos…)
│   │   ├── layout/            Menu lateral (computador), barra inferior (celular)
│   │   └── brand/             Logotipo LovABA (fácil de trocar)
│   ├── features/              Uma pasta por área do sistema
│   │   ├── auth/              Login, troca obrigatória de senha, esqueci a senha
│   │   ├── home/              Tela inicial
│   │   ├── team/              Equipe
│   │   ├── learners/          Aprendizes (lista, cadastro, página com abas)
│   │   ├── programs/          Programas do aprendiz, alvos, playlists
│   │   ├── library/           Biblioteca de programas
│   │   ├── collection/        Coleta (os 6 passos)
│   │   ├── evolution/         Gráficos, sessões, maestria
│   │   └── settings/          Configurações da clínica
│   ├── offline/               O "cofre" do aparelho
│   │   ├── db.ts              Banco local (Dexie/IndexedDB)
│   │   ├── sync.ts            Fila de sincronização
│   │   └── useSyncStatus.ts   "Salvo" / "Sincronizando…" / "Sem internet"
│   ├── lib/
│   │   ├── supabase.ts        Conexão (só a chave pública "anon")
│   │   ├── metrics.ts         Cálculos de % (seção 7.1)
│   │   ├── mastery.ts         Regra de maestria (seção 7.2)
│   │   ├── dates.ts           DD/MM/AAAA, fuso America/Sao_Paulo
│   │   └── cpf.ts             Máscara e validação de CPF
│   └── types/database.ts      Tipos gerados automaticamente a partir do banco
├── tests/
│   ├── unit/                  Cálculos, maestria, CPF
│   └── e2e/                   Navegador automático: coleta offline → recarregar → online → conferir
├── .env.example               Modelo das variáveis (sem valores reais)
├── .env.local                 Seus valores reais (NUNCA vai para o GitHub)
└── README.md
```

---

## 2. Banco de dados

### 2.1 Colunas que toda tabela tem

| Coluna | Para quê |
|---|---|
| `id` (uuid) | Identificador único |
| `clinic_id` | A qual clínica pertence (exceto a própria tabela `clinics`) |
| `created_at`, `updated_at` | Quando foi criado / alterado (atualizado automaticamente) |
| `created_by` | Quem criou (preenchido automaticamente com o usuário logado) |
| `deleted_at` | Exclusão lógica: preenchido = "apagado", mas o dado continua guardado |

Nas tabelas abaixo, essas colunas ficam subentendidas.

### 2.2 Listas fixas (tipos)

| Tipo | Valores |
|---|---|
| `user_role` | `coordenador`, `supervisor`, `aplicador` |
| `measure_type` | `tentativa`, `frequencia`, `duracao` (depois: `analise_tarefas`, `multiplas_instrucoes`) |
| `program_goal` | `aquisicao`, `reducao` |
| `program_status` | `ativo`, `pausado`, `concluido` |
| `target_status` | `fila`, `intervencao`, `manutencao`, `masterizado` |
| `session_status` | `em_andamento`, `finalizada` |
| `trial_result` | `acerto` (+), `erro` (−), `dica` |
| `protocol` | `vbmapp`, `ablls_r`, `denver_esdm`, `peak`, `afls`, `portage`, `marcos_cv`, `outro` |

### 2.3 Pessoas

**clinics**: `name`, `logo_path`, `show_initials_only` (exibir só iniciais nas listas)

**profiles** (um por usuário; `id` = o mesmo do login)
| Coluna | Observação |
|---|---|
| `full_name`, `email`, `photo_path` | |
| `role` | coordenador / supervisor / aplicador |
| `active` | `false` = perde o acesso na hora; histórico continua |
| `must_change_password` | `true` até a pessoa trocar a senha provisória |

**learners** (aprendizes)
| Coluna | Observação |
|---|---|
| `full_name` | |
| `initials` | Gerada do nome ("Ana Beatriz Souza" → "ABS"), editável |
| `cpf` | Opcional; validado; único na clínica |
| `birth_date`, `photo_path`, `notes`, `active` | |
| `last_session_number` | Contador para "Sessão #24" (uso interno) |

**cid_codes**: `code`, `description`. Os códigos do seed (F84.0, F84.1, F84.5, F84.9, F90.0, F90.1, F80.1, F80.2, F70–F79, F81, F82, F88, F89, F93.0, F94…) ficam com `clinic_id` vazio (valem para todas as clínicas); os que a coordenação adicionar ficam com o `clinic_id` dela.

**learner_cids**: `learner_id`, `cid_code_id` (um aprendiz → vários CIDs)

**guardians** (responsáveis): `learner_id`, `name`, `relationship` (parentesco), `phone`, `email`

**learner_team** (vínculo aprendiz ↔ profissional): `learner_id`, `profile_id`. **É isto que define quem vê quem.**

**consents** (LGPD): `learner_id`, `guardian_id` (opcional), `consent_text` (cópia exata do texto aceito), `accepted_at`, `registered_by`. **Nunca é alterado nem apagado.**

### 2.4 Programas e alvos

**prompt_levels** (níveis de ajuda, por clínica): `name`, `abbreviation`, `color`, `sort_order`, `is_independent`. Seed: AFT → AFP → MOD → 2OP → GES → VER → IND.

**program_categories** (pastas da biblioteca): `name`, `sort_order`

**program_templates** (biblioteca)
| Coluna | Observação |
|---|---|
| `name` | |
| `objective` | Texto, até 500 caracteres |
| `procedure` | Texto rico simples (negrito, listas) |
| `measure_type` | tentativa / frequência / duração |
| `goal` | aquisição / redução |
| `protocol`, `protocol_other` | Opcional |
| `category_id` | Pasta |
| `mastery_min_pct` (80), `mastery_sessions` (3), `mastery_min_trials` (5) | Critério de maestria padrão |

**template_targets** (alvos sugeridos): `template_id`, `name`, `sort_order`

**learner_programs** (programa do aprendiz): `learner_id`, `template_id` (origem, opcional) + **cópia própria** de nome, objetivo, procedimento, tipo, finalidade, protocolo, categoria e critério de maestria; `status`; `sort_order`. Editar o modelo da biblioteca não muda nada aqui.

**targets** (alvos)
| Coluna | Observação |
|---|---|
| `learner_program_id`, `learner_id` | |
| `name` | Ex.: "Boi" |
| `queue_position` | Posição na fila |
| `current_prompt_level_id` | Nível de ajuda atual |
| `status` | fila / intervenção / manutenção / masterizado |
| `maintenance_interval_days`, `next_maintenance_date` | Para manutenção |
| `mastered_at` | |

**target_prompt_history**: `target_id`, `from_level_id`, `to_level_id`, `changed_by`, `changed_at`
**target_status_history**: `target_id`, `from_status`, `to_status`, `changed_by`, `changed_at`
→ Os dois são **preenchidos automaticamente pelo banco** sempre que o alvo muda. Ninguém escreve neles à mão, ninguém altera.

**playlists**: `learner_id`, `name` · **playlist_programs**: `playlist_id`, `learner_program_id`, `sort_order`

### 2.5 Sessões e coleta

**sessions**
| Coluna | Observação |
|---|---|
| `client_id` | uuid gerado no aparelho; **único**: reenviar nunca duplica |
| `learner_id`, `applicator_id` | |
| `number` | Sessão #24: atribuído pelo servidor quando a sessão chega (offline aparece "sincronizando") |
| `started_at`, `ended_at`, `duration_seconds` | |
| `status` | em andamento / finalizada |
| `rating` | 1 a 5 (carinhas) |
| `notes` | Registro de evolução diária |
| `applicator_signature_path` | Imagem no Storage privado |
| `supervisor_signature_path`, `supervisor_signed_by` | Responsável técnico, opcional |

**session_programs**: `session_id`, `learner_program_id`, `client_id`

**trials** (cada toque)
| Coluna | Observação |
|---|---|
| `client_id` | Único: reenviar nunca duplica |
| `session_id`, `target_id`, `learner_id` | |
| `result` | acerto / erro / dica (só no tipo Tentativa) |
| `prompt_level_id` | **Foto do nível de ajuda atual do alvo** no momento do toque |
| `help_level_id` | Ajuda **efetivamente usada** quando o toque foi DICA |
| `value` | Frequência: 1 por ocorrência · Duração: segundos |
| `started_at`, `recorded_at` | |
| `deleted_at` | O **Desfazer** marca aqui (o toque some da conta, mas fica rastreável) |

**session_audit** (correções do supervisor em sessão finalizada): `session_id`, `table_name`, `record_id`, `changed_by`, `changed_at`, `old_data`, `new_data`. Preenchido automaticamente pelo banco.

### 2.6 Cálculos prontos no banco (views)

- **session_target_stats**: por sessão e alvo, total de tentativas, nº de `+`, `DICA`, `−`, % independente, % total.
- **target_mastery**: para cada alvo em intervenção, verifica as últimas N sessões finalizadas contra o critério do programa → `ready_to_master` (sim/não). **Só sugere, nunca masteriza.**

As views respeitam as mesmas regras de permissão das tabelas.

### 2.7 Como as tabelas se ligam

```
clinics ─┬─ profiles ──────────────┐
         ├─ learners ─┬─ guardians │
         │            ├─ consents  │
         │            ├─ learner_cids ── cid_codes
         │            ├─ learner_team ─┘ (aprendiz ↔ profissional)
         │            ├─ playlists ── playlist_programs ─┐
         │            ├─ learner_programs ───────────────┴─ targets ─┬─ target_prompt_history
         │            │       ↑ (cópia de)                           └─ target_status_history
         │            └─ sessions ─┬─ session_programs
         │                         ├─ trials (→ targets, → prompt_levels)
         │                         └─ session_audit
         ├─ prompt_levels
         └─ program_categories ── program_templates ── template_targets
```

---

## 3. Segurança (RLS)

**Todas as tabelas com RLS ativado.** A chave `service_role` só existe na Edge Function e nos scripts locais; o app usa só a chave pública.

### 3.1 Funções auxiliares (o "crachá" de quem está logado)

| Função | Responde |
|---|---|
| `my_clinic_id()` | Qual a clínica do usuário. **Vazio se ele estiver desativado ou ainda não trocou a senha provisória**: aí nenhuma regra libera nada. |
| `my_role()` | coordenador / supervisor / aplicador |
| `is_on_team(aprendiz)` | O usuário está vinculado a esse aprendiz? |
| `can_see(aprendiz)` | Coordenador, **ou** vinculado |
| `can_manage(aprendiz)` | Coordenador, **ou** supervisor vinculado |

### 3.2 Regras por tabela

| Tabela | Ler | Criar / alterar |
|---|---|---|
| clinics | a própria | coordenador |
| profiles | colegas da mesma clínica (nome e foto, para os avatares) | coordenador (via Edge Function); cada um altera só o próprio nome/foto. Ninguém muda o próprio perfil de acesso |
| learners, guardians, learner_cids | `can_see` | coordenador |
| learner_team | `can_see` | coordenador |
| consents | `can_see` | coordenador cria; **ninguém altera ou apaga** |
| cid_codes | globais + da clínica | coordenador |
| prompt_levels, program_categories | toda a clínica | coordenador |
| program_templates, template_targets | toda a clínica | coordenador e supervisor |
| learner_programs, targets, playlists | `can_see` | `can_manage` |
| target_*_history, session_audit | `can_see` | só o banco (automático) |
| sessions | `can_see` | **Criar:** vinculado, com ele mesmo como aplicador. **Alterar:** o próprio aplicador enquanto `em_andamento`; depois, só `can_manage` (fica na auditoria). **Apagar:** ninguém (só exclusão lógica pelo coordenador) |
| session_programs, trials | `can_see` | Mesma regra da sessão a que pertencem |

### 3.3 Storage (arquivos)

Quatro pastas **privadas**: `clinic-logos`, `profile-photos`, `learner-photos`, `signatures`. Cada arquivo fica em `{clinic_id}/…`, e as regras são as mesmas das tabelas (foto do aprendiz só para quem pode vê-lo; assinatura só para quem pode ver a sessão). Acesso **apenas por URL assinada** com validade curta.

### 3.4 Prova automática

`scripts/test-rls.ts` (`npm run test:rls`) entra como uma AT fictícia no projeto de testes e confirma:
1. Vê os aprendizes dela; **não** vê um aprendiz ao qual não está vinculada.
2. Não consegue alterar uma sessão finalizada.
3. Não consegue criar programa nem aprendiz, nem se promover.

`tests/db/rls-local.test.mjs` (`npm run test:db`) roda todas as migrations num Postgres temporário e verifica 42 regras, incluindo: usuário desativado não lê nada, senha provisória bloqueia tudo, reenvio não duplica, desfazer não conta, auditoria de correções e sugestão de maestria.

---

## 4. Decisões que tomei (diga se discorda)

1. **Desfazer** não apaga o toque; marca como desfeito. Fica rastreável e não atrapalha a sincronização.
2. **Duas colunas de nível de ajuda na tentativa**: o nível *planejado* do alvo (pinta o gráfico) e a ajuda *usada* no DICA (distribuição de ajuda).
3. **Número da sessão** (#24) é dado pelo servidor, para dois aparelhos offline não gerarem o mesmo número.
4. **Usuário desativado** perde o acesso na consulta seguinte (o banco checa a cada leitura), além de ter o login bloqueado.
5. **Troca de senha obrigatória** é garantida também no banco: até trocar, a pessoa não lê dado nenhum, mesmo que burle a tela.
6. **Frequência**: cada "+1" é um registro (permite desfazer e calcular média por hora).

# 🐉 Vafyndell

> **Gerenciador de campanhas de RPG de mesa — offline-first, direto no seu navegador.**

Vafyndell é uma Progressive Web App (PWA) construída com Angular para centralizar e organizar todas as informações de uma campanha de RPG: personagens, inventários, sistema de batalha, árvores de habilidades, receitas de fabricação, anotações e muito mais. Funciona offline e sincroniza com o Google Sheets como banco de dados na nuvem.

---

## 📋 Sumário

- [✨ Funcionalidades](#-funcionalidades)
- [🏗️ Arquitetura](#️-arquitetura)
- [🎮 Páginas do App](#-páginas-do-app)
  - [🔐 Login](#-login)
  - [🏠 Home](#-home)
  - [🧙 Personagens](#-personagens)
  - [🎒 Inventário](#-inventário)
  - [📚 Catálogo de Itens](#-catálogo-de-itens)
  - [🔨 Oficina (Crafting)](#-oficina-crafting)
  - [👹 NPCs](#-npcs)
  - [⚔️ Sistema de Batalha](#️-sistema-de-batalha)
  - [📝 Anotações](#-anotações)
  - [🌳 Árvores de Habilidade](#-árvores-de-habilidade)
  - [🔁 Troca de Itens](#-troca-de-itens)
  - [📜 Registro de Eventos](#-registro-de-eventos)
- [🗄️ Banco de Dados Local](#️-banco-de-dados-local)
- [🔄 Sincronização de Dados](#-sincronização-de-dados)
- [🔐 Permissões](#-permissões)
- [📦 Dependências](#-dependências)
- [🚀 Como Rodar](#-como-rodar)

---

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 📡 **Offline-first** | Dados armazenados localmente no IndexedDB, disponíveis mesmo sem internet |
| 🔄 **Sincronização automática** | Sync com Google Sheets a cada 30 segundos |
| 🔐 **Autenticação Google** | Login seguro via OAuth 2.0 com JWT |
| 🧩 **Sistema de permissões** | Controle separado entre jogadores e mestres |
| 📊 **Trilha de auditoria** | Registro completo de todas as ações do jogo |
| 🌲 **Árvore de habilidades** | Visualização em grafo (DAG) com Cytoscape.js |
| 🧪 **Sistema de crafting** | Receitas com verificação de ingredientes disponíveis |
| ⚔️ **Sistema de batalha** | Dano por tipo (Vida, Armadura, Escudo), cura e buffs |
| 📱 **PWA** | Instalável no dispositivo, com Service Worker para uso offline |
| 🖼️ **Modal de imagens** | Zoom e pan para visualizar imagens de personagens e NPCs |

---

## 🏗️ Arquitetura

O app é construído com **Angular 20** usando componentes standalone e Signals. A camada de dados segue o padrão **cache-first + sync**:

```
┌─────────────────────────────────────────┐
│              Angular App                │
├─────────────┬───────────────────────────┤
│  IndexedDB  │   Google Sheets (Backend) │
│  (Cache)    │   via Apps Script API     │
└─────────────┴───────────────────────────┘
       ↑ cache-first ↑
  BaseRepositoryV2 (padrão de repositório)
```

### 🔧 Camadas principais

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| **Auth** | `AuthService.ts` | Login Google OAuth, renovação de token, logout hard |
| **Cache** | `IndexedDBClientV2.ts` | 12 object stores locais no browser |
| **API** | `ScriptClientV3.ts` | Wrapper para o Google Apps Script com operações em lote |
| **Repositório** | `BaseRepositoryV2.ts` | CRUD genérico com estratégia cache-first |
| **Bootstrap** | `BootstrapService.ts` | Pré-carrega todas as 12 tabelas ao fazer login |

### 🛠️ Serviços de domínio

| Serviço | Função |
|---|---|
| `BootstrapService` | Carrega todos os dados com mensagens animadas ao iniciar |
| `CaminhoService` | Gerencia os caminhos da skill tree |
| `HabilidadeService` | Renderiza a skill tree com Cytoscape + Dagre |
| `OficinaService` | Sistema de crafting com verificação de ingredientes |
| `VisibilidadeService` | Controla visibilidade de itens e NPCs para jogadores vs mestre |

---

## 🎮 Páginas do App

---

### 🔐 Login

**Rota:** `/login`

Tela de entrada do aplicativo. O jogador faz login com sua conta Google via OAuth 2.0. Ao autenticar com sucesso, o `BootstrapService` pré-carrega todas as 12 tabelas de dados localmente com mensagens de carregamento animadas. Se o token expirar, o sistema executa um hard reset, limpando o localStorage e o IndexedDB antes de solicitar novo login.

---

### 🏠 Home

**Rota:** `/home`

Página inicial após o login, serve como hub de navegação para as demais seções do aplicativo.

---

### 🧙 Personagens

**Rota:** `/jogador-pages/`

Gerenciamento completo de fichas de personagem, com atributos no estilo D&D.

#### 📄 Ficha do Jogador (`/jogador`)
Painel do personagem atual logado. Exibe todos os atributos, valores derivados e o dano acumulado.

| Atributos Base | Valores Derivados |
|---|---|
| Força, Destreza, Constituição | `fator_cura` = Energia ÷ 3 |
| Inteligência, Sabedoria, Carisma | `deslocamento` = Destreza ÷ 3 |
| Energia | `vida_atual` = PV máximo − dano tomado |

**Ações disponíveis:** Editar ficha · Visualizar imagem do personagem

#### ➕ Cadastrar Personagem (`/cadastro-jogador`)
Formulário completo para criar um novo personagem com 10 atributos numéricos. ID gerado automaticamente via ULID.

#### ✏️ Editar Personagem (`/edicao-jogador`)
Edição de todos os campos da ficha, incluindo imagem. Validação completa dos campos.

#### 👁️ Visão de Jogadores — Mestre (`/visao-jogadores`)
Exclusivo para o mestre. Permite visualizar a ficha completa, inventário e skill tree de qualquer jogador da campanha em modo somente leitura.

---

### 🎒 Inventário

**Rota:** `/inventario-pages/`

Controle dos itens de cada personagem, com agrupamento por categoria e cálculo de peso total.

#### 📦 Inventário do Jogador (`/inventario-jogador`)
Lista todos os itens do personagem agrupados por categoria. Exibe peso total acumulado e possui busca por nome.

#### ➕ Adicionar Item (`/cadastro-inventario`)
Formulário com autocomplete para buscar itens do catálogo e adicionar ao inventário com quantidade e descrição (que serve como histórico da transação).

#### 🔍 Detalhe do Item (`/item-inventario`)
Exibe informações completas do item vindo do catálogo, com opção de exclusão.

---

### 📚 Catálogo de Itens

**Rota:** `/catalogo-pages/`

Biblioteca centralizada de todos os itens disponíveis na campanha.

#### 📖 Catálogo (`/catalogo`)
Lista navegável com filtro por abas e toggles de visibilidade por item. O mestre pode ocultar itens dos jogadores.

| Campo | Opções |
|---|---|
| **Unidade** | g, kg, ml, L, cm, m, dose(s), frasco(s), unidade(s) |
| **Categoria** | Poções, Recursos, Equipamentos, Tesouros, Venenos, Utilitários |
| **Raridade** | Comum · Incomum · Raro · Épico · Lendário |
| **Origem** | Fabricável · Natural |

#### ➕ Cadastrar Item (`/cadastro-item-catalogo`)
Criação e edição de itens do catálogo. Permite definir os ingredientes necessários para crafting (Fabricável).

#### 🔍 Detalhe do Item (`/item-catalogo`)
Exibe todas as propriedades do item, incluindo efeito principal, efeito colateral e as receitas em que o item é utilizado.

---

### 🔨 Oficina (Crafting)

**Rota:** `/oficina`

Sistema de fabricação de itens. Exibe todas as receitas disponíveis com verificação visual de viabilidade:

- 🟢 **Verde** — o jogador possui todos os ingredientes necessários
- 🔴 **Vermelho** — ingredientes faltando

Ao fabricar um item, a oficina:
1. Consome os ingredientes do inventário do jogador
2. Adiciona o item fabricado ao inventário
3. Registra a fabricação na trilha de auditoria

---

### 👹 NPCs

**Rota:** `/npcs-pages/`

Gerenciamento dos personagens não-jogadores da campanha, controlados pelo mestre.

#### 📋 Lista de NPCs (`/npcs`)
Exibe NPCs filtráveis por classificação (**Inimigo** / **Bestial**) e tipo (**Comum**, **Elite**, **Mágico**, **Lendário**). NPCs são ocultos por padrão — o mestre controla o que cada jogador pode ver.

#### ➕ Cadastrar NPC (`/cadastro-npc`)
Formulário completo com atributos de combate, imagem e controle de visibilidade. Estrutura de atributos similar à ficha de personagem.

#### 🔍 Detalhes do NPC (`/npc-detalhes`)
Exibe todas as informações do NPC. Permite ao mestre adicioná-lo ao campo de batalha ativo.

---

### ⚔️ Sistema de Batalha

**Rota:** `/batalha-pages/`

Sistema completo para gerenciar combates em tempo real, com sincronização automática a cada 30 segundos.

#### 🗺️ Campo de Batalha (`/batalha`)
Visão geral do combate com jogadores e NPCs separados em grupos. Auto-sync garante que todos vejam o mesmo estado da batalha.

#### 🗡️ Registrar Combate (`/combate`)
Interface para aplicar dano com seleção do tipo de dano:

| Tipo | Efeito |
|---|---|
| **Vida** | Reduz HP diretamente |
| **Armadura** | Reduz pontos de armadura |
| **Escudo** | Reduz pontos de escudo |
| **Efeito** | Aplica efeito especial sem dano direto |

#### 💚 Recuperação (`/recuperacao`)
Cura ou buffar personagens, restaurando HP, armadura ou escudo com tela de confirmação antes de aplicar.

#### 📊 Detalhes na Batalha (`/jogador-detalhes-batalha`)
Consulta rápida de todos os atributos e modificadores de um personagem durante o combate, sem sair da tela de batalha.

---

### 📝 Anotações

**Rota:** `/anotacoes-pages/`

Sistema de notas por personagem, ideal para registrar eventos da campanha, segredos descobertos e lore.

#### 📋 Lista de Anotações (`/anotacoes`)
Anotações agrupadas por data com busca por título, tags e autor. Cada nota pode ter imagem associada.

#### ✏️ Criar/Editar Anotação (`/criar-anotacao`)
Editor completo com campos de título, descrição, tags e upload de imagem (armazenada em base64). Anotações podem ser transferidas entre jogadores.

---

### 🌳 Árvores de Habilidade

**Rota:** `/skilltree/` e `/skilltree-pages/`

Sistema de progressão de personagem visualizado como um grafo direcionado (DAG).

#### Estrutura

```
Caminho (ex: Guerreiro, Arcano, Ladino...)
  └── Árvore (subárea dentro do caminho)
        └── Habilidades (nós do grafo com dependências)
```

#### 🌳 Visualização da Skill Tree (`/skilltree`)
Renderização interativa do grafo de habilidades usando **Cytoscape.js** com layout **Dagre**. Permite navegar pelos caminhos e ver os pré-requisitos de cada habilidade.

#### ✏️ Edição da Skill Tree (`/edicao-skilltree`)
Interface para o mestre criar e editar habilidades, definir dependências entre nós e visualizar o resultado em tempo real.

#### 🎯 Habilidades do Jogador (`/skills-jogador`)
Visualização das habilidades adquiridas pelo personagem do jogador logado.

---

### 🔁 Troca de Itens

**Rota:** `/troca-de-itens`

Permite transferir itens do inventário de um jogador para outro. A transferência é registrada com descrição na trilha de auditoria, mantendo o histórico completo de movimentação de itens.

---

### 📜 Registro de Eventos

**Rota:** `/registro`

Timeline completa de todos os eventos da campanha. Funciona como um log de auditoria imutável.

| Tipo de Evento | O que registra |
|---|---|
| ⚔️ **Batalha** | Atacante, vítima, tipo e valor do dano |
| 💊 **Recuperação** | Personagem curado, tipo e valor restaurado |
| 🎒 **Inventário** | Item adicionado/removido/transferido |
| 🔨 **Fabricação** | Item fabricado, ingredientes consumidos |

Filtros disponíveis por tipo de evento, personagem e data.

---

## 🗄️ Banco de Dados Local

O IndexedDB armazena 12 object stores localmente no browser (todas com `id` como chave primária):

| Store | Conteúdo |
|---|---|
| `Catalogo` | Registro de todos os itens disponíveis |
| `Inventario` | Vínculos jogador ↔ item com quantidade |
| `Receitas` | Receitas de crafting e ingredientes |
| `Personagem` | Fichas de jogadores |
| `NPCs` | Fichas de NPCs |
| `Anotacoes` | Notas dos personagens |
| `Caminhos` | Caminhos da skill tree |
| `Arvores` | Subárvores dentro de cada caminho |
| `Habilidades` | Habilidades com dependências (DAG) |
| `Habilidades_jogadores` | Habilidades adquiridas por personagem |
| `Registro` | Trilha de auditoria de todos os eventos |
| `Metadados` | Timestamps de sincronização |

---

## 🔄 Sincronização de Dados

O app usa uma estratégia **cache-first com sync em background**:

```
1. 📦 Verificar cache local (IndexedDB)
2. ✅ Exibir dados imediatamente se encontrados
3. 🔍 Background: verificar metadados no servidor
4. ↩️  Se servidor mais recente → buscar e atualizar cache
5. ⚡ Se cache vazio → buscar servidor imediatamente
6. 🔁 Repetir a cada 30 segundos automaticamente
```

---

## 🔐 Permissões

| Ação | Jogador | Mestre |
|---|:---:|:---:|
| Ver própria ficha | ✅ | ✅ |
| Ver fichas de outros | ❌ | ✅ |
| Criar itens no catálogo | ❌ | ✅ |
| Ocultar itens do catálogo | ❌ | ✅ |
| Criar NPCs | ❌ | ✅ |
| Ocultar NPCs | ❌ | ✅ |
| Ver log de batalha | ✅ | ✅ |
| Editar inventário de outros | ❌ | ❌ |
| Editar skill tree | ❌ | ✅ |

---

## 📦 Dependências

| Dependência | Versão | Uso |
|---|---|---|
| `@angular` | ^20.2.0 | Framework principal |
| `@angular/material` | ^20.2.2 | Componentes UI (Material Design) |
| `@angular/service-worker` | ^20.2.0 | PWA / Suporte offline |
| `bootstrap` | ^5.3.8 | Layout e utilitários CSS |
| `cytoscape` | ^3.33.1 | Renderização de grafos (skill tree) |
| `cytoscape-dagre` | ^2.5.0 | Layout de DAG para skill tree |
| `rxjs` | ~7.8.0 | Programação reativa |

---

## 🚀 Como Rodar

### Pré-requisitos

- Node.js 18+
- Angular CLI 20+

### Instalação

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd Vafyndell

# Instale as dependências
npm install
```

### Desenvolvimento

```bash
# Inicia o servidor de desenvolvimento com proxy para o Google Apps Script
npm start
```

O app estará disponível em `http://localhost:4200`.

### Build de Produção

```bash
# Gera build otimizado com Service Worker habilitado
npm run build
```

### Testes

```bash
npm test
```

---

<div align="center">

**Vafyndell** · Feito para aventureiros, por aventureiros 🗡️

</div>

## 🚀 Deploy

Sempre que fizer alterações no código:

```bash
ng build --base-href "https://marquesCleiton.github.io/Vafyndell/"
npx angular-cli-ghpages --dir=dist/vafyndell/browser
```

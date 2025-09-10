import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  { path: 'jogador', loadComponent: () => import('./pages/jogador/jogador').then((m) => m.Jogador) },
  { path: 'cadastro-jogador', loadComponent: () => import('./pages/cadastro-jogador/cadastro-jogador').then((m) => m.CadastroJogador) },
  { path: 'edicao-jogador', loadComponent: () => import('./pages/edicao-jogador/edicao-jogador').then((m) => m.EdicaoJogador) },
  { path: 'cadastro-item-catalogo', loadComponent: () => import('./pages/cadastro-item-catalogo/cadastro-item-catalogo').then((m) => m.CadastroItemCatalogo) },
  { path: 'cadastro-item-catalogo/:id', loadComponent: () => import('./pages/cadastro-item-catalogo/cadastro-item-catalogo').then((m) => m.CadastroItemCatalogo) },
  { path: 'inventario-jogador', loadComponent: () => import('./pages/inventario-jogador/inventario-jogador').then((m) => m.InventarioJogador) },
  { path: 'item-inventario/:id', loadComponent: () => import('./pages/item-inventario/item-inventario').then((m) => m.ItemInventario) },
  { path: 'cadastro-inventario', loadComponent: () => import('./pages/cadastro-inventario/cadastro-inventario').then((m) => m.CadastroInventario) },
  { path: 'cadastro-inventario/:id', loadComponent: () => import('./pages/cadastro-inventario/cadastro-inventario').then((m) => m.CadastroInventario) },
  { path: 'cadastro-npc', loadComponent: () => import('./pages/cadastro-npc/cadastro-npc').then((m) => m.CadastroNpc) },
  { path: 'cadastro-npc/:id', loadComponent: () => import('./pages/cadastro-npc/cadastro-npc').then((m) => m.CadastroNpc) },
  { path: 'npcs', loadComponent: () => import('./pages/npcs/npcs').then((m) => m.Npcs) },
  { path: 'npc-detalhes', loadComponent: () => import('./pages/npc-detalhes/npc-detalhes').then((m) => m.NpcDetalhes) },
  { path: 'npc-detalhes/:id', loadComponent: () => import('./pages/npc-detalhes/npc-detalhes').then((m) => m.NpcDetalhes) },
  { path: 'batalha', loadComponent: () => import('./pages/batalha/batalha').then((m) => m.Batalha) },
  { path: 'jogador-detalhes-batalha', loadComponent: () => import('./pages/jogador-detalhes-batalha/jogador-detalhes-batalha').then((m) => m.JogadorDetalhesBatalha) },
  { path: 'jogador-detalhes-batalha/:id', loadComponent: () => import('./pages/jogador-detalhes-batalha/jogador-detalhes-batalha').then((m) => m.JogadorDetalhesBatalha) },
  { path: 'combate', loadComponent: () => import('./pages/combate/combate').then((m) => m.Combate) },
  { path: 'combate/:id', loadComponent: () => import('./pages/combate/combate').then((m) => m.Combate) },
  { path: 'catalogo', loadComponent: () => import('./pages/catalogo/catalogo').then((m) => m.Catalogo) },
  { path: 'recuperacao', loadComponent: () => import('./pages/recuperacao/recuperacao').then((m) => m.Recuperacao) },
  { path: 'recuperacao/:id', loadComponent: () => import('./pages/recuperacao/recuperacao').then((m) => m.Recuperacao) },
  { path: 'anotacoes', loadComponent: () => import('./pages/anotacoes/anotacoes').then((m) => m.Anotacoes) },
  { path: 'criar-anotacao', loadComponent: () => import('./pages/criar-anotacao/criar-anotacao').then((m) => m.CriarAnotacao) },
  { path: 'criar-anotacao/:id', loadComponent: () => import('./pages/criar-anotacao/criar-anotacao').then((m) => m.CriarAnotacao) },
  { path: 'oficina', loadComponent: () => import('./pages/oficina/oficina').then((m) => m.Oficina) },
  { path: 'skills-jogador', loadComponent: () => import('./pages/skills-jogador/skills-jogador').then((m) => m.SkillsJogador) },

  // 🔑 aqui está o ajuste → rota com parâmetro :id
  { path: 'item-catalogo/:id', loadComponent: () => import('./pages/item-catalogo/item-catalogo').then((m) => m.ItemCatalogo) },

  { path: '**', redirectTo: 'login' }
];

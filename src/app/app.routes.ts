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
  
  { path: 'catalogo', loadComponent: () => import('./pages/catalogo/catalogo').then((m) => m.Catalogo) },

  // 🔑 aqui está o ajuste → rota com parâmetro :id
  { path: 'item-catalogo/:id', loadComponent: () => import('./pages/item-catalogo/item-catalogo').then((m) => m.ItemCatalogo) },

  { path: '**', redirectTo: 'login' }
];

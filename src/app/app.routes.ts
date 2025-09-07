import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {path: 'login',loadComponent: () => import('./pages/login/login').then((m) => m.Login),},
  {path: 'home', loadComponent: () =>import('./pages/home/home').then((m) => m.Home),},
  {path: 'jogador', loadComponent: () =>import('./pages/jogador/jogador').then((m) => m.Jogador),},
  {path: 'cadastro-jogador', loadComponent: () =>import('./pages/cadastro-jogador/cadastro-jogador').then((m) => m.CadastroJogador),},
  { path: '**', redirectTo: 'login' }
];

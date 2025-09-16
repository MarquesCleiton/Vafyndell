import { Component, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query } from '@angular/animations';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { AuthService } from './core/auth/AuthService';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        query(':enter', [
          style({ position: 'absolute', width: '100%', transform: 'translateX(100%)', opacity: 0 })
        ], { optional: true }),

        query(':leave', [
          style({ position: 'absolute', width: '100%' }),
          animate('250ms ease', style({ transform: 'translateX(-100%)', opacity: 0 }))
        ], { optional: true }),

        query(':enter', [
          animate('250ms ease', style({ transform: 'translateX(0%)', opacity: 1 }))
        ], { optional: true })
      ])
    ])
  ]
})
export class App {
  protected readonly title = signal('Vafyndell');
  protected readonly showFab = signal(false);
  private readonly activeRoute = signal('');
  protected readonly isLogged = signal(false);
  protected isMobile = window.innerWidth < 992;

  get currentRoute(): string {
    return this.activeRoute();
  }

  isLoginPage(): boolean {
    return this.currentRoute === '/login';
  }

  private titles: Record<string, string> = {
    '/jogador': 'Jogador',
    '/edicao-jogador': 'Skills',
    '/inventario-jogador': 'Inventário',
    '/oficina': 'Oficina',
    '/batalha': 'Batalha',
    '/anotacoes': 'Notas',
    '/catalogo': 'Catálogo',
    '/npcs': 'Feras & Vilões'
  };

  constructor(private router: Router) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.activeRoute.set(url);
        this.title.set(this.titles[url] ?? 'Vafyndell');
        this.showFab.set(url === '/jogador');
      });

    this.isLogged.set(AuthService.isAuthenticated());

    // 🔎 Detecta redimensionamento para alternar entre mobile e desktop
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth < 992;
    });
  }

  onRefresh() {
    window.location.reload();
  }

  editarJogador() {
    this.router.navigate(['/edicao-jogador']);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}

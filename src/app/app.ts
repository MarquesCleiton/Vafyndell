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
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth/AuthService';
import { BootstrapService } from './services/BootstrapService';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


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
    MatListModule,
    MatDividerModule,
    MatProgressSpinnerModule
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
  private readonly activeRoute = signal('');
  protected readonly isLogged = signal(false);
  protected readonly syncing = signal(false);
  isDesktop = window.innerWidth >= 992; // 🔑 controla se é desktop

  get currentRoute(): string {
    return this.activeRoute();
  }

  isLoginPage(): boolean {
    return this.currentRoute === '/login';
  }

  private titles: Record<string, string> = {
    '/jogador': 'Jogador',
    '/skills-jogador': 'Skills',
    '/inventario-jogador': 'Inventário',
    '/oficina': 'Oficina',
    '/batalha': 'Batalha',
    '/anotacoes': 'Notas',
    '/catalogo': 'Catálogo',
    '/npcs': 'Feras & Vilões'
  };

  constructor(private router: Router, private bootstrap: BootstrapService) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.activeRoute.set(url);
        this.title.set(this.titles[url] ?? 'Vafyndell');
      });

    this.isLogged.set(AuthService.isAuthenticated());

    // 🔑 Recalcular se é desktop quando a tela redimensionar
    window.addEventListener('resize', () => {
      this.isDesktop = window.innerWidth >= 992;
    });

  }

  async onRefresh() {
    try {
      this.syncing.set(true);
      console.log('[App] Forçando sincronia de todas as bases...');

      await this.bootstrap.preloadAll((msg) => {
        console.log('[Sync]', msg);
      });

      alert('🔄 Sincronia concluída com sucesso!');
      window.location.reload();
    } catch (err) {
      console.error('[App] Erro na sincronia:', err);
      alert('❌ Erro ao sincronizar dados. Tente novamente.');
    } finally {
      this.syncing.set(false);
    }
  }


  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  navigateWithClose(path: string, sidenav: any) {
    this.navigateTo(path);
    if (!this.isDesktop) {
      sidenav.close();
    }
  }

  async logout(sidenav: any) {
    localStorage.removeItem("user");
    window.location.href = '/login'
  }
}

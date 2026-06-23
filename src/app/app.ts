import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
export class App implements OnInit {
  protected readonly title = signal('Vafyndell');
  private readonly activeRoute = signal('');
  protected readonly isLogged = signal(false);
  protected readonly syncing = signal(false);
  // BUG-14 fix: isDesktop como Signal para reatividade correta
  isDesktop = signal(window.innerWidth >= 992);

  private readonly destroyRef = inject(DestroyRef);

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

    // BUG-14 fix: listener de resize com cleanup via DestroyRef (sem memory leak)
    const onResize = () => this.isDesktop.set(window.innerWidth >= 992);
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
  }

  ngOnInit() {
    // P6 Keepalive: pinga Metadados a cada 4 min para manter GAS “aquecido”
    const KEEPALIVE_MS = 4 * 60 * 1000;
    const keepalive = setInterval(async () => {
      if (document.visibilityState === 'visible' && navigator.onLine && AuthService.isAuthenticated()) {
        try {
          // Chamada leve: só Metadados (~100 bytes de resposta)
          const { ScriptClientV3 } = await import('./core/script/ScriptClientV3');
          await ScriptClientV3.getAll('Metadados');
          console.log('[App] 🔥 Keepalive GAS OK');
        } catch { /* silencioso — não impacta o usuário */ }
      }
    }, KEEPALIVE_MS);
    this.destroyRef.onDestroy(() => clearInterval(keepalive));
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
    // BUG-14 fix: isDesktop agora é Signal
    if (!this.isDesktop()) {
      sidenav.close();
    }
  }

  async logout(sidenav: any) {
    // BUG-05 fix: logoutHard limpa localStorage + IndexedDB (dados sensíveis)
    await AuthService.logoutHard();
    window.location.href = '/Vafyndell';
  }
}

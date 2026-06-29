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
import { BaseRepositoryV2 } from './repositories/BaseRepositoryV2';
import { JogadorDomain } from './domain/jogadorDomain';

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
  activeNotifications = signal<any[]>([]);
  private knownIds = new Set<string>();

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
    // Sincronização Global Periódica a cada 10 segundos (para segurança de quota do Google Apps Script com 6 jogadores)
    const INTERVALO_SYNC_MS = 10 * 1000;
    const todasAsAbas = [
      'Catalogo',
      'Inventario',
      'Receitas',
      'Personagem',
      'NPCs',
      'Anotacoes',
      'Caminhos',
      'Arvores',
      'Habilidades',
      'Habilidades_jogadores',
      'Registro'
    ];

    const syncInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && navigator.onLine && AuthService.isAuthenticated()) {
        try {
          console.log('[App] 🔄 Iniciando sincronização global em segundo plano...');
          await BaseRepositoryV2.multiSync(todasAsAbas);
          console.log('[App] 🔥 Sincronização global concluída.');
        } catch (err) {
          console.warn('[App] ⚠️ Falha na sincronização global silenciosa:', err);
        }
      }
    }, INTERVALO_SYNC_MS);

    // Carregar IDs existentes no banco local na inicialização para evitar duplicar histórico antigo
    const repoReg = new BaseRepositoryV2<any>('Registro');
    repoReg.getLocal().then(locais => {
      locais.forEach(r => this.knownIds.add(r.id));
      console.log(`[App] 📥 ${this.knownIds.size} IDs de Registro conhecidos inicialmente.`);
    }).catch(err => console.error('[App] Erro ao preencher conhecidos:', err));

    // Inscrição reativa para notificações de novos registros
    const syncSub = BaseRepositoryV2.onTabUpdated.subscribe(async (tab) => {
      if (tab === 'Registro') {
        try {
          const todos = await repoReg.getLocal();
          const userLogado = AuthService.getUser();
          
          if (!userLogado?.email) return;

          // Filtrar somente registros que NÃO estão em knownIds
          let novos = todos.filter(r => !this.knownIds.has(r.id));

          if (novos.length > 0) {
            console.log(`[App] 🔔 Encontrados ${novos.length} novos registros para notificação.`);
            
            // Adicionar ao Set de conhecidos TODOS os novos, para não processá-los novamente
            novos.forEach(r => this.knownIds.add(r.id));

            // Limita sempre aos últimos 5 para evitar poluição visual,
            // principalmente quando o cache está vazio e ele baixa todos os registros de uma vez.
            if (novos.length > 5) {
              novos = novos.slice(-5);
            }

            // Buscar personagens locais para resolver as imagens dos autores das ações
            const repoPersonagens = new BaseRepositoryV2<JogadorDomain>('Personagem');
            const personagens = await repoPersonagens.getLocal();

            // Converter cada novo registro em uma notificação
            const novasNotifs = novos.map(r => {
              const lines = r.detalhes.split('\n');
              const texto = lines[0];
              const detalhes = lines.slice(1).join('\n').trim();
              const isAlvo = String(r.alvo).toLowerCase() === userLogado.email.toLowerCase();

              // Mapear a classe CSS
              let classe = 'item';
              const detLow = r.detalhes.toLowerCase();
              if (detLow.includes('rolou os dados') || r.acao === 'rolagem') {
                classe = 'rolagem';
              } else if (detLow.includes('atacou') || detLow.includes('caiu em combate') || r.acao === 'ataque') {
                classe = 'ataque';
              } else if (detLow.includes('recuperou') || detLow.includes('cura') || r.acao === 'cura') {
                classe = 'recuperacao';
              }

              // Resolver imagem e nome do autor da ação
              const autor = personagens.find(p => p.email === r.jogador);
              const nomeAutor = autor ? autor.personagem : 'Sistema';
              const subAutor = autor ? (autor.classificacao || (autor.nome_do_jogador === 'NPC' ? 'Inimigo' : 'Jogador')) : 'Global';
              const imagemAutor = autor?.imagem && autor.imagem !== '-' ? autor.imagem : null;
              const isNpc = autor ? autor.nome_do_jogador === 'NPC' : false;

              // Extrair valor gigante de rolagem para dados e verificar estado crítico/falha
              let valorRolagem: number | null = null;
              let estadoRolagem: 'normal' | 'critico' | 'falha' = 'normal';
              if (classe === 'rolagem') {
                const match = r.detalhes.match(/obteve (\d+)/);
                if (match) {
                  valorRolagem = parseInt(match[1], 10);
                }

                if (r.detalhes.includes('ACERTO CRÍTICO')) {
                  estadoRolagem = 'critico';
                } else if (r.detalhes.includes('FALHA CRÍTICA')) {
                  estadoRolagem = 'falha';
                }
              }

              return {
                id: r.id,
                texto,
                detalhes,
                expandido: false,
                classe,
                isAlvo,
                imagemAutor,
                nomeAutor,
                subAutor,
                isNpc,
                valorRolagem,
                estadoRolagem
              };
            });

            // Adicionar à lista de notificações ativas
            this.activeNotifications.update(list => [...list, ...novasNotifs]);
          }
        } catch (err) {
          console.error('[App] Erro ao processar notificações de Registro:', err);
        }
      }
    });

    this.destroyRef.onDestroy(() => {
      clearInterval(syncInterval);
      syncSub.unsubscribe();
    });
  }

  fecharNotificacao(id: string) {
    this.activeNotifications.update(list => list.filter(n => n.id !== id));
  }

  toggleExpandir(notif: any) {
    if (!notif.detalhes) return;
    this.activeNotifications.update(list =>
      list.map(n => n.id === notif.id ? { ...n, expandido: !n.expandido } : n)
    );
  }

  trackByNotificationId(index: number, item: any): string {
    return item.id;
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

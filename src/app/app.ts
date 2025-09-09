import { Component, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { AuthService } from './core/auth/AuthService';
import { CommonModule } from '@angular/common'; // 👈 importar aqui
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,       // 👈 adiciona aqui
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        // nova rota entra pela direita
        query(':enter', [
          style({ position: 'absolute', width: '100%', transform: 'translateX(100%)', opacity: 0 })
        ], { optional: true }),

        // rota antiga sai pela esquerda
        query(':leave', [
          style({ position: 'absolute', width: '100%' }),
          animate('250ms ease', style({ transform: 'translateX(-100%)', opacity: 0 }))
        ], { optional: true }),

        // nova rota termina no centro
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
  protected readonly activeRoute = signal('');
  protected readonly isLogged = signal(false); // 👈 novo

  private titles: Record<string, string> = {
    '/jogador': 'Klug Orin',
    '/edicao-jogador': 'Skills',
    '/inventario': 'Inventário',
    '/criar': 'Criar',
    '/batalha': 'Batalha',
    '/notas': 'Notas'
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
    // Checa login inicial
    this.isLogged.set(AuthService.isAuthenticated());
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

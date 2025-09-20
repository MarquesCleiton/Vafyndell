// pages/login/login.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/AuthService';
import { CommonModule } from '@angular/common';
import { BootstrapService } from '../../services/BootstrapService';
import { IndexedDBClientV2 } from '../../core/db/IndexedDBClientV2';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [CommonModule],
})
export class Login implements OnInit {
  carregando = false;
  mensagem = '';

  constructor(
    private router: Router,
    private bootstrap: BootstrapService
  ) {}

  async ngOnInit() {
    const user = AuthService.getUser();

    // 🚨 Caso 1: User existe mas token expirado → reset total
    if (user && !AuthService.isAuthenticated()) {
      console.warn('[Login] Token expirado → limpando credenciais e banco');
      await AuthService.logoutHard();
      const db = await IndexedDBClientV2.create();
      await db.deleteDatabase();
      return;
    }

    // 🚨 Caso 2: Não tem user mas ainda existe banco local → reset banco
    if (!user) {
      const db = await IndexedDBClientV2.create();
      await db.deleteDatabase();
      console.warn('[Login] Nenhum usuário → banco local limpo');
    }

    // ✅ Caso 3: User válido → dispara preload
    if (AuthService.isAuthenticated()) {
      this.inicializarApp();
    }
  }

  async login() {
    if (AuthService.isAuthenticated()) {
      await this.inicializarApp();
      return;
    }

    try {
      this.carregando = true;
      this.mensagem = 'Invocando grimórios...';

      const user = await AuthService.signInWithGoogle();
      if (user) {
        console.log('[Login] Login OK:', user);
        await this.inicializarApp();
      } else {
        alert('Falha no login, tente novamente.');
      }
    } catch (err) {
      console.error('[Login] Erro no login:', err);
      alert('Erro no login. Verifique sua conexão e tente novamente.');
    }
  }

  private async inicializarApp() {
    this.carregando = true;
    this.mensagem = 'Carregando tomos antigos...';

    try {
      await this.bootstrap.preloadAll((msg) => (this.mensagem = msg));
      console.log('[Login] Preload concluído!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[Login] Erro no preload:', err);
      alert('Erro ao carregar os dados iniciais. Tente novamente.');
    } finally {
      this.carregando = false;
    }
  }
}

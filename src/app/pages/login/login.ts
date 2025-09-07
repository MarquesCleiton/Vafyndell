import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/AuthService';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  constructor(private router: Router) {}

  async ngOnInit() {
    // Se já tem sessão ativa, redireciona
    if (AuthService.isAuthenticated()) {
      this.router.navigate(['/jogador']);
    }
  }

  async login() {
    // Se já autenticado, vai direto
    if (AuthService.isAuthenticated()) {
      this.router.navigate(['/jogador']);
      return;
    }

    try {
      const user = await AuthService.signInWithGoogle();
      if (user) {
        console.log('Login OK:', user);
        this.router.navigate(['/jogador']);
      } else {
        alert('Falha no login, tente novamente.');
      }
    } catch (err) {
      console.error('Erro no login:', err);
      alert('Erro no login. Verifique sua conexão e tente novamente.');
    }
  }
}

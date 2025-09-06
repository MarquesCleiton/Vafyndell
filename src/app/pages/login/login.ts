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
    // 👇 Checa se já tem sessão ativa
    if (AuthService.isAuthenticated()) {
      this.router.navigate(['/jogador']);
    }
  }

  async login() {
    if (AuthService.isAuthenticated()) {
      this.router.navigate(['/jogador']);
      return;
    }

    const user = await AuthService.signInWithGoogle();
    if (user) {
      this.router.navigate(['/jogador']);
    } else {
      alert('Falha no login, tente novamente.');
    }
  }
}

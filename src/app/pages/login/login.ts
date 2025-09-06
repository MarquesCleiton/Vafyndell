import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/AuthService';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  constructor(private router: Router) { }

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

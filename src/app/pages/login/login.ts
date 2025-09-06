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
    const user = await AuthService.signInWithGoogle();
    if (user) {
      console.log('Usuário logado:', user);
      this.router.navigate(['/home']);
    } else {
      console.error('Falha no login');
    }
  }

}

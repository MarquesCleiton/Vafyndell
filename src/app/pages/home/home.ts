import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../core/auth/AuthService';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  user: User | null = null;

  constructor(private router: Router) {}

  async ngOnInit(): Promise<void> {
    // valida sessão
    if (!(await AuthService.isAuthenticated())) {
      this.router.navigate(['/login']);
      return;
    }

    this.user = AuthService.getUser();
  }

  logout() {
    AuthService.logout();
    this.router.navigate(['/login']);
  }
}

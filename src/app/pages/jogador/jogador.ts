import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/AuthService';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';

@Component({
  selector: 'app-jogador',
  templateUrl: './jogador.html',
  styleUrls: ['./jogador.css'],
})
export class Jogador implements OnInit {
  jogador: JogadorDomain | null = null;
  loading = true;

  constructor(private router: Router) { }

  async ngOnInit() {
    try {
      const user = AuthService.getUser();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      // Buscar jogador atual (com fallback para sync online)
      const jogadorAtual = await JogadorRepository.getCurrentJogador();

      if (!jogadorAtual) {
        // ✅ Só redireciona se confirmou que nem no online existe
        this.router.navigate(['/cadastro']);
        return;
      }

      // Exibir jogador
      this.jogador = jogadorAtual;
      this.loading = false;
    } catch (err) {
      console.error('Erro ao carregar Jogador:', err);
      this.router.navigate(['/login']);
    }
  }

}

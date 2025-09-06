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

  constructor(private router: Router) {}

  async ngOnInit() {
    console.log('[Jogador] ngOnInit → carregando jogador...');

    try {
      // 1. Busca local primeiro
      let jogadorLocal = await JogadorRepository.getLocalJogador();
      console.log(jogadorLocal)
      if (jogadorLocal) {
        console.log('[Jogador] Jogador local encontrado:', jogadorLocal);
        this.jogador = jogadorLocal;
        this.loading = false;

        // 2. Em paralelo, valida online
        JogadorRepository.syncJogadores().then(async updated => {
          if (updated) {
            console.log('[Jogador] Cache atualizado. Recarregando jogador...');
            this.jogador = await JogadorRepository.getLocalJogador();
          }
        });
      } else {
        console.log('[Jogador] Nenhum jogador local. Tentando buscar online...');
        // 3. Se não tem local, busca online
        const jogadorOnline = await JogadorRepository.forceFetchJogador();
        if (jogadorOnline) {
          this.jogador = jogadorOnline;
          this.loading = false;
        } else {
          console.warn('[Jogador] Nenhum jogador encontrado online → redirecionando para o cadastro');
          this.router.navigate(['/cadastro_jogador']);
        }
      }
    } catch (err) {
      console.error('[Jogador] Erro ao carregar Jogador:', err);
      this.router.navigate(['/login']);
    }
  }
}

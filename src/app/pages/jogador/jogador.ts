import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-jogador',
  templateUrl: './jogador.html',
  styleUrls: ['./jogador.css'],
  imports: [CommonModule], // 👈 aqui garante suporte ao *ngIf, *ngFor
})
export class Jogador implements OnInit {
  jogador: (JogadorDomain & {
    fator_cura?: number;
    vida_total?: number;
    deslocamento?: number;
  }) | null = null;

  atributos: any[] = [];
  loading = true;

  constructor(private router: Router) {}

  async ngOnInit() {
    console.log('[Jogador] ngOnInit → carregando jogador...');

    try {
      // 1. Busca local primeiro
      let jogadorLocal = await JogadorRepository.getLocalJogador();
      if (jogadorLocal) {
        console.log('[Jogador] Jogador local encontrado:', jogadorLocal);
        this.setJogador(jogadorLocal);

        // 2. Em paralelo, valida online
        JogadorRepository.syncJogadores().then(async updated => {
          if (updated) {
            console.log('[Jogador] Cache atualizado. Recarregando jogador...');
            const atualizado = await JogadorRepository.getLocalJogador();
            if (atualizado) this.setJogador(atualizado);
          }
        });
      } else {
        console.log('[Jogador] Nenhum jogador local. Tentando buscar online...');
        // 3. Se não tem local, busca online
        const jogadorOnline = await JogadorRepository.forceFetchJogador();
        if (jogadorOnline) {
          this.setJogador(jogadorOnline);
        } else {
          console.warn('[Jogador] Nenhum jogador encontrado online → redirecionando para o cadastro');
          this.router.navigate(['/cadastro-jogador']);
        }
      }
    } catch (err) {
      console.error('[Jogador] Erro ao carregar Jogador:', err);
      this.router.navigate(['/login']);
    }
  }

  /** Prepara jogador e atributos */
  private setJogador(jogador: JogadorDomain) {
    // cálculos derivados
    const vida = jogador.energia + jogador.constituicao;
    const fatorCura = Math.floor(jogador.energia / 3);
    const vidaTotal = vida + jogador.classe_de_armadura;
    const deslocamento = Math.floor(jogador.destreza / 3);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vida,
      fator_cura: fatorCura,
      vida_total: vidaTotal,
      deslocamento: deslocamento,
    };

    this.atributos = [
      { label: 'Força', value: jogador.forca, icon: 'bi bi-hand-thumbs-up' },
      { label: 'Destreza', value: jogador.destreza, icon: 'bi bi-lightning' },
      { label: 'Constituição', value: jogador.constituicao, icon: 'bi bi-shield' },
      { label: 'Inteligência', value: jogador.inteligencia, icon: 'bi bi-motherboard' },
      { label: 'Sabedoria', value: jogador.sabedoria, icon: 'bi bi-eye' },
      { label: 'Carisma', value: jogador.carisma, icon: 'bi bi-emoji-smile' },
      { label: 'Energia', value: jogador.energia, icon: 'bi bi-lightning-charge' },
      { label: 'Deslocamento', value: deslocamento, icon: 'bi bi-arrow-right' },
    ];

    this.loading = false;
  }

  editarJogador() {
    this.router.navigate(['/edicao-jogador']);
  }
}

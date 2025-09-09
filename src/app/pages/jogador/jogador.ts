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

  constructor(private router: Router) { }

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

  private setJogador(jogador: JogadorDomain) {
    // Vida base cadastrada ou calculada
    const vidaBase = jogador.pontos_de_vida > 0
      ? jogador.pontos_de_vida
      : jogador.energia + jogador.constituicao;

    const fatorCura = Math.floor(jogador.energia / 3);
    const vidaTotal = vidaBase + jogador.classe_de_armadura - (jogador.dano_tomado || 0);
    const deslocamento = Math.floor(jogador.destreza / 3);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,
      fator_cura: fatorCura,
      vida_total: vidaTotal,
      deslocamento: deslocamento,
    };

    // função auxiliar para calcular modificador
    const calcMod = (valor: number) => Math.floor((valor - 10) / 2);

    this.atributos = [
      { label: 'Força', value: jogador.forca, mod: calcMod(jogador.forca), icon: '💪' },
      { label: 'Destreza', value: jogador.destreza, mod: calcMod(jogador.destreza), icon: '🤸‍♂️' },
      { label: 'Constituição', value: jogador.constituicao, mod: calcMod(jogador.constituicao), icon: '🪨' },
      { label: 'Inteligência', value: jogador.inteligencia, mod: calcMod(jogador.inteligencia), icon: '🧠' },
      { label: 'Sabedoria', value: jogador.sabedoria, mod: calcMod(jogador.sabedoria), icon: '📖' },
      { label: 'Carisma', value: jogador.carisma, mod: calcMod(jogador.carisma), icon: '😎' },
      { label: 'Energia', value: jogador.energia, mod: calcMod(jogador.energia), icon: '⚡' },
    ];

    this.loading = false;
  }


  editarJogador() {
    this.router.navigate(['/edicao-jogador']);
  }
}

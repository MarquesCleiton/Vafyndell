import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { JogadorDomain } from '../../domain/jogadorDomain';
import { AuthService } from '../../core/auth/AuthService';
import { BaseRepository } from '../../repositories/BaseRepository';

@Component({
  selector: 'app-jogador',
  templateUrl: './jogador.html',
  styleUrls: ['./jogador.css'],
  standalone: true,
  imports: [CommonModule],
})
export class Jogador implements OnInit {
  jogador: (JogadorDomain & {
    fator_cura?: number;
    vida_total?: number;
    deslocamento?: number;
  }) | null = null;

  atributos: any[] = [];
  loading = true;

  // ✅ agora usa BaseRepository
  private repo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');

  constructor(private router: Router) {}

  async ngOnInit() {
    console.log('[Jogador] Iniciando carregamento...');
    this.loading = true;

    try {
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1️⃣ Primeiro tenta pegar local
      let jogadorLocal = (await this.repo.getLocal()).find(j => j.email === user.email);

      if (jogadorLocal) {
        console.log('[Jogador] Jogador local encontrado:', jogadorLocal);
        this.setJogador(jogadorLocal);

        // dispara sync em paralelo (não bloqueia UI)
        this.repo.sync().then(async updated => {
          if (updated) {
            const atualizado = (await this.repo.getLocal()).find(j => j.email === user.email);
            if (atualizado) this.setJogador(atualizado);
          }
        });
        return; // já exibiu algo
      }

      // 2️⃣ Se não havia local → carrega síncrono (force fetch)
      console.log('[Jogador] Nenhum jogador local → carregando online...');
      const online = await this.repo.forceFetch();
      jogadorLocal = online.find(j => j.email === user.email);

      if (jogadorLocal) {
        this.setJogador(jogadorLocal);
      } else {
        console.warn('[Jogador] Nenhum jogador encontrado nem online → cadastro');
        this.router.navigate(['/cadastro-jogador']);
      }
    } catch (err) {
      console.error('[Jogador] Erro ao carregar Jogador:', err);
      this.router.navigate(['/login']);
    } finally {
      this.loading = false;
    }
  }

  private setJogador(jogador: JogadorDomain) {
    // Vida base cadastrada ou calculada
    const vidaBase =
      jogador.pontos_de_vida && jogador.pontos_de_vida > 0
        ? jogador.pontos_de_vida
        : jogador.energia + jogador.constituicao;

    const fatorCura = Math.floor(jogador.energia / 3);
    const deslocamento = Math.floor(jogador.destreza / 3);

    // Vida atual segue a regra da armadura
    const vidaAtual =
      jogador.classe_de_armadura > 0
        ? vidaBase
        : vidaBase - (jogador.dano_tomado || 0);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,
      vida_atual: vidaAtual,
      fator_cura: fatorCura,
      deslocamento: deslocamento,
    };

    // função auxiliar para calcular modificador estilo D&D
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
  }

  editarJogador() {
    this.router.navigate(['/edicao-jogador']);
  }
}

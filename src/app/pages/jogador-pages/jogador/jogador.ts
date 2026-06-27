import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { AuthService } from '../../../core/auth/AuthService';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageModal } from '../../image-modal/image-modal';

@Component({
  selector: 'app-jogador',
  templateUrl: './jogador.html',
  styleUrls: ['./jogador.css'],
  standalone: true,
  imports: [CommonModule, ImageModal],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Jogador implements OnInit, OnDestroy {
  jogador: (JogadorDomain & {
    fator_de_cura?: number;
    vida_total?: number;
    deslocamento?: number;
    vida_atual?: number;
  }) | null = null;

  atributos: { label: string; value: number; mod: number; icon: string }[] = [];
  loading = true;

  // controle do modal de imagem
  imagemSelecionada: string | null = null;
  modalAberto = false;

  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private syncSub: Subscription | null = null;

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  async ngOnInit() {
    console.log('[Jogador] Iniciando carregamento...');
    this.loading = true;

    // Subscrever a atualizações globais da tabela Personagem
    this.syncSub = BaseRepositoryV2.onTabUpdated.subscribe(async (tab) => {
      if (tab === 'Personagem') {
        const user = AuthService.getUser();
        if (user?.email) {
          const atualizado = (await this.repo.getLocal()).find(j => j.email === user.email);
          if (atualizado) {
            console.log('[Jogador] Ficha reatualizada de forma reativa:', atualizado);
            this.setJogador(atualizado);
            this.cdr.markForCheck();
          }
        }
      }
    });

    try {
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado.');

      // 1️⃣ Carrega local primeiro
      let jogadorLocal = (await this.repo.getLocal()).find(j => j.email === user.email);

      if (jogadorLocal) {
        console.log('[Jogador] Jogador local encontrado:', jogadorLocal);
        this.setJogador(jogadorLocal);

        // 🔄 dispara sync em paralelo
        this.repo.sync();
        return;
      }

      // 2️⃣ Fallback online
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
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    if (this.syncSub) {
      this.syncSub.unsubscribe();
      this.syncSub = null;
    }
  }

  private setJogador(jogador: JogadorDomain) {
    // Garante que sempre exista um número
    jogador.escudo = jogador.escudo ?? 0;
    jogador.pontos_de_sorte = jogador.pontos_de_sorte ?? 0;

    const vidaBase =
      jogador.pontos_de_vida && jogador.pontos_de_vida > 0
        ? jogador.pontos_de_vida
        : (jogador.energia || 0) + (jogador.constituicao || 0);

    const fatorCura = jogador.fator_de_cura || 0;
    const deslocamento = jogador.deslocamento || 0;

    const vidaAtual = vidaBase - (jogador.dano_tomado || 0);


    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,
      vida_atual: vidaAtual,
      fator_de_cura: fatorCura,
      deslocamento,
    };

    const calcMod = (valor: number) => Math.floor(((valor || 0) - 10) / 2);

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

  abrirImagem(src: string) {
    this.imagemSelecionada = src;
    this.modalAberto = true;
    this.cdr.markForCheck();
  }
}

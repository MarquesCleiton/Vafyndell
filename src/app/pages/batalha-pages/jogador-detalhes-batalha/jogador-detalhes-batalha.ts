import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';

@Component({
  selector: 'app-jogador-detalhes-batalha',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jogador-detalhes-batalha.html',
  styleUrls: ['./jogador-detalhes-batalha.css'],
})
export class JogadorDetalhesBatalha implements OnInit {
  jogador: (JogadorDomain & {
    fator_cura?: number;
    vida_total?: number;
    deslocamento?: number;
  }) | null = null;

  atributos: any[] = [];
  loading = true;

  private repo = new BaseRepository<JogadorDomain>('Jogadores', 'Personagem');

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/batalha']);
      return;
    }

    try {
      // 1️⃣ Cache first
      const locais = await this.repo.getLocal();
      let encontrado = locais.find(j => String(j.id) === String(id));

      if (encontrado) {
        this.setJogador(encontrado);

        // 2️⃣ Sync paralelo
        this.repo.sync().then(async updated => {
          if (updated) {
            const atualizados = await this.repo.getLocal();
            const atualizado = atualizados.find(j => String(j.id) === String(id));
            if (atualizado) this.setJogador(atualizado);
          }
        });
      } else {
        // 3️⃣ Fallback online → busca todos e tenta localizar
        const onlineTodos = await this.repo.forceFetch();
        const achadoOnline = onlineTodos.find(j => String(j.id) === String(id));
        if (achadoOnline) {
          this.setJogador(achadoOnline);
        }
      }
    } catch (err) {
      console.error('[JogadorDetalhesBatalha] Erro:', err);
    } finally {
      this.loading = false;
    }
  }

  private setJogador(jogador: JogadorDomain) {
    const vidaBase = jogador.pontos_de_vida && jogador.pontos_de_vida > 0
      ? jogador.pontos_de_vida
      : jogador.energia + jogador.constituicao;

    const fatorCura = Math.floor(jogador.energia / 3);
    const deslocamento = Math.floor(jogador.destreza / 3);

    const vidaAtual = jogador.classe_de_armadura > 0
      ? vidaBase
      : vidaBase - (jogador.dano_tomado || 0);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,
      vida_atual: vidaAtual,
      fator_cura: fatorCura,
      deslocamento: deslocamento,
    };

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
    if (!this.jogador) return;

    if (!this.jogador.email) {
      // NPC
      this.router.navigate(['/cadastro-npc', this.jogador.id], {
        queryParams: { returnUrl: this.router.url },
      });
    } else {
      // Jogador real
      this.router.navigate(['/cadastro-jogador', this.jogador.id], {
        queryParams: { returnUrl: this.router.url },
      });
    }
  }
}

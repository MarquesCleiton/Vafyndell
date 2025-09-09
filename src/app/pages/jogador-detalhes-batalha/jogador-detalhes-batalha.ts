import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/batalha']);
      return;
    }

    try {
      // cache first
      let locais = await JogadorRepository.getLocalJogadores();
      let encontrado = locais.find(j => String(j.id) === String(id)) || null;

      if (encontrado) {
        this.setJogador(encontrado);

        // sincroniza em paralelo
        JogadorRepository.syncJogadores().then(async updated => {
          if (updated) {
            const atualizados = await JogadorRepository.getLocalJogadores();
            const atualizado = atualizados.find(j => String(j.id) === String(id));
            if (atualizado) this.setJogador(atualizado);
          }
        });
      } else {
        // fallback online
        const online = await JogadorRepository.forceFetchJogador();
        if (online && String(online.id) === String(id)) {
          this.setJogador(online);
        }
      }
    } catch (err) {
      console.error('[JogadorDetalhesBatalha] Erro:', err);
    } finally {
      this.loading = false;
    }
  }

  private setJogador(jogador: JogadorDomain) {
    // 📌 Se no cadastro já existe pontos_de_vida, respeitamos esse valor
    const vidaBase = jogador.pontos_de_vida && jogador.pontos_de_vida > 0
      ? jogador.pontos_de_vida
      : jogador.energia + jogador.constituicao;

    const fatorCura = Math.floor(jogador.energia / 3);
    const vidaTotal = vidaBase + jogador.classe_de_armadura;
    const deslocamento = Math.floor(jogador.destreza / 3);

    this.jogador = {
      ...jogador,
      pontos_de_vida: vidaBase,  // 👈 respeita o cadastrado
      fator_cura: fatorCura,
      vida_total: vidaTotal,
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

    // se for NPC → abre no cadastro-npc
    if (!this.jogador.email) {
      this.router.navigate(['/cadastro-npc', this.jogador.id], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    // se for Jogador real → abre no cadastro-jogador
    this.router.navigate(['/cadastro-jogador', this.jogador.id], {
      queryParams: { returnUrl: this.router.url },
    });
  }
}

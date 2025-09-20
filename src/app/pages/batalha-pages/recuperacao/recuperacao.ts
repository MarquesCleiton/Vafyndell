import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { JogadorDomain, JogadorUtils } from '../../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';

@Component({
  selector: 'app-recuperacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperacao.html',
  styleUrls: ['./recuperacao.css'],
})
export class Recuperacao implements OnInit {
  jogador: JogadorDomain | null = null;

  recuperar = 0;
  armadura = 0;
  descricao = '';
  salvando = false;

  JogadorUtils = JogadorUtils; // expõe para o template

  // ✅ agora com BaseRepositoryV2
  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/batalha']);
      return;
    }

    try {
      // 1️⃣ cache first
      const locais = await this.repo.getLocal();
      this.jogador = locais.find(j => String(j.id) === id) || null;

      if (this.jogador) {
        // 2️⃣ sync paralelo
        this.repo.sync().then(async updated => {
          if (updated) {
            const atualizados = await this.repo.getLocal();
            const atualizado = atualizados.find(j => String(j.id) === id);
            if (atualizado) this.jogador = atualizado;
          }
        });
      } else {
        // 3️⃣ fallback online
        const online = await this.repo.forceFetch();
        this.jogador = online.find(j => String(j.id) === id) || null;
      }
    } catch (err) {
      console.error('[Recuperacao] Erro ao carregar jogador:', err);
    }
  }

  incrementarVida() {
    this.recuperar++;
  }
  decrementarVida() {
    this.recuperar = Math.max(0, this.recuperar - 1);
  }

  incrementarArmadura() {
    this.armadura++;
  }
  decrementarArmadura() {
    this.armadura = Math.max(0, this.armadura - 1);
  }

  cancelar() {
    this.router.navigate(['/batalha']);
  }

  async registrarRecuperacao(form: NgForm) {
    if (!this.jogador) return;

    this.salvando = true;
    try {
      const vidaBase = JogadorUtils.getVidaBase(this.jogador);
      const vidaAtual = JogadorUtils.getVidaAtual(this.jogador);
      const vidaMaxRecuperavel = vidaBase - vidaAtual;

      // validações
      if (vidaMaxRecuperavel <= 0 && this.recuperar > 0) {
        alert(`⚠️ ${this.jogador.personagem} já está com a vida cheia!`);
        return;
      }

      if (this.recuperar > vidaMaxRecuperavel) {
        alert(`⚠️ Não é possível recuperar mais do que ${vidaMaxRecuperavel} de vida!`);
        return;
      }

      if (this.recuperar <= 0 && this.armadura <= 0 && !this.descricao.trim()) {
        alert('⚠️ Nenhuma alteração realizada. Ajuste a vida, armadura ou informe uma descrição.');
        return;
      }

      // aplica cura
      const vidaRecuperada = Math.min(this.recuperar, vidaMaxRecuperavel);
      if (vidaRecuperada > 0) {
        this.jogador.dano_tomado = Math.max(
          0,
          (this.jogador.dano_tomado || 0) - vidaRecuperada
        );
      }

      // aplica armadura
      if (this.armadura > 0) {
        this.jogador.classe_de_armadura =
          (this.jogador.classe_de_armadura || 0) + this.armadura;
      }

      // ✅ update sempre via id
      await this.repo.update(this.jogador);

      alert(
        `✅ ${this.jogador.personagem} se recuperou!\n` +
          `❤️ Vida: ${JogadorUtils.getVidaAtual(this.jogador)}/${vidaBase}\n` +
          `🛡️ Armadura: ${this.jogador.classe_de_armadura}\n` +
          (this.descricao ? `📝 ${this.descricao}` : '')
      );

      this.router.navigate(['/batalha']);
    } catch (err) {
      console.error('[Recuperacao] Erro ao registrar:', err);
      alert('❌ Erro ao registrar recuperação.');
    } finally {
      this.salvando = false;
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { JogadorDomain, JogadorUtils } from '../../domain/jogadorDomain';
import { BaseRepository } from '../../repositories/BaseRepository';

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

  private repo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const jogadores = await this.repo.getLocal();
      this.jogador = jogadores.find(j => String(j.id) === id) || null;

      // 🔄 dispara sync em paralelo
      this.repo.sync().then(async updated => {
        if (updated) {
          const atualizados = await this.repo.getLocal();
          const encontrado = atualizados.find(j => String(j.id) === id);
          if (encontrado) this.jogador = encontrado;
        }
      });

      // fallback se não encontrou local
      if (!this.jogador) {
        const online = await this.repo.forceFetch();
        this.jogador = online.find(j => String(j.id) === id) || null;
      }
    }
  }

  incrementarVida() { this.recuperar++; }
  decrementarVida() { this.recuperar = Math.max(0, this.recuperar - 1); }

  incrementarArmadura() { this.armadura++; }
  decrementarArmadura() { this.armadura = Math.max(0, this.armadura - 1); }

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
        this.salvando = false;
        return;
      }

      if (this.recuperar > vidaMaxRecuperavel) {
        alert(`⚠️ Não é possível recuperar mais do que ${vidaMaxRecuperavel} de vida!`);
        this.salvando = false;
        return;
      }

      if (this.recuperar <= 0 && this.armadura <= 0 && !this.descricao.trim()) {
        alert('⚠️ Nenhuma alteração realizada. Ajuste a vida, armadura ou informe uma descrição.');
        this.salvando = false;
        return;
      }

      // aplica cura (não passa do máximo)
      const vidaRecuperada = Math.min(this.recuperar, vidaMaxRecuperavel);
      if (vidaRecuperada > 0) {
        this.jogador.dano_tomado = Math.max(
          0,
          (this.jogador.dano_tomado || 0) - vidaRecuperada
        );
      }

      // aplica armadura (sem limite)
      if (this.armadura > 0) {
        this.jogador.classe_de_armadura =
          (this.jogador.classe_de_armadura || 0) + this.armadura;
      }

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

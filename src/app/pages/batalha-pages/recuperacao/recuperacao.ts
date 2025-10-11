import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { JogadorDomain, JogadorUtils } from '../../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { RegistroDomain } from '../../../domain/RegistroDomain';
import { IdUtils } from '../../../core/utils/IdUtils';

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
  escudo = 0;
  descricao = '';
  salvando = false;

  JogadorUtils = JogadorUtils;

  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private repoRegistro = new BaseRepositoryV2<RegistroDomain>('Registro');

  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/batalha']);
      return;
    }

    try {
      const locais = await this.repo.getLocal();
      this.jogador = locais.find(j => String(j.id) === id) || null;

      if (this.jogador) {
        this.repo.sync().then(async updated => {
          if (updated) {
            const atualizados = await this.repo.getLocal();
            const atualizado = atualizados.find(j => String(j.id) === id);
            if (atualizado) this.jogador = atualizado;
          }
        });
      } else {
        const online = await this.repo.forceFetch();
        this.jogador = online.find(j => String(j.id) === id) || null;
      }
    } catch (err) {
      console.error('[Recuperacao] Erro ao carregar jogador:', err);
    }
  }

  incrementarVida() { this.recuperar++; }
  decrementarVida() { this.recuperar = Math.max(0, this.recuperar - 1); }

  incrementarArmadura() { this.armadura++; }
  decrementarArmadura() { this.armadura = Math.max(0, this.armadura - 1); }

  incrementarEscudo() { this.escudo++; }
  decrementarEscudo() { this.escudo = Math.max(0, this.escudo - 1); }

  cancelar() { this.router.navigate(['/batalha']); }

  async registrarRecuperacao(form: NgForm) {
    if (!this.jogador) return;

    this.salvando = true;
    try {
      const vidaBase = JogadorUtils.getVidaBase(this.jogador);
      const danoTomadoAntes = this.jogador.dano_tomado || 0;
      const vidaAntes = vidaBase - danoTomadoAntes;
      const armaduraAntes = this.jogador.classe_de_armadura || 0;
      const escudoAntes = this.jogador.escudo || 0;

      const vidaMaxRecuperavel = danoTomadoAntes; // ✅ considera o dano real

      // ⚠️ Validações
      if (vidaMaxRecuperavel <= 0 && this.recuperar > 0) {
        alert(`⚠️ ${this.jogador.personagem} já está com a vida cheia!`);
        return;
      }

      if (this.recuperar > vidaMaxRecuperavel) {
        alert(`⚠️ Não é possível recuperar mais do que ${vidaMaxRecuperavel} de vida!`);
        return;
      }

      if (this.recuperar <= 0 && this.armadura <= 0 && this.escudo <= 0 && !this.descricao.trim()) {
        alert('⚠️ Nenhuma alteração realizada. Ajuste vida, armadura, escudo ou adicione uma descrição.');
        return;
      }

      // 🧮 Cálculo da prévia (sem aplicar ainda)
      const vidaRecuperada = Math.min(this.recuperar, vidaMaxRecuperavel);
      const vidaDepois = vidaAntes + vidaRecuperada;
      const armaduraDepois = armaduraAntes + this.armadura;
      const escudoDepois = escudoAntes + this.escudo;

      // 📜 Prévia da recuperação
      let previa = `📋 PRÉVIA DA RECUPERAÇÃO\n\n💖 ${this.jogador.personagem} se recuperará:\n`;

      if (vidaRecuperada > 0)
        previa += `❤️ Vida: ${vidaAntes}/${vidaBase} → ${vidaDepois}/${vidaBase} (+${vidaRecuperada})\n`;

      if (this.armadura > 0)
        previa += `🛡️ Armadura: ${armaduraAntes} → ${armaduraDepois} (+${this.armadura})\n`;

      if (this.escudo > 0)
        previa += `🔰 Escudo: ${escudoAntes} → ${escudoDepois} (+${this.escudo})\n`;

      if (this.descricao?.trim())
        previa += `📝 ${this.descricao}\n`;

      // ⚡ Confirmação
      const confirmar = confirm(previa + '\nDeseja confirmar a recuperação?');
      if (!confirmar) {
        this.salvando = false;
        return;
      }

      // 🧩 Aplicar cura e buffs
      if (vidaRecuperada > 0) {
        this.jogador.dano_tomado = Math.max(0, danoTomadoAntes - vidaRecuperada);
      }
      if (this.armadura > 0) {
        this.jogador.classe_de_armadura = armaduraDepois;
      }
      if (this.escudo > 0) {
        this.jogador.escudo = escudoDepois;
      }

      // 📊 Pós-aplicação real
      const vidaFinal = vidaBase - this.jogador.dano_tomado;

      let detalhes = `💖 ${this.jogador.personagem} se recuperou!\n`;
      if (vidaRecuperada > 0)
        detalhes += `❤️ Vida: ${vidaAntes}/${vidaBase} → ${vidaFinal}/${vidaBase} (+${vidaRecuperada})\n`;
      if (this.armadura > 0)
        detalhes += `🛡️ Armadura: ${armaduraAntes} → ${armaduraDepois} (+${this.armadura})\n`;
      if (this.escudo > 0)
        detalhes += `🔰 Escudo: ${escudoAntes} → ${escudoDepois} (+${this.escudo})\n`;
      if (this.descricao?.trim())
        detalhes += `📝 ${this.descricao}`;

      // 🧾 Registro
      const registro: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: this.jogador.email,
        alvo: this.jogador.email,
        tipo: 'recuperacao',
        acao: 'cura',
        detalhes,
        data: new Date().toISOString(),
      };

      // 💾 Batch (Personagem + Registro)
      await BaseRepositoryV2.batch({
        updateById: { Personagem: [{ ...this.jogador }] },
        create: { Registro: [registro] },
      });

      alert('✅ Recuperação salva!\n\n' + detalhes);
      this.router.navigate(['/batalha']);
    } catch (err) {
      console.error('[Recuperacao] Erro ao registrar (batch):', err);
      alert('❌ Erro ao registrar recuperação.');
    } finally {
      this.salvando = false;
    }
  }
}

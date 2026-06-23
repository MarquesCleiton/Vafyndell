import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';

import { IdUtils } from '../../../core/utils/IdUtils';
import { RegistroDomain } from '../../../domain/RegistroDomain';

import { JogadorUtils } from '../../../domain/jogadorDomain';

@Component({
  selector: 'app-combate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './combate.html',
  styleUrls: ['./combate.css'],
})
export class Combate implements OnInit {
  todosJogadores: JogadorDomain[] = [];

  ofensorSelecionado: JogadorDomain | null = null;
  vitimaSelecionada: JogadorDomain | null = null;
  tipoDanoSelecionado: 'escolha' | 'vida' | 'armadura' | 'escudo' = 'escolha';

  public JogadorUtils = JogadorUtils;

  dano = 0;
  efeitos = '';
  salvando = false;

  // ✅ agora com BaseRepositoryV2 (id é a chave)
  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private repoRegistro = new BaseRepositoryV2<RegistroDomain>('Registro');

  constructor(private router: Router, private route: ActivatedRoute) { }

  async ngOnInit() {
    try {
      console.log('[Combate] Iniciando carregamento de jogadores...');
      // 1️⃣ Local primeiro
      let locais = await this.repo.getLocal();
      if (locais.length) {
        this.todosJogadores = locais;
      }

      // 2️⃣ Sync em paralelo — não reseta seleções já feitas (BUG-07 fix)
      this.repo.sync().then(async updated => {
        if (updated) {
          console.log('[Combate] Jogadores atualizados após sync.');
          this.todosJogadores = await this.repo.getLocal();

          // Atualiza referências dos objetos selecionados com dados frescos
          // sem resetar a escolha do usuário
          if (this.vitimaSelecionada) {
            const vitimaAtualizada = this.todosJogadores.find(
              j => String(j.id) === String(this.vitimaSelecionada!.id)
            );
            if (vitimaAtualizada) this.vitimaSelecionada = vitimaAtualizada;
          }
          if (this.ofensorSelecionado) {
            const ofensorAtualizado = this.todosJogadores.find(
              j => String(j.id) === String(this.ofensorSelecionado!.id)
            );
            if (ofensorAtualizado) this.ofensorSelecionado = ofensorAtualizado;
          }

          // Preenche seleções padrão apenas se ainda estiverem vazias
          if (!this.vitimaSelecionada || !this.ofensorSelecionado) {
            this.prepararSelecoes();
          }
        }
      });

      // 3️⃣ Fallback online
      if (!locais.length) {
        console.log('[Combate] Nenhum jogador local. Buscando online...');
        const online = await this.repo.forceFetch();
        this.todosJogadores = online;
      }

      // Preenche ofensor e vítima iniciais
      this.prepararSelecoes();
    } catch (err) {
      console.error('[Combate] Erro ao carregar jogadores:', err);
    }
  }

  /** 🔑 Define o ofensor (usuário atual) e vítima (rota) */
  private prepararSelecoes() {
    const user = AuthService.getUser();
    this.ofensorSelecionado =
      this.todosJogadores.find(j => j.email === user?.email) || null;

    const vitimaId = this.route.snapshot.paramMap.get('id');
    if (vitimaId) {
      this.vitimaSelecionada =
        this.todosJogadores.find(j => String(j.id) === vitimaId) || null;
    }
  }

  incrementar() {
    this.dano++;
  }

  decrementar() {
    this.dano = Math.max(0, this.dano - 1);
  }

  cancelar() {
    this.router.navigate(['/batalha']);
  }


  async registrarCombate(form: NgForm) {
    if (form.invalid || !this.ofensorSelecionado || !this.vitimaSelecionada) return;

    const tipo = this.tipoDanoSelecionado;
    const danoInformado = this.dano > 0;
    const efeitoInformado = this.efeitos.trim().length > 0;

    // ✅ Validações principais
    if (tipo === 'escolha' && !efeitoInformado) {
      alert('⚠️ Escolha o tipo de dano ou descreva um efeito adicional.');
      return;
    }

    if (tipo !== 'escolha' && !danoInformado) {
      alert('⚠️ Informe um valor de dano válido para o tipo selecionado.');
      return;
    }

    // 🌟 Caso seja apenas efeito
    if (tipo === 'escolha' && efeitoInformado) {
      const registroEfeito: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: this.ofensorSelecionado.email,
        alvo: this.vitimaSelecionada.email,
        tipo: 'batalha',
        acao: 'efeito',
        detalhes:
          `✨ ${this.ofensorSelecionado.personagem} aplicou um efeito em ${this.vitimaSelecionada.personagem}:\n` +
          `${this.efeitos}`,
        data: new Date().toISOString(),
      };

      await BaseRepositoryV2.batch({ create: { Registro: [registroEfeito] } });
      alert('✅ Efeito adicional registrado com sucesso!');
      this.router.navigate(['/batalha']);
      return;
    }

    // ⚙️ Simulação prévia do combate (antes de aplicar)
    let danoAplicado = this.dano;

    const vidaBase = JogadorUtils.getVidaBase(this.vitimaSelecionada);
    const vidaAntes = JogadorUtils.getVidaAtual(this.vitimaSelecionada);
    const armaduraAntes = this.vitimaSelecionada.classe_de_armadura || 0;
    const escudoAntes = this.vitimaSelecionada.escudo || 0;
    const danoTomadoAntes = this.vitimaSelecionada.dano_tomado || 0;

    let escudoAtual = escudoAntes;
    let armaduraAtual = armaduraAntes;
    let danoTomadoAtual = danoTomadoAntes;

    // 🧩 Simulação sem aplicar ainda
    if (tipo === 'vida') {
      danoTomadoAtual += danoAplicado;
    } else if (tipo === 'armadura') {
      const sobra = danoAplicado - armaduraAtual;
      armaduraAtual = Math.max(armaduraAtual - danoAplicado, 0);
      if (sobra > 0) danoTomadoAtual += sobra;
    } else if (tipo === 'escudo') {
      if (danoAplicado <= escudoAtual) {
        escudoAtual -= danoAplicado; // absorve tudo
      } else {
        const sobraEscudo = danoAplicado - escudoAtual;
        escudoAtual = 0;

        const armaduraOriginal = armaduraAtual; // ✅ guarda o valor antes de alterar

        if (sobraEscudo <= armaduraOriginal) {
          armaduraAtual = armaduraOriginal - sobraEscudo;
        } else {
          const sobraArmadura = sobraEscudo - armaduraOriginal;
          armaduraAtual = 0;
          danoTomadoAtual += sobraArmadura; // ✅ agora a sobra real vai pra vida
        }
      }
    }

    // 🔍 Calcula impacto final com base no dano real sofrido
    const danoNaVida = Math.max(danoTomadoAtual - danoTomadoAntes, 0);
    // ✅ Aplica só o dano real causado nesta rodada
    const vidaDepois =
      danoNaVida > 0
        ? vidaAntes - danoNaVida
        : vidaAntes;


    const morto = vidaDepois <= 0;

    // 🧾 Monta o resumo de prévia
    const diffEscudo = escudoAtual - escudoAntes;
    const diffArmadura = armaduraAtual - armaduraAntes;
    const diffVida = vidaDepois - vidaAntes;

    let resumo =
      `⚔️ ${this.ofensorSelecionado.personagem} atacará ${this.vitimaSelecionada.personagem}\n\n` +
      `💥 Dano: ${this.dano} (${tipo.toUpperCase()})\n` +
      `🔰 Escudo: ${escudoAntes} → ${escudoAtual}${diffEscudo < 0 ? ` (${diffEscudo})` : ''}\n` +
      `🛡️ Armadura: ${armaduraAntes} → ${armaduraAtual}${diffArmadura < 0 ? ` (${diffArmadura})` : ''}\n` +
      `❤️ Vida: ${vidaAntes}/${vidaBase} → ${vidaDepois}/${vidaBase}${diffVida < 0 ? ` (${diffVida})` : ''}\n`;

    if (this.efeitos?.trim()) resumo += `\n✨ Efeitos adicionais: ${this.efeitos}`;

    if (escudoAntes > 0 && escudoAtual === 0)
      resumo += `\n⚡ O escudo de ${this.vitimaSelecionada.personagem} será rompido!`;
    if (armaduraAntes > 0 && armaduraAtual === 0)
      resumo += `\n💔 A armadura de ${this.vitimaSelecionada.personagem} será destruída!`;
    if (morto)
      resumo += `\n☠️ ${this.vitimaSelecionada.personagem} cairá em combate!`;

    // ❓Confirma antes de aplicar
    const confirmar = confirm(`📜 PRÉVIA DO ATAQUE\n\n${resumo}\n\nDeseja confirmar o ataque?`);
    if (!confirmar) return;

    // ⚔️ Agora aplica de verdade
    this.salvando = true;
    try {

      this.vitimaSelecionada.escudo = Math.max(0, escudoAtual);
      this.vitimaSelecionada.classe_de_armadura = Math.max(0, armaduraAtual);
      this.vitimaSelecionada.dano_tomado = Math.max(0, danoTomadoAtual);

      const vidaFinal = vidaBase - this.vitimaSelecionada.dano_tomado;

      // 📉 diferenças
      const diffEscudoFinal = this.vitimaSelecionada.escudo - escudoAntes;
      const diffArmaduraFinal = this.vitimaSelecionada.classe_de_armadura - armaduraAntes;
      const diffVidaFinal = vidaFinal - vidaAntes;

      let detalhes =
        `⚔️ ${this.ofensorSelecionado.personagem} atacou ${this.vitimaSelecionada.personagem}\n` +
        `💥 Dano: ${this.dano} (${tipo.toUpperCase()})\n` +
        `🔰 Escudo: ${escudoAntes} → ${this.vitimaSelecionada.escudo}${diffEscudoFinal < 0 ? ` (${diffEscudoFinal})` : ''}\n` +
        `🛡️ Armadura: ${armaduraAntes} → ${this.vitimaSelecionada.classe_de_armadura}${diffArmaduraFinal < 0 ? ` (${diffArmaduraFinal})` : ''}\n` +
        `❤️ Vida: ${vidaAntes}/${vidaBase} → ${vidaFinal}/${vidaBase}${diffVidaFinal < 0 ? ` (${diffVidaFinal})` : ''}`;

      if (this.efeitos?.trim()) detalhes += `\n✨ Efeitos adicionais: ${this.efeitos}`;
      if (escudoAntes > 0 && this.vitimaSelecionada.escudo === 0)
        detalhes += `\n⚡ O escudo de ${this.vitimaSelecionada.personagem} foi rompido!`;
      if (armaduraAntes > 0 && this.vitimaSelecionada.classe_de_armadura === 0)
        detalhes += `\n💔 A armadura de ${this.vitimaSelecionada.personagem} foi destruída!`;
      if (morto)
        detalhes += `\n☠️ ${this.vitimaSelecionada.personagem} caiu em combate!`;

      const registro: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: this.ofensorSelecionado.email,
        alvo: this.vitimaSelecionada.email,
        tipo: 'batalha',
        acao: 'ataque',
        detalhes,
        data: new Date().toISOString(),
      };

      await BaseRepositoryV2.batch({
        updateById: { Personagem: [{ ...this.vitimaSelecionada }] },
        create: { Registro: [registro] },
      });

      alert('✅ Registro de batalha salvo!\n\n' + detalhes);
      this.router.navigate(['/batalha']);
    } catch (err) {
      console.error('[Combate] Erro ao registrar (batch):', err);
      alert('❌ Erro ao registrar combate.');
    } finally {
      this.salvando = false;
    }
  }



}

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

      // 2️⃣ Sync em paralelo
      this.repo.sync().then(async updated => {
        if (updated) {
          console.log('[Combate] Jogadores atualizados após sync.');
          this.todosJogadores = await this.repo.getLocal();
          this.prepararSelecoes();
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

    if (this.dano <= 0) {
      alert('⚠️ Informe um valor de dano válido.');
      return;
    }

    this.salvando = true;
    try {
      let danoAplicado = this.dano;

      // Estado da vítima antes do ataque
      const vidaBase = JogadorUtils.getVidaBase(this.vitimaSelecionada);
      const vidaAntes = JogadorUtils.getVidaAtual(this.vitimaSelecionada);
      const armaduraAntes = this.vitimaSelecionada.classe_de_armadura || 0;

      // Copia dos valores atuais
      let caAtual = armaduraAntes;
      let danoTomadoAtual = this.vitimaSelecionada.dano_tomado || 0;

      // Aplicação do dano
      if (caAtual > 0) {
        if (danoAplicado <= caAtual) {
          // Todo o dano é absorvido pela armadura
          this.vitimaSelecionada.classe_de_armadura = caAtual - danoAplicado;
          danoAplicado = 0;
        } else {
          // Parte quebra a armadura, o excedente vira dano
          this.vitimaSelecionada.classe_de_armadura = 0;
          danoAplicado -= caAtual;
          this.vitimaSelecionada.dano_tomado = danoTomadoAtual + danoAplicado;
        }
      } else {
        // Sem armadura → dano vai direto
        this.vitimaSelecionada.dano_tomado = danoTomadoAtual + danoAplicado;
      }

      // Estado final da vítima
      const vidaDepois = JogadorUtils.getVidaAtual(this.vitimaSelecionada);
      const armaduraDepois = this.vitimaSelecionada.classe_de_armadura || 0;
      const morto = JogadorUtils.estaMorto(this.vitimaSelecionada);

      // 📌 Monta os detalhes com antes/depois
      let detalhes =
        `⚔️ ${this.ofensorSelecionado.personagem} atacou ${this.vitimaSelecionada.personagem}\n` +
        `💥 Dano causado: ${this.dano}\n` +
        `🛡️ Armadura: ${armaduraAntes} → ${armaduraDepois}\n` +
        `❤️ Vida: ${vidaAntes}/${vidaBase} → ${vidaDepois}/${vidaBase}`;

      if (this.efeitos?.trim()) {
        detalhes += `\n✨ Efeitos adicionais: ${this.efeitos}`;
      }

      // 🚨 Eventos especiais
      if (armaduraAntes > 0 && armaduraDepois === 0) {
        detalhes += `\n💔 A armadura de ${this.vitimaSelecionada.personagem} foi destruída!`;
      }
      if (morto) {
        detalhes += `\n☠️ ${this.vitimaSelecionada.personagem} caiu em combate!`;
      }

      // 📌 Cria registro
      const registro: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: this.ofensorSelecionado.email,             // 👈 email do ofensor
        alvo: this.vitimaSelecionada.email,                 // 👈 email da vítima
        tipo: 'batalha',
        acao: 'ataque',
        detalhes,
        data: new Date().toISOString(),
      };

      // ✅ Tudo em 1 batch (Personagem + Registro)
      const result = await BaseRepositoryV2.batch({
        updateById: { Personagem: [{ ...this.vitimaSelecionada }] },
        create: { Registro: [registro] }
      });

      console.log('⚔️ Combate registrado (batch):', result);
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

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

import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { AuthService } from '../../core/auth/AuthService';

@Component({
  selector: 'app-combate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // Material
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

  constructor(private router: Router, private route: ActivatedRoute) {}

  async ngOnInit() {
    try {
      console.log('[Combate] Iniciando carregamento de jogadores...');
      // 1. Carrega local primeiro
      let locais = await JogadorRepository.getLocalJogadores();
      if (locais.length) {
        this.todosJogadores = locais;
      }

      // 2. Em paralelo, dispara sync
      JogadorRepository.syncJogadores().then(async updated => {
        if (updated) {
          console.log('[Combate] Jogadores atualizados após sync.');
          this.todosJogadores = await JogadorRepository.getLocalJogadores();
          this.prepararSelecoes();
        }
      });

      // 3. Se não havia local, força buscar online
      if (!locais.length) {
        console.log('[Combate] Nenhum jogador local. Buscando online...');
        const online = await JogadorRepository.forceFetchJogador();
        if (online) {
          this.todosJogadores = Array.isArray(online) ? online : [online];
        }
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

      // Estado atual da vítima
      let caAtual = this.vitimaSelecionada.classe_de_armadura || 0;
      let danoTomadoAtual = this.vitimaSelecionada.dano_tomado || 0;

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

      // Atualiza no repositório
      await JogadorRepository.updateJogador(this.vitimaSelecionada);

      console.log('⚔️ Combate registrado:', {
        ofensor: this.ofensorSelecionado,
        vitima: this.vitimaSelecionada,
        danoRecebido: this.dano,
        caRestante: this.vitimaSelecionada.classe_de_armadura,
        danoTomadoTotal: this.vitimaSelecionada.dano_tomado,
        efeitos: this.efeitos,
      });

      alert(
        `✅ ${this.ofensorSelecionado.personagem} causou ${this.dano} de dano em ${this.vitimaSelecionada.personagem}!\n` +
        `🛡️ Armadura restante: ${this.vitimaSelecionada.classe_de_armadura}\n` +
        `💥 Dano total sofrido: ${this.vitimaSelecionada.dano_tomado}`
      );

      this.router.navigate(['/batalha']);
    } catch (err) {
      console.error('[Combate] Erro ao registrar:', err);
      alert('❌ Erro ao registrar combate.');
    } finally {
      this.salvando = false;
    }
  }
}

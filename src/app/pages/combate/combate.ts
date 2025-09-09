import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
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
    MatAutocompleteModule,
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

  filtroOfensor = '';
  filtroVitima = '';
  ofensoresFiltrados: JogadorDomain[] = [];
  vitimasFiltradas: JogadorDomain[] = [];

  dano = 0;
  efeitos = '';
  salvando = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  async ngOnInit() {
    this.todosJogadores = await JogadorRepository.getLocalJogadores();

    // Pré-preencher ofensor = jogador atual
    const user = AuthService.getUser();
    this.ofensorSelecionado =
      this.todosJogadores.find(j => j.email === user?.email) || null;
    this.filtroOfensor = this.ofensorSelecionado?.personagem || '';
    this.ofensoresFiltrados = [...this.todosJogadores];

    // Pré-preencher vítima = ID da rota
    const vitimaId = this.route.snapshot.paramMap.get('id');
    if (vitimaId) {
      this.vitimaSelecionada =
        this.todosJogadores.find(j => String(j.id) === vitimaId) || null;
      this.filtroVitima = this.vitimaSelecionada?.personagem || '';
    }
    this.vitimasFiltradas = [...this.todosJogadores];
  }

  filtrarOfensores() {
    const termo = this.filtroOfensor.toLowerCase().trim();
    this.ofensoresFiltrados = termo
      ? this.todosJogadores.filter(j =>
        j.personagem.toLowerCase().includes(termo)
      )
      : [...this.todosJogadores];
  }

  filtrarVitimas() {
    const termo = this.filtroVitima.toLowerCase().trim();
    this.vitimasFiltradas = termo
      ? this.todosJogadores.filter(j =>
        j.personagem.toLowerCase().includes(termo)
      )
      : [...this.todosJogadores];
  }

  selecionarOfensor(j: JogadorDomain) {
    this.ofensorSelecionado = j;
    this.filtroOfensor = j.personagem;
  }

  selecionarVitima(j: JogadorDomain) {
    this.vitimaSelecionada = j;
    this.filtroVitima = j.personagem;
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
    if (form.invalid || !this.ofensorSelecionado || !this.vitimaSelecionada)
      return;

    this.salvando = true;
    try {
      let danoAplicado = this.dano;

      // Armadura atual
      let caAtual = this.vitimaSelecionada.classe_de_armadura || 0;
      let danoTomadoAtual = this.vitimaSelecionada.dano_tomado || 0;

      if (caAtual > 0) {
        if (danoAplicado <= caAtual) {
          // Todo o dano é absorvido pela armadura
          this.vitimaSelecionada.classe_de_armadura = caAtual - danoAplicado;
          danoAplicado = 0;
        } else {
          // Parte do dano quebra a armadura, sobra o excedente
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

      // Log para depuração
      console.log('⚔️ Combate registrado:', {
        ofensor: this.ofensorSelecionado,
        vitima: this.vitimaSelecionada,
        danoRecebido: this.dano,
        caRestante: this.vitimaSelecionada.classe_de_armadura,
        danoTomadoTotal: this.vitimaSelecionada.dano_tomado,
        efeitos: this.efeitos,
      });

      // Alerta amigável
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

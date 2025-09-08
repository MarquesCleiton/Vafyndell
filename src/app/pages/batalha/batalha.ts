import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { Router } from '@angular/router';

@Component({
  selector: 'app-batalha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batalha.html',
  styleUrls: ['./batalha.css'],
})
export class Batalha implements OnInit {
  jogadores: JogadorDomain[] = [];
  jogadoresFiltrados: JogadorDomain[] = [];
  carregando = true;
  filtro = '';

  constructor(private router: Router) {}

  async ngOnInit() {
    try {
      const locais = await JogadorRepository.getAllJogadores();
      if (locais.length > 0) {
        this.jogadores = locais;
        this.aplicarFiltro();
      }

      JogadorRepository.syncJogadores().then(async updated => {
        if (updated) {
          const atualizados = await JogadorRepository.getAllJogadores();
          this.jogadores = atualizados;
          this.aplicarFiltro();
        }
      });
    } catch (err) {
      console.error('[Batalha] Erro ao carregar jogadores:', err);
    } finally {
      this.carregando = false;
    }
  }

  aplicarFiltro() {
    const termo = this.filtro.toLowerCase().trim();
    if (!termo) {
      this.jogadoresFiltrados = [...this.jogadores];
      return;
    }

    this.jogadoresFiltrados = this.jogadores.filter(j =>
      String(j.personagem || '').toLowerCase().includes(termo) ||
      String(j.nome_do_jogador || '').toLowerCase().includes(termo) ||
      String(j.classificacao || '').toLowerCase().includes(termo) ||
      String(j.tipo || '').toLowerCase().includes(termo)
    );
  }

  abrirJogador(jogador: JogadorDomain) {
    this.router.navigate(['/jogador', jogador.id]);
  }

  async excluirNpcDaBatalha(j: JogadorDomain) {
    const confirmacao = confirm(`🗑️ Deseja remover "${j.personagem}" do campo de batalha?`);
    if (!confirmacao) return;

    try {
      await JogadorRepository.updateJogador({ ...j, personagem: `[REMOVIDO] ${j.personagem}` });
      await JogadorRepository.deleteJogador(j.id); // 🔑 precisa existir no repository

      // Atualiza a lista local
      this.jogadores = this.jogadores.filter(x => x.id !== j.id);
      this.aplicarFiltro();

      alert('✅ NPC removido da batalha!');
    } catch (err) {
      console.error('[Batalha] Erro ao excluir NPC:', err);
      alert('❌ Erro ao excluir NPC da batalha.');
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain, JogadorUtils } from '../../domain/jogadorDomain';
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

  // estados de loading por jogador
  processando: { [id: number]: 'abrir' | 'excluir' | 'espada' | 'recuperar' | null } = {};

  JogadorUtils = JogadorUtils; // 👈 expõe no template

  constructor(private router: Router) { }

  async ngOnInit() {
    console.log('[Batalha] ngOnInit → carregando jogadores...');
    try {
      // 1. Busca local primeiro
      const locais = await JogadorRepository.getLocalJogadores();
      if (locais.length > 0) {
        this.jogadores = locais;
        this.aplicarFiltro();
        this.carregando = false;
      }

      // 2. Sync em paralelo
      (async () => {
        const updated = await JogadorRepository.syncJogadores();
        if (updated) {
          const atualizados = await JogadorRepository.getLocalJogadores();
          this.jogadores = atualizados;
          this.aplicarFiltro();
        }
      })();

      // 3. Se não havia nada local, força fetch online
      if (!locais.length) {
        const online = await JogadorRepository.forceFetchJogadores(); // 👈 plural agora
        this.jogadores = online;
        this.aplicarFiltro();
        this.carregando = false;
      }
    } catch (err) {
      console.error('[Batalha] Erro ao carregar jogadores:', err);
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

  async abrirDetalhes(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'abrir';
    setTimeout(() => {
      this.router.navigate(['/jogador-detalhes-batalha', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async acaoEspada(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'espada';
    setTimeout(() => {
      this.router.navigate(['/combate', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async acaoRecuperacao(jogador: JogadorDomain) {
    this.processando[jogador.id] = 'recuperar';
    setTimeout(() => {
      this.router.navigate(['/recuperacao', jogador.id]);
      this.processando[jogador.id] = null;
    }, 400);
  }

  async excluirNpcDaBatalha(j: JogadorDomain) {
    const confirmacao = confirm(`🗑️ Deseja remover "${j.personagem}" do campo de batalha?`);
    if (!confirmacao) return;

    this.processando[j.id] = 'excluir';
    try {
      await JogadorRepository.deleteJogador(j.id);
      this.jogadores = this.jogadores.filter(x => x.id !== j.id);
      this.aplicarFiltro();
      alert('✅ NPC removido da batalha!');
    } catch (err) {
      console.error('[Batalha] Erro ao excluir NPC:', err);
      alert('❌ Erro ao excluir NPC da batalha.');
    } finally {
      this.processando[j.id] = null;
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { OficinaService, ReceitaComStatus } from '../../services/OficinaService';

@Component({
  selector: 'app-oficina',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './oficina.html',
  styleUrls: ['./oficina.css'],
})
export class Oficina implements OnInit {
  categorias: { nome: string; itens: ReceitaComStatus[]; expandido: boolean }[] = [];
  categoriasFiltradas: { nome: string; itens: ReceitaComStatus[]; expandido: boolean }[] = [];

  carregando = true;
  filtro = '';
  fabricaveisOnly = false;

  // controle de loading por ação
  loadingAction: { [id: number]: 'criar' | 'falha' | null } = {};

  // toast global
  mensagem: string | null = null;
  mensagemTipo: 'sucesso' | 'erro' | null = null;

  constructor(private router: Router, private oficinaService: OficinaService) { }

  async ngOnInit() {
    try {
      this.carregando = true;
      const receitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(receitas);
      this.carregando = false;
    } catch (err) {
      console.error('[Oficina] Erro ao carregar receitas:', err);
      this.carregando = false;
    }
  }

  private processarItens(itens: ReceitaComStatus[]) {
    const mapa = new Map<string, ReceitaComStatus[]>();

    itens.forEach(i => {
      const cat = i.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: false,
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  toggleCategoria(cat: any) {
    cat.expandido = !cat.expandido;
  }

  aplicarFiltro() {
    const termo = this.normalize(this.filtro);
    if (!termo && !this.fabricaveisOnly) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map(c => {
        const itens = c.itens.filter(i =>
          (!this.fabricaveisOnly || i.fabricavel) &&
          (this.normalize(i.nome).includes(termo) ||
            this.normalize(i.raridade).includes(termo) ||
            this.normalize(i.efeito).includes(termo) ||
            this.normalize(i.descricao).includes(termo))
        );
        return { ...c, itens, expandido: true };
      })
      .filter(c => c.itens.length > 0);
  }

  normalize(text: string = ''): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  getRaridadeClass(raridade: string): string {
    if (!raridade) return 'comum';
    return raridade.toLowerCase();
  }

  async criarItem(rec: ReceitaComStatus) {
    this.loadingAction[rec.id] = 'criar';
    try {
      await this.oficinaService.criarItem(rec);
      alert(`✅ ${rec.nome} criado com sucesso!`);
      await this.atualizarItem(rec.id);
    } catch (err) {
      console.error(err);
      alert(`❌ Não foi possível criar ${rec.nome}.`);
    } finally {
      this.loadingAction[rec.id] = null;
    }
  }

  async forcarFalha(rec: ReceitaComStatus) {
    this.loadingAction[rec.id] = 'falha';
    try {
      await this.oficinaService.forcarFalha(rec);
      alert(`⚠️ Falha simulada em ${rec.nome}. Ingredientes consumidos.`);
      await this.atualizarItem(rec.id);
    } catch (err) {
      console.error(err);
      alert(`❌ Não foi possível forçar falha em ${rec.nome}.`);
    } finally {
      this.loadingAction[rec.id] = null;
    }
  }


  private async atualizarItem(id: number) {
    try {
      const receitas = await this.oficinaService.getPossiveisReceitas();
      const atualizado = receitas.find(r => r.id === id);
      if (!atualizado) return;

      this.categorias.forEach(cat => {
        const index = cat.itens.findIndex(i => i.id === id);
        if (index !== -1) cat.itens[index] = atualizado;
      });

      this.aplicarFiltro();
    } catch (err) {
      console.error('[Oficina] Erro ao atualizar item:', err);
    }
  }

  private showMensagem(msg: string, tipo: 'sucesso' | 'erro') {
    this.mensagem = msg;
    this.mensagemTipo = tipo;

    setTimeout(() => {
      this.mensagem = null;
      this.mensagemTipo = null;
    }, 3000);
  }
}

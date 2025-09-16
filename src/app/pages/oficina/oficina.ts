import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OficinaService, ReceitaComStatus } from '../../services/OficinaService';

interface CategoriaReceita {
  nome: string;
  itens: ReceitaComStatus[];
  expandido: boolean;
}

@Component({
  selector: 'app-oficina',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './oficina.html',
  styleUrls: ['./oficina.css'],
})
export class Oficina implements OnInit {
  categorias: CategoriaReceita[] = [];
  categoriasFiltradas: CategoriaReceita[] = [];
  carregando = true;
  filtro = '';
  fabricaveisOnly = false;

  // Abas fixas
  abaAtiva: 'recursos' | 'equipamentos' | 'pocoes' | 'outros' = 'recursos';

  // controle de loading
  loadingAction: { [id: string]: 'criar' | 'falha' | null } = {};

  // toast global
  mensagem: string | null = null;
  mensagemTipo: 'sucesso' | 'erro' | null = null;

  private todasReceitas: ReceitaComStatus[] = [];

  // mapeamento de categorias → abas
  private mapaAbas: Record<string, string[]> = {
    recursos: ['Recursos botânicos', 'Mineral', 'Componentes bestiais e animalescos', 'Tesouro', 'Moeda'],
    equipamentos: ['Equipamento', 'Ferramentas', 'Utilitário – Bombas, armadilhas, luz, som, gás, adesivos'],
    pocoes: [
      'Poção de Cura – Regenera vida, cicatriza feridas',
      'Poção Mental – Calmante, foco, memória, sono, esquecimento',
      'Poção de Aprimoramento Físico – Força, resistência, agilidade',
      'Poção Sensorial – Visão, audição, percepção, voz, respiração',
      'Poção de Furtividade – Camuflagem, passos suaves, silêncio',
      'Poção de Energia – Percepção da energia fundamental',
      'Veneno – Sonolência, confusão ou morte',
    ],
    outros: ['Outros'],
  };

  constructor(private router: Router, private oficinaService: OficinaService) {}

  async ngOnInit() {
    try {
      this.carregando = true;
      this.todasReceitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(this.todasReceitas);
    } catch (err) {
      console.error('[Oficina] Erro ao carregar receitas:', err);
    } finally {
      this.carregando = false;
    }
  }

  private processarItens(itens: ReceitaComStatus[]) {
    const estados = new Map(this.categorias.map(c => [c.nome, c.expandido]));
    const mapa = new Map<string, ReceitaComStatus[]>();

    itens.forEach((i) => {
      const cat = i.categoria || 'Outros';
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(i);
    });

    this.categorias = Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nome, itens]) => ({
        nome,
        itens,
        expandido: estados.get(nome) ?? false,
      }));

    this.categoriasFiltradas = [...this.categorias];
  }

  aplicarFiltro() {
    const termo = this.normalize(this.filtro);

    if (!termo && !this.fabricaveisOnly) {
      this.categoriasFiltradas = [...this.categorias];
      return;
    }

    this.categoriasFiltradas = this.categorias
      .map((c) => {
        const itensFiltrados = c.itens.filter((i) =>
          (!this.fabricaveisOnly || i.fabricavel) &&
          (this.normalize(i.nome).includes(termo) ||
           this.normalize(i.raridade).includes(termo) ||
           this.normalize(i.efeito).includes(termo) ||
           this.normalize(i.descricao).includes(termo))
        );

        return {
          ...c,
          itens: itensFiltrados,
          expandido: itensFiltrados.length > 0,
        };
      })
      .filter((c) => c.itens.length > 0);
  }

  normalize(text: string = ''): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  selecionarAba(aba: 'recursos' | 'equipamentos' | 'pocoes' | 'outros') {
    this.abaAtiva = aba;
  }

  pertenceAba(categoria: string): boolean {
    return this.mapaAbas[this.abaAtiva].includes(categoria);
  }

  toggleCategoria(cat: CategoriaReceita) {
    cat.expandido = !cat.expandido;
  }

  getRaridadeClass(raridade: string): string {
    if (!raridade) return 'comum';
    return raridade.toLowerCase();
  }

  async criarItem(rec: ReceitaComStatus) { /* igual ao seu código */ }
  async forcarFalha(rec: ReceitaComStatus) { /* igual ao seu código */ }
}

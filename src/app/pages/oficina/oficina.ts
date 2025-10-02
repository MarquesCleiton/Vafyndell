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
  abas: Array<'recursos' | 'equipamentos' | 'pocoes' | 'outros'> = [
    'recursos',
    'equipamentos',
    'pocoes',
    'outros',
  ];

  // controle de loading por item
  loadingAction: { [id: string]: 'criar' | 'falha' | null } = {};

  private todasReceitas: ReceitaComStatus[] = [];

  private mapaAbas: Record<'recursos' | 'equipamentos' | 'pocoes' | 'outros', string[]> = {
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

  constructor(private router: Router, private oficinaService: OficinaService) { }

  async ngOnInit() {
    try {
      this.carregando = true;
      this.todasReceitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(this.todasReceitas);

      if (this.abas.length > 0) {
        // seleciona a primeira aba que tiver receitas fabricáveis
        const primeiraDisponivel = this.abas.find(a => this.getQuantidadePorAba(a) > 0);
        if (primeiraDisponivel) {
          this.abaAtiva = primeiraDisponivel;
        }
      }

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
        expandido: false, // 👈 já deixa expandido por padrão
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

  async criarItem(rec: ReceitaComStatus) {
    const qtd = rec.quantidade_fabricavel || 1;
    const unidade = rec.unidade_medida || 'unidade(s)';

    const confirmar = confirm(
      `⚒️ Deseja realmente fabricar "${rec.nome}"?\n\n` +
      `➡ Ingredientes serão consumidos.\n` +
      `➡ Você receberá ${qtd} ${unidade}.`
    );
    if (!confirmar) return;

    this.loadingAction[rec.id] = 'criar';
    try {
      await this.oficinaService.criarItem(rec);
      alert(`✅ Você fabricou ${qtd} ${unidade} de "${rec.nome}"!`);

      this.todasReceitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(this.todasReceitas);
    } catch (err) {
      console.error('[Oficina] Erro ao criar item:', err);
      alert('❌ Erro ao fabricar item!');
    } finally {
      this.loadingAction[rec.id] = null;
    }
  }

  async forcarFalha(rec: ReceitaComStatus) {
    const confirmar = confirm(
      `💥 Deseja realmente forçar a falha de "${rec.nome}"?\n\n` +
      `➡ Todos os ingredientes serão perdidos.\n` +
      `➡ Nenhum item será fabricado.`
    );
    if (!confirmar) return;

    this.loadingAction[rec.id] = 'falha';
    try {
      await this.oficinaService.forcarFalha(rec);
      alert(`💥 Falha forçada! Ingredientes de "${rec.nome}" foram consumidos.`);

      this.todasReceitas = await this.oficinaService.getPossiveisReceitas();
      this.processarItens(this.todasReceitas);
    } catch (err) {
      console.error('[Oficina] Erro ao forçar falha:', err);
      alert('❌ Erro ao processar falha!');
    } finally {
      this.loadingAction[rec.id] = null;
    }
  }

  getEmojiFallback(categoria?: string): string {
    if (!categoria) return '📦';

    const mapa: Record<string, string> = {
      recursos: '🌿',
      equipamentos: '⚔️',
      pocoes: '🧪',
      outros: '📦',
    };

    for (const aba of Object.keys(this.mapaAbas)) {
      if (this.mapaAbas[aba as keyof typeof this.mapaAbas].includes(categoria)) {
        return mapa[aba as keyof typeof mapa];
      }
    }

    return '📦';
  }

  abrirItemCatalogo(id: string | number) {
    this.router.navigate(['/item-catalogo', String(id)]);
  }

  getQuantidadePorAba(aba: 'recursos' | 'equipamentos' | 'pocoes' | 'outros'): number {
    const categoriasAba = this.mapaAbas[aba];
    let count = 0;

    this.categorias.forEach(cat => {
      if (categoriasAba.includes(cat.nome)) {
        count += cat.itens.length; // 👈 conta todos os itens, fabricáveis ou não
      }
    });

    return count;
  }


}

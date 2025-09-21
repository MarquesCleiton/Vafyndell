import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { RamoDomain } from '../../../domain/skilltreeDomains/RamoDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';

cytoscape.use(dagre);

interface DagreLayoutOptions extends cytoscape.BaseLayoutOptions {
  name: 'dagre';
  rankDir?: 'TB' | 'LR';
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
  padding?: number;
}

@Component({
  selector: 'app-skilltree',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skilltree.html',
  styleUrls: ['./skilltree.css'],
})
export class SkillTree implements OnInit, AfterViewInit {
  @ViewChildren('cyContainer') cyContainers!: QueryList<ElementRef>;
  private cyInstances: { [arvoreId: string]: Core } = {};

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  ramos: RamoDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  carregando = true;
  habilidadeSelecionada: HabilidadeDomain | null = null;
  abaAtiva: string | null = null;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoRamo = new BaseRepositoryV2<RamoDomain>('Ramos');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
      if (this.caminhos.length > 0) {
        this.abaAtiva = this.caminhos[0].id;
      }
    } catch (err) {
      console.error('[SkillTree] ❌ Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  ngAfterViewInit(): void {
    // inicial render (caso já tenha dados locais)
    if (!this.carregando && this.abaAtiva) {
      this.renderizarArvores();
    }
  }

  get arvoresAtivas(): ArvoreDomain[] {
    if (!this.abaAtiva) return [];
    return this.arvores.filter(
      (a) => String(a.caminho) === String(this.abaAtiva)
    );
  }

  private async loadLocalAndSync() {
    this.caminhos = await this.repoCaminho.getLocal();
    this.arvores = await this.repoArvore.getLocal();
    this.ramos = await this.repoRamo.getLocal();
    this.habilidades = await this.repoHab.getLocal();

    // sync em paralelo
    this.repoCaminho.sync().then(async (updated) => {
      if (updated) this.caminhos = await this.repoCaminho.getLocal();
    });
    this.repoArvore.sync().then(async (updated) => {
      if (updated) this.arvores = await this.repoArvore.getLocal();
    });
    this.repoRamo.sync().then(async (updated) => {
      if (updated) this.ramos = await this.repoRamo.getLocal();
    });
    this.repoHab.sync().then(async (updated) => {
      if (updated) {
        this.habilidades = await this.repoHab.getLocal();
        this.renderizarArvores(); // 👉 redesenha se atualizar
      }
    });

    if (this.caminhos.length === 0) {
      const result = await BaseRepositoryV2.multiFetch([
        'Caminhos',
        'Arvores',
        'Ramos',
        'Habilidades',
      ]);
      this.caminhos = result['Caminhos'] as CaminhoDomain[];
      this.arvores = result['Arvores'] as ArvoreDomain[];
      this.ramos = result['Ramos'] as RamoDomain[];
      this.habilidades = result['Habilidades'] as HabilidadeDomain[];
    }

    // 👉 garantir renderização inicial
    setTimeout(() => this.renderizarArvores(), 0);
  }

  private renderizarArvores() {
    if (!this.abaAtiva) return;

    this.cyContainers.forEach((containerRef, idx) => {
      const arvore = this.arvoresAtivas[idx];
      if (!arvore) return;

      const ramosDaArvore = this.ramos.filter(
        (r) => String(r.arvore) === String(arvore.id)
      );
      const habilidadesDaArvore = this.habilidades.filter((h) =>
        ramosDaArvore.some((r) => String(r.id) === String(h.ramo))
      );

      const elements: ElementDefinition[] = [];

      habilidadesDaArvore.forEach((h) => {
        elements.push({
          data: {
            id: String(h.id),
            label: `${h.habilidade}\nLv ${h.nivel}`,
            habilidade: h.habilidade,
            ramo: h.ramo,
            nivel: h.nivel ?? 1,
            descricao: h.descricao ?? '',
            requisitos: h.requisitos ?? '',
            dependencia: h.dependencia ?? '',
          },
        });

        if (h.dependencia) {
          elements.push({
            data: {
              source: String(h.dependencia),
              target: String(h.id),
            },
          });
        }
      });

      if (this.cyInstances[arvore.id]) {
        this.cyInstances[arvore.id].destroy();
      }

      const layout: DagreLayoutOptions = {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 120,
        rankSep: 100,
        edgeSep: 30,
        padding: 40,
      };

      this.cyInstances[arvore.id] = cytoscape({
        container: containerRef.nativeElement,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#222',
              'border-color': '#555',
              'border-width': 2,
              'label': 'data(label)',
              'color': '#eee',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': '65px',
              'height': '65px',
              'font-size': '10px',
              'text-wrap': 'wrap',
              'text-max-width': '90px',
              'shape': 'ellipse',
            },
          },
          {
            selector: 'node:hover',
            style: {
              'background-color': '#444',
              'border-color': '#bbb',
              'width': '72px',
              'height': '72px',
            },
          },
          {
            selector: 'node.selected',
            style: {
              'background-color': '#007bff',
              'border-color': '#fff',
              'border-width': 3,
              'color': '#fff',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#444',
              'curve-style': 'unbundled-bezier',
              'target-arrow-shape': 'none',
              'control-point-distances': [-30, 30],
              'control-point-weights': [0.5, 0.5],
            },
          },
        ],
        layout,
        userPanningEnabled: true,
        userZoomingEnabled: true,
        boxSelectionEnabled: false,
        autoungrabify: true,
      });

      this.cyInstances[arvore.id].on('tap', 'node', (evt) => {
        const cy = this.cyInstances[arvore.id];
        cy.nodes().removeClass('selected');
        evt.target.addClass('selected');
        const data = evt.target.data() as HabilidadeDomain;
        this.selecionarHab(data);
      });
    });
  }

  selecionarAba(caminho: CaminhoDomain) {
    this.abaAtiva = caminho.id;

    // resetar scroll para a primeira árvore ao trocar aba
    setTimeout(() => {
      const scroll = document.querySelector('.arvores-scroll') as HTMLElement;
      if (scroll) scroll.scrollTo({ left: 0, behavior: 'smooth' });
      this.renderizarArvores();
    }, 0);
  }

  selecionarHab(h: HabilidadeDomain) {
    this.habilidadeSelecionada = h;
  }
}

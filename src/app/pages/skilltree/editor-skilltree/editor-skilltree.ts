import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DepNomePipe } from '../../../pipes/DepNomePipe';
import cytoscape, { Core, ElementDefinition, EdgeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';
import { IdUtils } from '../../../core/utils/IdUtils';

cytoscape.use(dagre);

interface DagreLayoutOptions extends cytoscape.BaseLayoutOptions {
  name: 'dagre';
  rankDir?: 'TB' | 'LR';
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
  padding?: number;
}

type InteractionMode = 'select' | 'connect';

interface NodeChange {
  type: 'create' | 'update' | 'delete';
  habilidade: HabilidadeDomain;
}

interface EdgeChange {
  type: 'create' | 'delete';
  source: string;
  target: string;
}

@Component({
  selector: 'app-editor-skilltree',
  standalone: true,
  imports: [CommonModule, FormsModule, DepNomePipe],
  templateUrl: './editor-skilltree.html',
  styleUrls: ['./editor-skilltree.css'],
})
export class EditorSkillTree implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cyCanvas') cyCanvasRef!: ElementRef;

  // ── Dados ─────────────────────────────────────────────────────────────────
  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  todasHabilidades: HabilidadeDomain[] = [];

  caminhoSelecionado: string | null = null;
  arvoreSelecionada: string | null = null;
  criandoNovaArvore = false;
  editandoArvore = false;
  novaArvoreNome = '';

  criandoNovoCaminho = false;
  editandoCaminho = false;
  novoCaminhoNome = '';

  // ── Estado do editor ──────────────────────────────────────────────────────
  carregando = true;
  salvando = false;
  modo: InteractionMode = 'select';
  painelAberto = false;

  /** Nó selecionado no momento */
  nodeSelecionado: HabilidadeDomain | null = null;

  /** Nó source aguardando clique no target (modo connect) */
  connectSourceId: string | null = null;

  /** Mudanças pendentes para salvar */
  private pendingNodeChanges: Map<string, NodeChange> = new Map();
  private pendingEdgeChanges: EdgeChange[] = [];

  /** IDs de nós criados localmente (ainda não no banco) */
  private nodesLocais: Set<string> = new Set();

  // ── Overlay de Ações (Anel ao redor do nó selecionado) ───────────────────────
  overlayX = 0;
  overlayY = 0;

  // ── Cytoscape ─────────────────────────────────────────────────────────────
  private cy: Core | null = null;

  // ── Repos ─────────────────────────────────────────────────────────────────
  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  constructor(
    public router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    this.carregando = true;
    try {
      await this.carregarDados();
    } finally {
      this.carregando = false;
    }
  }

  ngAfterViewInit() {
    if (!this.carregando && this.arvoreSelecionada) {
      this.inicializarCy();
    }
  }

  ngOnDestroy() {
    this.cy?.destroy();
  }

  // ── Dados ─────────────────────────────────────────────────────────────────
  private async carregarDados() {
    const [caminhos, arvores, habilidades] = await Promise.all([
      this.repoCaminho.getLocal(),
      this.repoArvore.getLocal(),
      this.repoHab.getLocal(),
    ]);

    this.caminhos = caminhos.map(c => ({ ...c, id: String(c.id) }));
    this.arvores = arvores.map(a => ({ ...a, id: String(a.id), caminho: String(a.caminho) }));
    this.todasHabilidades = habilidades.map(h => ({
      ...h,
      id: String(h.id),
      caminho: String(h.caminho),
      arvore: String(h.arvore),
      dependencia: h.dependencia ? String(h.dependencia) : null,
    }));

    // Sync em background
    this.syncBackground();
  }

  private async syncBackground() {
    const [cs, as, hs] = await Promise.all([
      this.repoCaminho.sync(),
      this.repoArvore.sync(),
      this.repoHab.sync(),
    ]);

    if (cs || as || hs) {
      const [caminhos, arvores, habilidades] = await Promise.all([
        this.repoCaminho.getLocal(),
        this.repoArvore.getLocal(),
        this.repoHab.getLocal(),
      ]);

      this.caminhos = caminhos.map(c => ({ ...c, id: String(c.id) }));
      this.arvores = arvores.map(a => ({ ...a, id: String(a.id), caminho: String(a.caminho) }));

      // Atualizar apenas habilidades que não foram modificadas localmente
      const habs = habilidades.map(h => ({
        ...h,
        id: String(h.id),
        caminho: String(h.caminho),
        arvore: String(h.arvore),
        dependencia: h.dependencia ? String(h.dependencia) : null,
      }));
      this.todasHabilidades = habs;

      if (this.arvoreSelecionada) {
        this.inicializarCy();
      }
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  get arvoresDoCaminho(): ArvoreDomain[] {
    return this.caminhoSelecionado
      ? this.arvores.filter(a => a.caminho === this.caminhoSelecionado)
      : [];
  }

  get habilidadesDaArvore(): HabilidadeDomain[] {
    return this.arvoreSelecionada
      ? this.todasHabilidades.filter(h => h.arvore === this.arvoreSelecionada)
      : [];
  }

  get temMudancasPendentes(): boolean {
    return this.pendingNodeChanges.size > 0 || this.pendingEdgeChanges.length > 0;
  }

  get nomeArvoreSelecionada(): string {
    if (!this.arvoreSelecionada) return '';
    return this.arvores.find(a => a.id === this.arvoreSelecionada)?.arvore ?? '';
  }

  get nomeCaminhoSelecionado(): string {
    if (!this.caminhoSelecionado) return '';
    return this.caminhos.find(c => c.id === this.caminhoSelecionado)?.caminho ?? '';
  }

  // ── Seleção de Caminho/Árvore ─────────────────────────────────────────────
  onCaminhoChange() {
    this.arvoreSelecionada = null;
    this.nodeSelecionado = null;
    this.painelAberto = false;
    this.criandoNovoCaminho = false;
    this.editandoCaminho = false;
    this.novoCaminhoNome = '';
    this.limparEditor();
  }

  async onArvoreChange() {
    this.nodeSelecionado = null;
    this.painelAberto = false;
    this.criandoNovaArvore = false;
    this.editandoArvore = false;
    this.novaArvoreNome = '';
    this.limparPendencias();
    // Aguarda o DOM atualizar para o cyCanvasRef estar disponível
    setTimeout(() => this.inicializarCy(), 0);
  }

  async excluirArvore() {
    if (!this.arvoreSelecionada) return;
    
    const arvore = this.arvores.find(a => a.id === this.arvoreSelecionada);
    if (!arvore) return;

    if (!confirm(`Tem certeza que deseja excluir a árvore "${arvore.arvore}" e TODAS as suas habilidades? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      this.salvando = true;
      const habilidades = this.todasHabilidades.filter(h => h.arvore === this.arvoreSelecionada);
      
      const deletes: any = {};
      deletes['Arvores'] = [{ id: this.arvoreSelecionada }];
      
      if (habilidades.length > 0) {
        // Habilidades que realmente existem no banco
        const habsNoBanco = habilidades.filter(h => !this.nodesLocais.has(h.id));
        if (habsNoBanco.length > 0) {
          deletes['Habilidades'] = habsNoBanco.map(h => ({ id: h.id }));
        }
      }

      await BaseRepositoryV2.batch({
        deleteById: deletes
      });

      this.mostrarToast(`Árvore excluída com sucesso!`, 'success');
      
      this.arvoreSelecionada = null;
      this.limparEditor();
      await this.carregarDados();

    } catch(err) {
      console.error('[EditorSkillTree] Erro ao excluir árvore:', err);
      this.mostrarToast('Erro ao excluir árvore.', 'error');
    } finally {
      this.salvando = false;
    }
  }

  iniciarNovaArvore() {
    this.arvoreSelecionada = null;
    this.criandoNovaArvore = true;
    this.novaArvoreNome = '';
    this.nodeSelecionado = null;
    
    this.cy?.elements().remove();
    this.nodesLocais.clear();
  }

  confirmarNovaArvore() {
    if (!this.novaArvoreNome.trim() || !this.caminhoSelecionado) return;
    const novaArvore: ArvoreDomain = {
      id: IdUtils.generateULID(),
      caminho: this.caminhoSelecionado,
      arvore: this.novaArvoreNome.trim(),
    };
    this.arvores.push(novaArvore);
    this.arvoreSelecionada = novaArvore.id;
    this.criandoNovaArvore = false;

    // Marcar árvore como pendente de criação
    this.pendingNodeChanges.set('__arvore__' + novaArvore.id, {
      type: 'create',
      habilidade: { id: novaArvore.id, caminho: novaArvore.caminho, arvore: '', habilidade: novaArvore.arvore, dependencia: null }
    });

    setTimeout(() => this.inicializarCy(), 0);
  }

  cancelarNovaArvore() {
    this.criandoNovaArvore = false;
    this.novaArvoreNome = '';
  }

  iniciarEdicaoArvore() {
    if (!this.arvoreSelecionada) return;
    this.editandoArvore = true;
    this.novaArvoreNome = this.nomeArvoreSelecionada;
  }

  confirmarEdicaoArvore() {
    if (!this.novaArvoreNome.trim() || !this.arvoreSelecionada) return;
    const arvore = this.arvores.find(a => a.id === this.arvoreSelecionada);
    if (arvore) {
      arvore.arvore = this.novaArvoreNome.trim();
      
      if (!this.pendingNodeChanges.has('__arvore__' + arvore.id)) {
        this.pendingNodeChanges.set('__update_arvore__' + arvore.id, {
          type: 'update',
          habilidade: { id: arvore.id, caminho: arvore.caminho, arvore: '', habilidade: arvore.arvore, dependencia: null }
        });
      }
    }
    this.editandoArvore = false;
  }

  cancelarEdicaoArvore() {
    this.editandoArvore = false;
    this.novaArvoreNome = '';
  }

  iniciarNovoCaminho() {
    this.caminhoSelecionado = null;
    this.arvoreSelecionada = null;
    this.criandoNovoCaminho = true;
    this.novoCaminhoNome = '';
    this.limparEditor();
  }

  confirmarNovoCaminho() {
    if (!this.novoCaminhoNome.trim()) return;
    const novoCaminho: CaminhoDomain = {
      id: IdUtils.generateULID(),
      caminho: this.novoCaminhoNome.trim(),
    };
    this.caminhos.push(novoCaminho);
    this.caminhoSelecionado = novoCaminho.id;
    this.criandoNovoCaminho = false;

    this.pendingNodeChanges.set('__caminho__' + novoCaminho.id, {
      type: 'create',
      habilidade: { id: novoCaminho.id, caminho: novoCaminho.caminho, arvore: '', habilidade: '', dependencia: null }
    });

    this.arvoreSelecionada = null;
    this.nodeSelecionado = null;
    this.painelAberto = false;
    
    this.cy?.elements().remove();
    this.nodesLocais.clear();
  }

  cancelarNovoCaminho() {
    this.criandoNovoCaminho = false;
    this.novoCaminhoNome = '';
  }

  iniciarEdicaoCaminho() {
    if (!this.caminhoSelecionado) return;
    this.editandoCaminho = true;
    this.novoCaminhoNome = this.nomeCaminhoSelecionado;
  }

  confirmarEdicaoCaminho() {
    if (!this.novoCaminhoNome.trim() || !this.caminhoSelecionado) return;
    const caminho = this.caminhos.find(c => c.id === this.caminhoSelecionado);
    if (caminho) {
      caminho.caminho = this.novoCaminhoNome.trim();
      
      if (!this.pendingNodeChanges.has('__caminho__' + caminho.id)) {
        this.pendingNodeChanges.set('__update_caminho__' + caminho.id, {
          type: 'update',
          habilidade: { id: caminho.id, caminho: caminho.caminho, arvore: '', habilidade: '', dependencia: null }
        });
      }
    }
    this.editandoCaminho = false;
  }

  cancelarEdicaoCaminho() {
    this.editandoCaminho = false;
    this.novoCaminhoNome = '';
  }

  async excluirCaminho() {
    if (!this.caminhoSelecionado) return;
    const caminho = this.caminhos.find(c => c.id === this.caminhoSelecionado);
    if (!caminho) return;

    if (!confirm(`Tem certeza que deseja excluir o caminho "${caminho.caminho}", todas as suas árvores e habilidades? Esta ação é IRREVERSÍVEL.`)) {
      return;
    }

    try {
      this.salvando = true;
      const arvoresDoCaminho = this.arvores.filter(a => a.caminho === this.caminhoSelecionado);
      const habilidades = this.todasHabilidades.filter(h => arvoresDoCaminho.some(a => a.id === h.arvore) || h.caminho === this.caminhoSelecionado);
      
      const deletes: any = {};
      deletes['Caminhos'] = [{ id: this.caminhoSelecionado }];
      
      if (arvoresDoCaminho.length > 0) {
        deletes['Arvores'] = arvoresDoCaminho.map(a => ({ id: a.id }));
      }
      
      const habsNoBanco = habilidades.filter(h => !this.nodesLocais.has(h.id));
      if (habsNoBanco.length > 0) {
        deletes['Habilidades'] = habsNoBanco.map(h => ({ id: h.id }));
      }

      await BaseRepositoryV2.batch({
        deleteById: deletes
      });

      this.mostrarToast(`Caminho excluído com sucesso!`, 'success');
      
      this.caminhoSelecionado = null;
      this.onCaminhoChange();
      await this.carregarDados();

    } catch(err) {
      console.error('[EditorSkillTree] Erro ao excluir caminho:', err);
      this.mostrarToast('Erro ao excluir caminho.', 'error');
    } finally {
      this.salvando = false;
    }
  }

  // ── Cytoscape ─────────────────────────────────────────────────────────────
  private inicializarCy() {
    if (!this.cyCanvasRef) return;
    this.cy?.destroy();

    const habs = this.habilidadesDaArvore;
    const elements: ElementDefinition[] = [];

    // Nodes
    habs.forEach(h => {
      elements.push({
        data: {
          id: h.id,
          label: h.habilidade || '?',
          habilidade: h.habilidade,
          descricao: h.descricao || '',
          requisitos: h.requisitos || '',
          dependencia: h.dependencia,
        },
        classes: this.nodesLocais.has(h.id) ? 'node-novo' : '',
      });
    });

    // Edges (baseado em dependencia)
    habs.forEach(h => {
      if (h.dependencia) {
        elements.push({
          data: {
            id: `${h.dependencia}->${h.id}`,
            source: h.dependencia,
            target: h.id,
          },
        });
      }
    });

    this.cy = cytoscape({
      container: this.cyCanvasRef.nativeElement,
      elements,
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 80,
        rankSep: 100,
        edgeSep: 20,
        padding: 50,
      } as DagreLayoutOptions,
      style: this.buildCyStyle(),
      userPanningEnabled: true,
      userZoomingEnabled: true,
      autoungrabify: false,
    });

    this.bindCyEvents();
  }

  private buildCyStyle(): any[] {
    return [
      {
        selector: 'node',
        style: {
          'background-color': '#1c1b1b',
          'background-gradient-stop-colors': '#1c1b1b #201f1f',
          'border-color': '#4f4632',
          'border-width': 2,
          label: 'data(label)',
          color: '#d4c5ab',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 8,
          'text-background-color': '#0a0a0a',
          'text-background-opacity': 1,
              'text-background-shape': 'roundrectangle',
          'text-background-padding': '4px',
          width: '64px',
          height: '64px',
          'font-size': '11px',
          'font-family': '"JetBrains Mono", monospace',
          'font-weight': 'bold',
          'text-wrap': 'wrap',
          'text-max-width': '70px',
          shape: 'rectangle',
          'overlay-padding': '6px',
          'transition-property': 'border-color, border-width, background-color',
          'transition-duration': '0.2s' as any,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#ffc107',
          'border-width': 3,
          'background-color': '#2a2a2a',
          color: '#fff',
        },
      },
      {
        selector: 'node.node-novo',
        style: {
          'border-color': '#4caf50',
          'border-width': 3,
          'background-color': '#1b5e20',
          color: '#a5d6a7',
        },
      },
      {
        selector: 'node.connect-source',
        style: {
          'border-color': '#ffc107',
          'border-width': 4,
          'background-color': '#5b4300',
          color: '#fabd00',
        },
      },
      {
        selector: 'node.connect-hover',
        style: {
          'border-color': '#ffb3ac',
          'border-width': 3,
          'background-color': '#b71c1c',
          color: '#fff',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#ffb300', // Bright gold line
          'target-arrow-shape': 'none', // No arrows in reference
          'curve-style': 'taxi',
          'taxi-direction': 'downward',
          'taxi-turn': '20px' as any,
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          width: 3,
        },
      },
      {
        selector: 'edge.edge-hover',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          width: 3,
          cursor: 'pointer',
        },
      },
      // Estilos custom drag-to-connect
      {
        selector: '.ghost-node',
        style: {
          'width': 1,
          'height': 1,
          'background-opacity': 0,
          'events': 'no'
        }
      },
      {
        selector: '.ghost-edge',
        style: {
          'width': 3,
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'events': 'no'
        }
      }
    ];
  }

  private atualizarOverlayPosicao() {
    if (!this.nodeSelecionado || !this.cy) return;
    const node = this.cy.getElementById(this.nodeSelecionado.id);
    if (node && node.length) {
      const pos = node.renderedPosition();
      this.ngZone.run(() => {
        this.overlayX = pos.x;
        this.overlayY = pos.y;
        this.cdr.detectChanges();
      });
    }
  }

  private bindCyEvents() {
    if (!this.cy) return;

    // Trigger change detection on zoom for the UI controls
    this.cy.on('zoom', () => {
      this.zoomLevel = this.cy!.zoom();
      this.cdr.detectChanges();
    });

    // Clique em nó
    this.cy.on('tap', 'node', (evt) => {
      const nodeId = String(evt.target.id());

      if (this.modo === 'connect') {
        this.handleConnectClick(nodeId);
        return;
      }

      // Modo select: seleciona nó e mostra o menu ring
      const hab = this.habilidadesDaArvore.find(h => h.id === nodeId) || null;
      this.nodeSelecionado = hab ? { ...hab } : null;
      this.painelAberto = false;
      this.atualizarOverlayPosicao();

      // Zoom in e centraliza no nó clicado
      this.cy?.animate({
        center: { eles: evt.target },
        zoom: Math.max(this.cy.zoom(), 1.5)
      }, { duration: 300 });
    });

    // Clique no background: deseleciona
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        if (this.modo === 'connect') {
          this.cancelarConexao();
        }
        this.nodeSelecionado = null;
        this.painelAberto = false;
        this.cy?.nodes().removeClass('connect-source connect-hover');
      }
    });

    // Hover em aresta para mostrar que pode deletar
    this.cy.on('mouseover', 'edge', (evt) => {
      evt.target.addClass('edge-hover');
    });
    this.cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('edge-hover');
    });

    // Clique em aresta: deleta
    this.cy.on('tap', 'edge', (evt) => {
      if (this.modo !== 'select') return;
      const edge = evt.target as EdgeSingular;
      const sourceId = String(edge.source().id());
      const targetId = String(edge.target().id());
      this.deletarAresta(sourceId, targetId);
    });

    // Atualiza posição do overlay ao fazer pan/zoom/drag
    this.cy.on('zoom pan', () => {
      this.atualizarOverlayPosicao();
    });
    this.cy.on('position', 'node', () => {
      this.atualizarOverlayPosicao();
    });
  }

  // ── Modos de Interação ─────────────────────────────────────────────────────
  setModo(m: InteractionMode) {
    this.modo = m;
    if (m !== 'connect') {
      this.cancelarConexao();
    }
  }

  private cancelarConexao() {
    this.connectSourceId = null;
    this.cy?.nodes().removeClass('connect-source connect-hover');
  }

  private handleConnectClick(nodeId: string) {
    if (!this.connectSourceId) {
      // Primeiro clique: define source
      this.connectSourceId = nodeId;
      this.cy?.nodes().removeClass('connect-source');
      this.cy?.getElementById(nodeId).addClass('connect-source');
    } else {
      // Segundo clique: cria aresta source → target
      if (this.connectSourceId === nodeId) {
        this.cancelarConexao();
        return;
      }
      this.criarAresta(this.connectSourceId, nodeId);
      this.cancelarConexao();
    }
  }

  // ── Operações de Nó ─────────────────────────────────────────────────────────
  /** Adiciona nó solto no canvas (sem pai) */
  adicionarNo() {
    if (!this.arvoreSelecionada || !this.caminhoSelecionado) return;

    const novoId = IdUtils.generateULID();
    const novaHab: HabilidadeDomain = {
      id: novoId,
      caminho: this.caminhoSelecionado,
      arvore: this.arvoreSelecionada,
      habilidade: 'Nova Habilidade',
      descricao: '',
      requisitos: '',
      dependencia: null,
    };

    this.todasHabilidades.push(novaHab);
    this.nodesLocais.add(novoId);

    this.cy?.add({
      data: {
        id: novoId,
        label: novaHab.habilidade,
        habilidade: novaHab.habilidade,
        descricao: novaHab.descricao,
        requisitos: novaHab.requisitos,
        dependencia: null,
      },
      classes: 'node-novo',
      position: this.calcularPosicaoNoNo(),
    });

    this.pendingNodeChanges.set(novoId, { type: 'create', habilidade: novaHab });
    this.nodeSelecionado = { ...novaHab };

    this.reorganizarLayout(false);
    
    // Seleciona nativamente no cytoscape e centraliza
    setTimeout(() => {
      this.cy?.nodes().unselect();
      const node = this.cy?.getElementById(novoId);
      if (node && node.length) {
        node.select();
        this.cy?.animate({ center: { eles: node } }, { duration: 300 });
        this.atualizarOverlayPosicao();
      }
    }, 50);
  }

  /**
   * Cria um nó filho conectado diretamente abaixo do nó especificado.
   * Acionado pelo botão "+" do overlay ao passar o mouse sobre um nó.
   */
  adicionarFilhoDeNo(paiId: string) {
    if (!this.arvoreSelecionada || !this.caminhoSelecionado) return;

    const novoId = IdUtils.generateULID();
    const novaHab: HabilidadeDomain = {
      id: novoId,
      caminho: this.caminhoSelecionado,
      arvore: this.arvoreSelecionada,
      habilidade: 'Nova Habilidade',
      descricao: '',
      requisitos: '',
      dependencia: paiId,
    };

    this.todasHabilidades.push(novaHab);
    this.nodesLocais.add(novoId);

    // Posiciona o filho abaixo do pai
    const paiNode = this.cy?.getElementById(paiId);
    const paiPos = paiNode?.position() ?? { x: 200, y: 200 };
    const irmaoOffset = (this.habilidadesDaArvore.filter(h => h.dependencia === paiId).length - 1) * 100;

    this.cy?.add([
      {
        data: {
          id: novoId,
          label: novaHab.habilidade,
          habilidade: novaHab.habilidade,
          descricao: '',
          requisitos: '',
          dependencia: paiId,
        },
        classes: 'node-novo',
        position: { x: paiPos.x + irmaoOffset, y: paiPos.y + 140 },
      },
      {
        data: {
          id: `${paiId}->${novoId}`,
          source: paiId,
          target: novoId,
        },
      },
    ]);

    this.pendingNodeChanges.set(novoId, { type: 'create', habilidade: novaHab });

    // Foca na nova habilidade
    this.nodeSelecionado = { ...novaHab };

    this.reorganizarLayout(false);

    // Seleciona nativamente no cytoscape e centraliza
    setTimeout(() => {
      this.cy?.nodes().unselect();
      const node = this.cy?.getElementById(novoId);
      if (node && node.length) {
        node.select();
        this.cy?.animate({ center: { eles: node } }, { duration: 300 });
        this.atualizarOverlayPosicao();
      }
    }, 50);
  }

  /**
   * Ativa a conexão arrastando a partir do nó selecionado usando eventos de janela.
   */
  isDraggingLink = false;

  startLinkDrag(event: MouseEvent | TouchEvent) {
    if (this.isDraggingLink) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    if (!this.nodeSelecionado || !this.cy) return;
    
    const sourceId = this.nodeSelecionado.id;
    this.isDraggingLink = true;

    const ghostNodeId = '__ghost_node__';
    const ghostEdgeId = '__ghost_edge__';

    this.cy.getElementById(ghostNodeId).remove();
    this.cy.getElementById(ghostEdgeId).remove();

    let initialX = 0;
    let initialY = 0;
    if (event instanceof MouseEvent) {
      initialX = event.clientX;
      initialY = event.clientY;
    } else if (event.touches && event.touches.length > 0) {
      initialX = event.touches[0].clientX;
      initialY = event.touches[0].clientY;
    }

    const pos = this.getCyPosition(initialX, initialY);
    
    this.cy.add([
      { data: { id: ghostNodeId, label: '' }, position: pos, classes: 'ghost-node' },
      { data: { id: ghostEdgeId, source: sourceId, target: ghostNodeId }, classes: 'ghost-edge' }
    ]);

    const onMove = (e: MouseEvent | TouchEvent) => {
      // Impede o scroll/pull-to-refresh nativo do celular durante o drag
      if (e.cancelable) {
        e.preventDefault();
      }

      let cx = 0;
      let cy = 0;
      if ('touches' in e && e.touches.length > 0) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      }
      
      const p = this.getCyPosition(cx, cy);
      this.cy?.getElementById(ghostNodeId).position(p);
      
      const targetNode = this.getNodeAtPosition(cx, cy, ghostNodeId);
      this.cy?.nodes().removeClass('connect-hover');
      if (targetNode && targetNode.id() !== sourceId) {
        targetNode.addClass('connect-hover');
      }
    };

    const onUp = (e: MouseEvent | TouchEvent) => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onUp as EventListener);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp as EventListener);
      window.removeEventListener('touchcancel', onUp as EventListener);
      
      this.isDraggingLink = false;
      this.cy?.nodes().removeClass('connect-hover');
      
      this.cy?.getElementById(ghostEdgeId).remove();
      this.cy?.getElementById(ghostNodeId).remove();
      
      let cx = 0;
      let cy = 0;
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      } else {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      }

      const targetNode = this.getNodeAtPosition(cx, cy, ghostNodeId);
      if (targetNode && targetNode.id() !== sourceId) {
        this.criarAresta(sourceId, targetNode.id());
      }
    };

    // { passive: false } é obrigatório para que o preventDefault() funcione no touchmove!
    window.addEventListener('mousemove', onMove as EventListener, { passive: false });
    window.addEventListener('mouseup', onUp as EventListener);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onUp as EventListener);
    window.addEventListener('touchcancel', onUp as EventListener);
  }

  private getCyPosition(clientX: number, clientY: number) {
    const rect = this.cyCanvasRef.nativeElement.getBoundingClientRect();
    const pan = this.cy!.pan();
    const zoom = this.cy!.zoom();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  }

  private getNodeAtPosition(clientX: number, clientY: number, ignoreId: string) {
    if (!this.cy) return null;
    const rect = this.cyCanvasRef.nativeElement.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const nodes = this.cy.nodes();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.id() === ignoreId) continue;
      const bb = n.renderedBoundingBox();
      if (x >= bb.x1 && x <= bb.x2 && y >= bb.y1 && y <= bb.y2) {
        return n;
      }
    }
    return null;
  }

  private calcularPosicaoNoNo(): { x: number; y: number } {
    if (!this.cy) return { x: 200, y: 200 };
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();
    const center = {
      x: (this.cyCanvasRef.nativeElement.offsetWidth / 2 - pan.x) / zoom,
      y: (this.cyCanvasRef.nativeElement.offsetHeight / 2 - pan.y) / zoom,
    };
    return {
      x: center.x + (Math.random() - 0.5) * 100,
      y: center.y + (Math.random() - 0.5) * 80,
    };
  }

  deletarNoSelecionado() {
    if (!this.nodeSelecionado) return;
    const id = this.nodeSelecionado.id;
    const nome = this.nodeSelecionado.habilidade;

    const dependentes = this.habilidadesDaArvore.filter(h => h.dependencia === id);
    let msg = `Deletar "${nome}"?`;
    if (dependentes.length > 0) {
      msg += `\n\nIsso também removerá a dependência de:\n${dependentes.map(d => `- ${d.habilidade}`).join('\n')}`;
    }
    if (!confirm(msg)) return;

    // Remove dependência dos filhos no estado local
    dependentes.forEach(dep => {
      const idx = this.todasHabilidades.findIndex(h => h.id === dep.id);
      if (idx !== -1) {
        this.todasHabilidades[idx] = { ...this.todasHabilidades[idx], dependencia: null };
        // Marca filho como update (se já existe no banco)
        if (!this.nodesLocais.has(dep.id)) {
          this.pendingNodeChanges.set(dep.id, {
            type: 'update',
            habilidade: { ...this.todasHabilidades[idx] },
          });
        }
        // Remove aresta do cytoscape
        this.cy?.getElementById(`${id}->${dep.id}`).remove();
        // Atualiza dado do nó filho
        this.cy?.getElementById(dep.id).data('dependencia', null);
      }
    });

    // Marca para deleção (se já existe no banco)
    if (!this.nodesLocais.has(id)) {
      const hab = this.todasHabilidades.find(h => h.id === id)!;
      this.pendingNodeChanges.set(id, { type: 'delete', habilidade: hab });
    } else {
      // Era local, apenas cancela o create
      this.pendingNodeChanges.delete(id);
      this.nodesLocais.delete(id);
    }

    // Remove do array local e do cy
    this.todasHabilidades = this.todasHabilidades.filter(h => h.id !== id);
    this.cy?.getElementById(id).remove();
    this.nodeSelecionado = null;
  }

  // ── Operações de Aresta ────────────────────────────────────────────────────
  private criarAresta(sourceId: string, targetId: string) {
    // Verificar se o target já tem dependência
    const targetHab = this.todasHabilidades.find(h => h.id === targetId);
    if (!targetHab) return;

    if (targetHab.dependencia && targetHab.dependencia !== sourceId) {
      const depAtual = this.todasHabilidades.find(h => h.id === targetHab.dependencia);
      if (!confirm(`"${targetHab.habilidade}" já tem dependência de "${depAtual?.habilidade ?? '?'}". Substituir?`)) return;
      // Remove aresta antiga
      this.cy?.getElementById(`${targetHab.dependencia}->${targetId}`).remove();
      // Marca remoção da aresta antiga
      this.pendingEdgeChanges.push({ type: 'delete', source: targetHab.dependencia, target: targetId });
    }

    // Verificar ciclo simples
    if (this.criariaClico(sourceId, targetId)) {
      alert('⚠️ Isso criaria um ciclo no grafo! Operação cancelada.');
      return;
    }

    // Atualizar dependência no estado local
    const idx = this.todasHabilidades.findIndex(h => h.id === targetId);
    if (idx !== -1) {
      this.todasHabilidades[idx] = { ...this.todasHabilidades[idx], dependencia: sourceId };
    }

    // Adicionar aresta no cy
    const edgeId = `${sourceId}->${targetId}`;
    if (!this.cy?.getElementById(edgeId).length) {
      this.cy?.add({ data: { id: edgeId, source: sourceId, target: targetId } });
    }

    // Marcar nó target como update
    const habAtualizado = this.todasHabilidades[idx];
    if (this.nodesLocais.has(targetId)) {
      this.pendingNodeChanges.set(targetId, { type: 'create', habilidade: habAtualizado });
    } else {
      this.pendingNodeChanges.set(targetId, { type: 'update', habilidade: habAtualizado });
    }

    this.pendingEdgeChanges.push({ type: 'create', source: sourceId, target: targetId });
  }

  private deletarAresta(sourceId: string, targetId: string) {
    if (!confirm(`Remover a conexão entre estes nós?`)) return;

    // Atualiza dependência do target para null
    const idx = this.todasHabilidades.findIndex(h => h.id === targetId);
    if (idx !== -1) {
      this.todasHabilidades[idx] = { ...this.todasHabilidades[idx], dependencia: null };

      if (this.nodesLocais.has(targetId)) {
        this.pendingNodeChanges.set(targetId, { type: 'create', habilidade: this.todasHabilidades[idx] });
      } else {
        this.pendingNodeChanges.set(targetId, { type: 'update', habilidade: this.todasHabilidades[idx] });
      }
    }

    // Remove do cy
    this.cy?.getElementById(`${sourceId}->${targetId}`).remove();
    this.pendingEdgeChanges.push({ type: 'delete', source: sourceId, target: targetId });
  }

  private criariaClico(sourceId: string, targetId: string): boolean {
    // Verifica se targetId é ancestral de sourceId
    const visitados = new Set<string>();
    const pilha = [sourceId];
    while (pilha.length > 0) {
      const atual = pilha.pop()!;
      if (atual === targetId) return true;
      if (visitados.has(atual)) continue;
      visitados.add(atual);
      const hab = this.todasHabilidades.find(h => h.id === atual);
      if (hab?.dependencia) {
        pilha.push(hab.dependencia);
      }
    }
    return false;
  }

  // ── Edição do Painel Lateral ──────────────────────────────────────────────
  onEditNode() {
    if (!this.nodeSelecionado) return;
    const id = this.nodeSelecionado.id;

    // Atualiza no array local
    const idx = this.todasHabilidades.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.todasHabilidades[idx] = { ...this.nodeSelecionado };
    }

    // Atualiza label no cy
    this.cy?.getElementById(id).data('label', this.nodeSelecionado.habilidade || '?');

    // Marca como pendente
    if (this.nodesLocais.has(id)) {
      this.pendingNodeChanges.set(id, { type: 'create', habilidade: { ...this.nodeSelecionado } });
    } else {
      this.pendingNodeChanges.set(id, { type: 'update', habilidade: { ...this.nodeSelecionado } });
    }
  }

  abrirPainelEdicao() {
    this.painelAberto = true;
  }

  fecharPainel() {
    this.painelAberto = false;
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  async salvarTudo() {
    if (!this.temMudancasPendentes) return;

    try {
      this.salvando = true;
      const creates: any = {};
      const updates: any = {};
      const deletes: any = {};

      for (const [key, change] of this.pendingNodeChanges.entries()) {
        if (key.startsWith('__caminho__')) {
          const caminhoId = key.replace('__caminho__', '');
          const caminho = this.caminhos.find(c => c.id === caminhoId);
          if (caminho) {
            if (!creates['Caminhos']) creates['Caminhos'] = [];
            creates['Caminhos'].push(caminho);
          }
          continue;
        }

        if (key.startsWith('__update_caminho__')) {
          const caminhoId = key.replace('__update_caminho__', '');
          const caminho = this.caminhos.find(c => c.id === caminhoId);
          if (caminho) {
            if (!updates['Caminhos']) updates['Caminhos'] = [];
            updates['Caminhos'].push(caminho);
          }
          continue;
        }

        if (key.startsWith('__arvore__')) {
          const arvoreId = key.replace('__arvore__', '');
          const arvore = this.arvores.find(a => a.id === arvoreId);
          if (arvore) {
            if (!creates['Arvores']) creates['Arvores'] = [];
            creates['Arvores'].push(arvore);
          }
          continue;
        }

        if (key.startsWith('__update_arvore__')) {
          const arvoreId = key.replace('__update_arvore__', '');
          const arvore = this.arvores.find(a => a.id === arvoreId);
          if (arvore) {
            if (!updates['Arvores']) updates['Arvores'] = [];
            updates['Arvores'].push(arvore);
          }
          continue;
        }

        if (change.type === 'create') {
          if (!creates['Habilidades']) creates['Habilidades'] = [];
          creates['Habilidades'].push(change.habilidade);
        } else if (change.type === 'update') {
          if (!updates['Habilidades']) updates['Habilidades'] = [];
          updates['Habilidades'].push(change.habilidade);
        } else if (change.type === 'delete') {
          if (!deletes['Habilidades']) deletes['Habilidades'] = [];
          deletes['Habilidades'].push({ id: change.habilidade.id });
        }
      }

      await BaseRepositoryV2.batch({
        create: Object.keys(creates).length ? creates : undefined,
        updateById: Object.keys(updates).length ? updates : undefined,
        deleteById: Object.keys(deletes).length ? deletes : undefined,
      });

      this.limparPendencias();
      this.nodesLocais.clear();

      // Recarrega para sincronizar
      await this.carregarDados();
      this.inicializarCy();

      this.mostrarToast('✅ Árvore salva com sucesso!', 'success');
    } catch (err) {
      console.error('[EditorSkillTree] ❌ Erro ao salvar:', err);
      this.mostrarToast('❌ Erro ao salvar. Tente novamente.', 'error');
    } finally {
      this.salvando = false;
    }
  }

  private limparPendencias() {
    this.pendingNodeChanges.clear();
    this.pendingEdgeChanges = [];
  }

  private limparEditor() {
    this.cy?.destroy();
    this.cy = null;
    this.limparPendencias();
    this.nodesLocais.clear();
  }

  // ── Re-layout ─────────────────────────────────────────────────────────────
  reorganizarLayout(fit: boolean = true) {
    if (!this.cy) return;
    this.cy.layout({
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 80,
      rankSep: 100,
      padding: 50,
      fit: fit,
    } as any).run();
  }

  fitCanvas() {
    this.cy?.fit(undefined, 40);
  }

  // ── Zoom Controls ────────────────────────────────────────────────────────
  zoomLevel = 1;

  getZoomPercent(): string {
    return this.cy ? (this.cy.zoom() * 100).toFixed(2) : '100.00';
  }

  zoomIn() {
    if (this.cy) {
      this.cy.zoom(this.cy.zoom() * 1.2);
      this.cy.center();
    }
  }

  zoomOut() {
    if (this.cy) {
      this.cy.zoom(this.cy.zoom() * 0.8);
      this.cy.center();
    }
  }

  // ── Toast simples ─────────────────────────────────────────────────────────
  toastMsg = '';
  toastTipo: 'success' | 'error' | '' = '';
  toastVisible = false;

  private toastTimer: any;
  mostrarToast(msg: string, tipo: 'success' | 'error') {
    clearTimeout(this.toastTimer);
    this.toastMsg = msg;
    this.toastTipo = tipo;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => (this.toastVisible = false), 3500);
  }
}

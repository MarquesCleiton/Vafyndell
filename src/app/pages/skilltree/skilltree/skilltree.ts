import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  QueryList,
  ElementRef,
  Input,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';
import { AuthService } from '../../../core/auth/AuthService';
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

export interface HabilidadeJogador {
  id: string;
  jogador: string;
  habilidade: string;
  data_aquisicao: string;
}

@Component({
  selector: 'app-skilltree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skilltree.html',
  styleUrls: ['./skilltree.css'],
})
export class SkillTree implements OnInit, AfterViewInit {
  @Input() jogadorId?: string; // se informado, trava edição
  @ViewChild('cyContainer') cyContainer!: ElementRef;
  private cy: Core | null = null;

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  habilidades: HabilidadeDomain[] = [];
  habilidadesJogador: HabilidadeJogador[] = [];

  carregando = true;
  habilidadeSelecionada: HabilidadeDomain | null = null;
  caminhoSelecionado: string | null = null;
  arvoreSelecionada: string | null = null;

  @Input() alturaDinamica: string = 'calc(100dvh - 112px)';

  somenteVisualizacao = false;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');
  private repoHabJog = new BaseRepositoryV2<HabilidadeJogador>(
    'Habilidades_jogadores'
  );

  private userEmail: string | null = null;

  constructor(private router: Router, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  processando = false;

  async ngOnInit() {
    this.carregando = true;
    try {
      if (this.jogadorId) {
        this.somenteVisualizacao = true;
        this.userEmail = this.jogadorId;
      } else {
        const user = AuthService.getUser();
        if (!user?.email) throw new Error('Usuário não autenticado.');
        this.userEmail = user.email;
      }

      if (!this.userEmail) throw new Error('Email do jogador não definido.');

      await this.loadLocalAndSync(this.userEmail);

      if (this.caminhos.length > 0) {
        this.caminhoSelecionado = this.caminhos[0].id;
        this.onCaminhoChange();
      }
    } catch (err) {
      console.error('[SkillTree] ❌ Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  ngAfterViewInit() {
    // Inicialização da view.
  }

  get arvoresDoCaminho(): ArvoreDomain[] {
    if (!this.caminhoSelecionado) return [];
    return this.arvores.filter(
      (a) => String(a.caminho) === String(this.caminhoSelecionado)
    );
  }

  onCaminhoChange() {
    this.arvoreSelecionada = null;
    const arvores = this.arvoresDoCaminho;
    if (arvores.length > 0) {
      this.arvoreSelecionada = arvores[0].id;
      this.onArvoreChange();
    } else {
      if (this.cy) {
        this.cy.destroy();
        this.cy = null;
      }
    }
  }

  getNomeArvoreSelecionada(): string {
    if (!this.arvoreSelecionada) return '';
    const arvore = this.arvores.find(a => a.id === this.arvoreSelecionada);
    return arvore ? arvore.arvore : '';
  }

  onArvoreChange() {
    setTimeout(() => {
      this.renderizarArvore();
    }, 50);
  }

  private normalizeHabJog(list: HabilidadeJogador[]): HabilidadeJogador[] {
    return list.map((h) => ({ ...h, habilidade: String(h.habilidade) }));
  }

  private async loadLocalAndSync(email: string) {
    const [caminhosLocal, arvoresLocal, habilidadesLocal, habJogLocal] =
      await Promise.all([
        this.repoCaminho.getLocal(),
        this.repoArvore.getLocal(),
        this.repoHab.getLocal(),
        this.repoHabJog.getLocal(),
      ]);

    this.caminhos = caminhosLocal;
    this.arvores = arvoresLocal;
    this.habilidades = habilidadesLocal;
    this.habilidadesJogador = this.normalizeHabJog(
      habJogLocal.filter((h) => h.jogador === email)
    );

    if (this.arvoreSelecionada) {
      this.renderizarArvore();
    }

    (async () => {
      const [camSync, arvSync, habSync, habJogSync] = await Promise.all([
        this.repoCaminho.sync(),
        this.repoArvore.sync(),
        this.repoHab.sync(),
        this.repoHabJog.sync(),
      ]);

      if (camSync || arvSync || habSync || habJogSync) {
        const [caminhosAtual, arvoresAtual, habilidadesAtual, habJogAtual] =
          await Promise.all([
            this.repoCaminho.getLocal(),
            this.repoArvore.getLocal(),
            this.repoHab.getLocal(),
            this.repoHabJog.getLocal(),
          ]);

        this.caminhos = caminhosAtual;
        this.arvores = arvoresAtual;
        this.habilidades = habilidadesAtual;
        this.habilidadesJogador = this.normalizeHabJog(
          habJogAtual.filter((h) => h.jogador === email)
        );

        if (this.arvoreSelecionada) {
          this.renderizarArvore();
        }
      }
    })();
  }

  private renderizarArvore() {
    if (!this.arvoreSelecionada || !this.cyContainer) return;

    const arvoreId = this.arvoreSelecionada;

    const habilidadesDaArvore = this.habilidades.filter(
      (h) => String(h.arvore) === String(arvoreId)
    );

    const elements: ElementDefinition[] = [];

    habilidadesDaArvore.forEach((h) => {
      const acquired = this.temHabilidade(h.id);

      elements.push({
        data: {
          ...h,
          id: String(h.id),
          label: `${h.habilidade}`,
        },
        classes: acquired ? 'habilidade-acquired' : '',
      });

      if (
        h.dependencia &&
        habilidadesDaArvore.some((x) => String(x.id) === String(h.dependencia))
      ) {
        const sourceAcquired = this.temHabilidade(h.dependencia);
        
        elements.push({
          data: { source: String(h.dependencia), target: String(h.id) },
          classes: (sourceAcquired && acquired) ? 'habilidade-acquired-edge' : '',
        });
      }
    });

    if (this.cy) {
      this.cy.destroy();
    }

    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 80,
        rankSep: 100,
        padding: 50,
      } as DagreLayoutOptions,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#1c1b1b',
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
            selector: 'node.habilidade-acquired',
            style: {
              'border-color': '#ffc107',
              'border-width': 3,
              'background-color': '#2a2a2a',
              color: '#ffc107',
              'text-background-color': '#1a1814',
              'background-image': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMzgiIGZpbGw9IiNmZmMxMDciPiYjeDI3MTQ7PC90ZXh0Pjwvc3ZnPg==',
              'background-fit': 'contain',
              'background-position-x': '50%',
              'background-position-y': '50%'
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
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#ffb300',
              'target-arrow-shape': 'none',
              'curve-style': 'taxi',
              'taxi-direction': 'downward',
              'taxi-turn': '20px' as any,
            },
          },
          {
            selector: 'edge.habilidade-acquired-edge',
            style: {
              width: 3,
              'line-color': '#ffc107',
            }
          }
        ],
        userPanningEnabled: true,
        userZoomingEnabled: true,
        autoungrabify: true,
      });

    this.cy.on('tap', 'node', (evt) => {
      this.cy?.nodes().removeClass('selected');
      evt.target.addClass('selected');

      const zoomLevel = 1.2;
      const nodePos = evt.target.position();
      const pan = {
        x: this.cy!.width() / 2 - zoomLevel * nodePos.x,
        y: this.cy!.height() / 3 - zoomLevel * nodePos.y
      };

      this.cy?.animate({ 
        zoom: zoomLevel, 
        pan: pan 
      }, { duration: 300 });

      const id = String(evt.target.data('id'));
      const habilidade =
        this.habilidades.find((h) => String(h.id) === id) || null;
      
      this.ngZone.run(() => {
        this.selecionarHab(habilidade);
        this.cdr.detectChanges();
      });
    });
  }

  selecionarHab(h: HabilidadeDomain | null) {
    this.habilidadeSelecionada = h;
  }

  editarHabilidade(id: string) {
    if (!id || this.somenteVisualizacao) return;
    this.router.navigate(['/edicao-skilltree', id]);
  }

  temHabilidade(habilidadeId: string | undefined): boolean {
    if (!habilidadeId) return false;
    return this.habilidadesJogador.some(
      (hj) => String(hj.habilidade) === String(habilidadeId)
    );
  }

  private coletarDependencias(
    habilidade: HabilidadeDomain
  ): HabilidadeDomain[] {
    const deps: HabilidadeDomain[] = [];
    let atual: HabilidadeDomain | undefined = habilidade;
    while (atual?.dependencia) {
      const dep = this.habilidades.find(
        (h) => String(h.id) === String(atual!.dependencia)
      );
      if (dep && !this.temHabilidade(dep.id)) {
        deps.unshift(dep);
      }
      atual = dep;
    }
    return deps;
  }

  private coletarDependentes(
    habilidade: HabilidadeDomain
  ): HabilidadeDomain[] {
    const remover: HabilidadeDomain[] = [];
    const buscar = (id: string) => {
      const filhos = this.habilidades.filter(
        (h) => String(h.dependencia) === String(id)
      );
      for (const f of filhos) {
        remover.push(f);
        buscar(String(f.id));
      }
    };
    buscar(String(habilidade.id));
    return remover;
  }

  async adicionarHabilidadeJogador(habilidade: HabilidadeDomain) {
    if (this.somenteVisualizacao) return;
    if (this.temHabilidade(habilidade.id)) return;

    const dependencias = this.coletarDependencias(habilidade);
    const cadeia = [...dependencias, habilidade];

    const lista = cadeia
      .map((d) => `- ${d.habilidade}`)
      .join('\n');
    if (
      !confirm(`⚠️ Deseja realmente adicionar a habilidade?\n\n${lista}`)
    )
      return;

    this.processando = true;
    try {
      const toSave = cadeia.map((h) => ({
        id: IdUtils.generateULID(),
        jogador: this.userEmail!,
        habilidade: String(h.id),
        data_aquisicao: new Date().toISOString(),
      }));

      await this.repoHabJog.createBatch(toSave);

      this.habilidadesJogador = this.normalizeHabJog(
        (await this.repoHabJog.getLocal()).filter(
          (h) => h.jogador === this.userEmail
        )
      );

      this.renderizarArvore();
    } finally {
      this.processando = false;
    }
  }

  async removerHabilidadeJogador(habilidade: HabilidadeDomain) {
    if (this.somenteVisualizacao) return;
    const dependentes = this.coletarDependentes(habilidade);

    const dependentesJogador = dependentes.filter((d) =>
      this.temHabilidade(d.id)
    );
    const cadeia = [habilidade, ...dependentesJogador];

    const lista = cadeia
      .map((d) => `- ${d.habilidade}`)
      .join('\n');
    if (
      !confirm(`⚠️ Deseja realmente remover a habilidade?\n\n${lista}`)
    )
      return;

    this.processando = true;
    try {
      const registrosRemover = this.habilidadesJogador.filter((hj) =>
        cadeia.some((h) => String(h.id) === String(hj.habilidade))
      );
      const idsRemover = registrosRemover.map((r) => r.id);

      await this.repoHabJog.deleteBatch(idsRemover);

      this.habilidadesJogador = this.normalizeHabJog(
        (await this.repoHabJog.getLocal()).filter(
          (h) => h.jogador === this.userEmail
        )
      );

      this.renderizarArvore();
    } finally {
      this.processando = false;
    }
  }

  fecharModal() {
    this.habilidadeSelecionada = null;
  }

  // ── Controles de Câmera ───────────────────────────────────────────────────
  zoomIn() {
    if (!this.cy) return;
    this.cy.zoom(this.cy.zoom() * 1.2);
  }

  zoomOut() {
    if (!this.cy) return;
    this.cy.zoom(this.cy.zoom() * 0.8);
  }

  fitCanvas() {
    if (!this.cy) return;
    this.cy.fit(undefined, 50);
  }

  getZoomPercent(): string {
    if (!this.cy) return '100';
    return (this.cy.zoom() * 100).toFixed(0);
  }
}

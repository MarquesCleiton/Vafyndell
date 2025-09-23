import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChildren,
  QueryList,
  ElementRef,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './skilltree.html',
  styleUrls: ['./skilltree.css'],
})
export class SkillTree implements OnInit, AfterViewInit {
  @Input() jogadorId?: string; // se informado, trava edição
  @ViewChildren('cyContainer') cyContainers!: QueryList<ElementRef>;
  private cyInstances: { [arvoreId: string]: Core } = {};

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  habilidades: HabilidadeDomain[] = [];
  habilidadesJogador: HabilidadeJogador[] = [];

  carregando = true;
  habilidadeSelecionada: HabilidadeDomain | null = null;
  abaAtiva: string | null = null;

  somenteVisualizacao = false;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');
  private repoHabJog = new BaseRepositoryV2<HabilidadeJogador>(
    'Habilidades_jogadores'
  );

  private userEmail: string | null = null;

  constructor(private router: Router) {}

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
        this.abaAtiva = this.caminhos[0].id;
      }
    } catch (err) {
      console.error('[SkillTree] ❌ Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  ngAfterViewInit() {
    this.cyContainers.changes.subscribe(() => {
      if (this.abaAtiva && !this.carregando) {
        this.renderizarArvores();
      }
    });
  }

  get arvoresAtivas(): ArvoreDomain[] {
    if (!this.abaAtiva) return [];
    return this.arvores.filter(
      (a) => String(a.caminho) === String(this.abaAtiva)
    );
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

    this.renderizarArvores();

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

        this.renderizarArvores();
      }
    })();
  }

  private renderizarArvores() {
    if (!this.abaAtiva) return;

    this.cyContainers.forEach((containerRef, idx) => {
      const arvore = this.arvoresAtivas[idx];
      if (!arvore) return;

      const habilidadesDaArvore = this.habilidades.filter(
        (h) => String(h.arvore) === String(arvore.id)
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
          elements.push({
            data: { source: String(h.dependencia), target: String(h.id) },
          });
        }
      });

      if (this.cyInstances[arvore.id]) {
        this.cyInstances[arvore.id].destroy();
      }

      this.cyInstances[arvore.id] = cytoscape({
        container: containerRef.nativeElement,
        elements,
        layout: {
          name: 'dagre',
          rankDir: 'TB',
          nodeSep: 120,
          rankSep: 100,
          edgeSep: 30,
          padding: 40,
        } as DagreLayoutOptions,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#222',
              'border-color': '#555',
              'border-width': 2,
              label: 'data(label)',
              color: '#eee',
              'text-valign': 'center',
              'text-halign': 'center',
              width: '65px',
              height: '65px',
              'font-size': '10px',
              'text-wrap': 'wrap',
              'text-max-width': '90px',
            },
          },
          {
            selector: 'node.habilidade-acquired',
            style: {
              'background-color': '#28a745',
              'border-color': '#fff',
              'border-width': 3,
              color: '#fff',
            },
          },
          {
            selector: 'node.selected',
            style: {
              'background-color': '#007bff',
              'border-color': '#fff',
              'border-width': 3,
              color: '#fff',
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#666',
              'curve-style': 'unbundled-bezier',
              'control-point-distances': [-30, 30],
              'control-point-weights': [0.5, 0.5],
            },
          },
        ],
        userPanningEnabled: true,
        userZoomingEnabled: true,
        autoungrabify: true,
      });

      this.cyInstances[arvore.id].on('tap', 'node', (evt) => {
        const cy = this.cyInstances[arvore.id];
        cy.nodes().removeClass('selected');
        evt.target.addClass('selected');

        const id = String(evt.target.data('id'));
        const habilidade =
          this.habilidades.find((h) => String(h.id) === id) || null;
        this.selecionarHab(habilidade);
      });
    });
  }

  selecionarAba(caminho: CaminhoDomain) {
    this.abaAtiva = caminho.id;
    setTimeout(() => this.renderizarArvores(), 0);
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

      this.renderizarArvores();
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

      this.renderizarArvores();
    } finally {
      this.processando = false;
    }
  }

  fecharModal() {
    this.habilidadeSelecionada = null;
  }
}

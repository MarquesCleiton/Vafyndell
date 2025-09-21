import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';
import { IdUtils } from '../../../core/utils/IdUtils';

cytoscape.use(dagre);

@Component({
  selector: 'app-edicao-skilltree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edicao-skilltree.html',
  styleUrls: ['./edicao-skilltree.css'],
})
export class EdicaoSkillTree implements OnInit, AfterViewInit {
  @ViewChild('cyPreview', { static: false }) cyPreviewRef!: ElementRef;
  private cyInstance: Core | null = null;

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  carregando = true;
  salvando = false;
  excluindo = false;
  editMode = false;

  caminhoSelecionado: string | null = null;
  arvoreSelecionada: string | null = null;
  dependenciaSelecionada: string | null = null;

  novaArvoreNome: string = '';

  habilidadeEdit: HabilidadeDomain = {
    id: '',
    caminho: '',
    arvore: '',
    habilidade: '',
    nivel: 1,
    requisitos: '',
    descricao: '',
    dependencia: null,
  };

  habilidadeSelecionada: HabilidadeDomain | null = null;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  constructor(private route: ActivatedRoute, public router: Router) { }

  async ngOnInit() {
    this.caminhos = await this.repoCaminho.getLocal();
    this.arvores = await this.repoArvore.getLocal();
    this.habilidades = await this.repoHab.getLocal();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const hab = await this.repoHab.getById(id);
      if (hab) {
        this.habilidadeEdit = {
          ...hab,
          id: String(hab.id),
          caminho: String(hab.caminho),
          arvore: String(hab.arvore),
          dependencia: hab.dependencia ? String(hab.dependencia) : null,
        };
        this.caminhoSelecionado = this.habilidadeEdit.caminho;
        this.arvoreSelecionada = this.habilidadeEdit.arvore;
        this.dependenciaSelecionada = this.habilidadeEdit.dependencia;
        this.editMode = true;

        this.onCaminhoChange(this.caminhoSelecionado, false);
        this.onArvoreChange(this.arvoreSelecionada);
      }
    }

    this.renderPreview();
  }

  get arvoresDoCaminho(): ArvoreDomain[] {
    return this.caminhoSelecionado
      ? this.arvores.filter(
        (a) => String(a.caminho) === String(this.caminhoSelecionado)
      )
      : [];
  }

  get habilidadesDaArvore(): HabilidadeDomain[] {
    return this.arvoreSelecionada && this.arvoreSelecionada !== 'nova'
      ? this.habilidades.filter(
        (h) => String(h.arvore) === String(this.arvoreSelecionada)
      )
      : [];
  }

  onCaminhoChange(id: string | null, fromUser = true) {
    this.caminhoSelecionado = id;
    if (fromUser) {
      this.arvoreSelecionada = null;
    }
    this.atualizarPreview();
  }

  onArvoreChange(id: string | null) {
    this.arvoreSelecionada = id;
    if (id === 'nova') {
      this.novaArvoreNome = '';
    }
    this.atualizarPreview();
  }

  onDependenciaChange(value: string | null) {
    this.dependenciaSelecionada = value;
    this.habilidadeEdit.dependencia = value;
    this.atualizarPreview();
  }

  ngAfterViewInit(): void {
    this.renderPreview();
  }

  // ======================
  // PREVIEW
  // ======================
  private renderPreview() {
    if (!this.cyPreviewRef) return;

    const elements: ElementDefinition[] = [];

    const existentes = this.habilidadesDaArvore;
    existentes.forEach((h) => {
      const isEditing =
        this.editMode && this.habilidadeEdit.id && String(h.id) === String(this.habilidadeEdit.id);
      const hab = isEditing ? this.habilidadeEdit : h;

      elements.push({
        data: { id: String(hab.id), label: `${hab.habilidade}\nLv ${hab.nivel}` },
        classes: isEditing ? 'habilidade-edit' : '',
      });

      if (hab.dependencia) {
        elements.push({
          data: { source: String(hab.dependencia), target: String(hab.id) },
        });
      }
    });

    if (!this.editMode && this.habilidadeEdit.habilidade && this.arvoreSelecionada) {
      const tempId = this.habilidadeEdit.id || 'novaHab';
      elements.push({
        data: {
          id: tempId,
          label: `${this.habilidadeEdit.habilidade}\nLv ${this.habilidadeEdit.nivel}`,
        },
        classes: 'nova-habilidade',
      });
      if (this.habilidadeEdit.dependencia) {
        elements.push({
          data: { source: String(this.habilidadeEdit.dependencia), target: tempId },
        });
      }
    }

    if (this.cyInstance) this.cyInstance.destroy();

    this.cyInstance = cytoscape({
      container: this.cyPreviewRef.nativeElement,
      elements,
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
            shape: 'ellipse',
          },
        },
        {
          selector: 'node.habilidade-edit',
          style: {
            'background-color': '#0056b3',
            'border-color': '#0d6efd',
            'border-width': 4,
            color: '#fff',
          },
        },
        {
          selector: 'node.nova-habilidade',
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
      layout: { name: 'dagre', rankDir: 'TB', nodeSep: 100, rankSep: 80 } as any,
      autoungrabify: true,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    this.cyInstance.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      this.habilidadeSelecionada =
        this.habilidades.find((h) => String(h.id) === id) || null;
    });
  }

  // ======================
  // SALVAR / EXCLUIR
  // ======================
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const creates: any = {};
      const updates: any = {};
      const deletes: any = {};

      if (this.arvoreSelecionada === 'nova' && this.novaArvoreNome.trim()) {
        const novaArvore: ArvoreDomain = {
          id: IdUtils.generateULID(),
          caminho: this.caminhoSelecionado || '',
          arvore: this.novaArvoreNome.trim(),
        };
        this.arvores.push(novaArvore);
        this.arvoreSelecionada = novaArvore.id;

        creates['Arvores'] = [novaArvore];
      }

      if (!this.habilidadeEdit.id) {
        this.habilidadeEdit.id = IdUtils.generateULID();
        this.habilidadeEdit.caminho = this.caminhoSelecionado || '';
        this.habilidadeEdit.arvore = this.arvoreSelecionada || '';
      }

      this.habilidadeEdit.dependencia = this.dependenciaSelecionada
        ? String(this.dependenciaSelecionada)
        : null;

      if (!this.habilidades.find((h) => String(h.id) === this.habilidadeEdit.id)) {
        if (!creates['Habilidades']) creates['Habilidades'] = [];
        creates['Habilidades'].push(this.habilidadeEdit);
      } else {
        if (!updates['Habilidades']) updates['Habilidades'] = [];
        updates['Habilidades'].push(this.habilidadeEdit);
      }

      await BaseRepositoryV2.batch({
        create: Object.keys(creates).length ? creates : undefined,
        updateById: Object.keys(updates).length ? updates : undefined,
        deleteById: Object.keys(deletes).length ? deletes : undefined,
      });

      alert('✅ Habilidade salva com sucesso!');
      this.router.navigate(['/skills-jogador']);
    } catch (err) {
      console.error('[EdicaoSkillTree] ❌ Erro ao salvar:', err);
      alert('❌ Erro ao salvar');
    } finally {
      this.salvando = false;
    }
  }

  async excluir() {
    if (!this.habilidadeEdit.id) return;

    // 🔎 Buscar dependentes antes
    const dependentes = this.habilidades.filter(
      (h) => h.dependencia === this.habilidadeEdit.id
    );

    let mensagem = `Tem certeza que deseja excluir a habilidade "${this.habilidadeEdit.habilidade}"?`;
    if (dependentes.length > 0) {
      const nomes = dependentes.map((h) => `• ${h.habilidade} (Lv ${h.nivel})`).join('\n');
      mensagem += `\n\n⚠️ As seguintes habilidades perderão esta dependência:\n${nomes}`;
    }

    if (!confirm(mensagem)) return;

    try {
      this.excluindo = true;

      const updates: any = {};
      const deletes: any = {};

      // Remover dependência dos filhos
      if (dependentes.length > 0) {
        dependentes.forEach((h) => {
          h.dependencia = null;
        });
        updates['Habilidades'] = dependentes;
      }

      deletes['Habilidades'] = [{ id: this.habilidadeEdit.id }];

      await BaseRepositoryV2.batch({
        updateById: Object.keys(updates).length ? updates : undefined,
        deleteById: deletes,
      });

      // Atualizar lista local
      this.habilidades = this.habilidades.filter(
        (h) => String(h.id) !== String(this.habilidadeEdit.id)
      );

      this.habilidadeSelecionada = null;
      this.habilidadeEdit = {
        id: '',
        caminho: '',
        arvore: '',
        habilidade: '',
        nivel: 1,
        requisitos: '',
        descricao: '',
        dependencia: null,
      };

      this.atualizarPreview();

      alert('🗑️ Habilidade excluída com sucesso!');
      this.router.navigate(['/skills-jogador']);
    } catch (err) {
      console.error('[EdicaoSkillTree] ❌ Erro ao excluir:', err);
      alert('❌ Erro ao excluir');
    } finally {
      this.excluindo = false;
    }
  }



  atualizarPreview() {
    setTimeout(() => this.renderPreview(), 0);
  }

  get arvoreSelecionadaNome(): string {
    if (this.arvoreSelecionada === 'nova')
      return this.novaArvoreNome || 'Nova Árvore';
    const arvore = this.arvores.find(
      (a) => String(a.id) === String(this.arvoreSelecionada)
    );
    return arvore ? arvore.arvore : 'Sem árvore';
  }
}

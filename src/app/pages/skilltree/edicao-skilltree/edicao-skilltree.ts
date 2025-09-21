import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { RamoDomain } from '../../../domain/skilltreeDomains/RamoDomain';
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
  ramos: RamoDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  carregando = true;
  salvando = false;

  caminhoSelecionado: string | null = null;
  arvoreSelecionada: string | null = null;
  ramoSelecionado: string | null = null;
  dependenciaSelecionada: string | null = null;

  novaArvoreNome: string = '';
  novoRamoNome: string = '';

  habilidadeEdit: HabilidadeDomain = {
    id: '',
    caminho: '',
    arvore: '',
    ramo: '',
    habilidade: '',
    nivel: 1,
    requisitos: '',
    descricao: '',
  };

  habilidadeSelecionada: HabilidadeDomain | null = null;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoRamo = new BaseRepositoryV2<RamoDomain>('Ramos');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  async ngOnInit() {
    this.caminhos = await this.repoCaminho.getLocal();
    this.arvores = await this.repoArvore.getLocal();
    this.ramos = await this.repoRamo.getLocal();
    this.habilidades = await this.repoHab.getLocal();
    this.renderPreview();
  }

  arvoresDoCaminho: ArvoreDomain[] = [];
  ramosDaArvore: RamoDomain[] = [];
  habilidadesDoRamo: HabilidadeDomain[] = [];

  onCaminhoChange(id: string | null) {
    this.caminhoSelecionado = id;
    this.arvoresDoCaminho = id
      ? this.arvores.filter((a) => String(a.caminho) === String(id))
      : [];
    this.arvoreSelecionada = null;
    this.ramoSelecionado = null;
    this.atualizarPreview();
  }

  onArvoreChange(id: string | null) {
    this.arvoreSelecionada = id;
    if (id === 'nova') {
      this.novaArvoreNome = '';
      this.ramosDaArvore = [];
    } else {
      this.ramosDaArvore = id
        ? this.ramos.filter((r) => String(r.arvore) === String(id))
        : [];
    }
    this.ramoSelecionado = null;
    this.atualizarPreview();
  }

  onRamoChange(id: string | null) {
    this.ramoSelecionado = id;
    if (id === 'novo') {
      this.novoRamoNome = '';
      this.habilidadeEdit.habilidade = 'Nova habilidade';
    } else {
      this.habilidadesDoRamo = id
        ? this.habilidades.filter((h) => String(h.ramo) === String(id))
        : [];
    }
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
    let existentes: HabilidadeDomain[] = [];

    if (this.arvoreSelecionada && this.arvoreSelecionada !== 'nova') {
      const ramosDaArvore = this.ramos.filter(
        (r) => String(r.arvore) === String(this.arvoreSelecionada)
      );
      existentes = this.habilidades.filter((h) =>
        ramosDaArvore.some((r) => String(r.id) === String(h.ramo))
      );
    }

    existentes.forEach((h) => {
      elements.push({
        data: { id: String(h.id), label: `${h.habilidade}\nLv ${h.nivel}` },
      });
      if (h.dependencia) {
        elements.push({
          data: { source: String(h.dependencia), target: String(h.id) },
        });
      }
    });

    // Nova habilidade (prévia)
    if (this.habilidadeEdit.habilidade && this.ramoSelecionado) {
      const tempId = this.habilidadeEdit.id || 'novaHab';
      elements.push({
        data: {
          id: tempId,
          label: `${this.habilidadeEdit.habilidade}\nLv ${this.habilidadeEdit.nivel}`,
        },
        classes: 'nova-habilidade',
      });
      if (this.dependenciaSelecionada) {
        elements.push({
          data: { source: String(this.dependenciaSelecionada), target: tempId },
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
  // SALVAR (batch)
  // ======================
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const creates: any = {};
      const updates: any = {};
      const deletes: any = {};

      // Nova árvore
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

      // Novo ramo
      if (this.ramoSelecionado === 'novo' && this.novoRamoNome.trim()) {
        const novoRamo: RamoDomain = {
          id: IdUtils.generateULID(),
          arvore: this.arvoreSelecionada || '',
          ramo: this.novoRamoNome.trim(),
        };
        this.ramos.push(novoRamo);
        this.ramoSelecionado = novoRamo.id;

        if (!creates['Ramos']) creates['Ramos'] = [];
        creates['Ramos'].push(novoRamo);
      }

      // Habilidade
      // Habilidade
      if (!this.habilidadeEdit.id) {
        this.habilidadeEdit.id = IdUtils.generateULID();
        this.habilidadeEdit.caminho = this.caminhoSelecionado || '';
        this.habilidadeEdit.arvore = this.arvoreSelecionada || '';
        this.habilidadeEdit.ramo = this.ramoSelecionado || '';
      }

      // 🔑 Sempre atualizar dependência
      this.habilidadeEdit.dependencia = this.dependenciaSelecionada || null;

      if (!this.habilidadeEdit.id || !updates['Habilidades']) {
        if (!creates['Habilidades']) creates['Habilidades'] = [];
        creates['Habilidades'].push(this.habilidadeEdit);
      } else {
        if (!updates['Habilidades']) updates['Habilidades'] = [];
        updates['Habilidades'].push(this.habilidadeEdit);
      }


      // ✅ Tudo em 1 batch
      const result = await BaseRepositoryV2.batch({
        create: Object.keys(creates).length ? creates : undefined,
        updateById: Object.keys(updates).length ? updates : undefined,
        deleteById: Object.keys(deletes).length ? deletes : undefined,
      });

      console.log('[EdicaoSkillTree] ◀️ batch result', result);
      alert('✅ Habilidade salva com sucesso!');
    } catch (err) {
      console.error('[EdicaoSkillTree] ❌ Erro ao salvar:', err);
      alert('❌ Erro ao salvar');
    } finally {
      this.salvando = false;
    }
  }

  atualizarPreview() {
    setTimeout(() => this.renderPreview(), 0);
  }

  onNovoRamoInput() {
    if (this.ramoSelecionado === 'novo') {
      this.atualizarPreview();
      if (!this.habilidadeEdit.habilidade) {
        this.habilidadeEdit.habilidade = 'Nova habilidade';
      }
    }
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

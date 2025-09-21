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
  editMode = false;

  caminhoSelecionado: string | null = null;
  arvoreSelecionada: string | null = null;
  ramoSelecionado: string | null = null;
  dependenciaSelecionada: string | null = null;

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

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoRamo = new BaseRepositoryV2<RamoDomain>('Ramos');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  async ngOnInit() {
    this.carregando = true;
    try {
      console.log('[EdicaoSkillTree] 🔄 Carregando dados locais...');
      // carrega dados locais primeiro
      this.caminhos = await this.repoCaminho.getLocal();
      this.arvores = await this.repoArvore.getLocal();
      this.ramos = await this.repoRamo.getLocal();
      this.habilidades = await this.repoHab.getLocal();

      console.log('[EdicaoSkillTree] ✅ Locais carregados:', {
        caminhos: this.caminhos,
        arvores: this.arvores,
        ramos: this.ramos,
        habilidades: this.habilidades,
      });

      // depois sincroniza em paralelo
      this.repoCaminho.sync().then(async (updated) => {
        if (updated) {
          this.caminhos = await this.repoCaminho.getLocal();
          console.log('[EdicaoSkillTree] 🔄 Caminhos sincronizados:', this.caminhos);
        }
      });
      this.repoArvore.sync().then(async (updated) => {
        if (updated) {
          this.arvores = await this.repoArvore.getLocal();
          console.log('[EdicaoSkillTree] 🔄 Árvores sincronizadas:', this.arvores);
        }
      });
      this.repoRamo.sync().then(async (updated) => {
        if (updated) {
          this.ramos = await this.repoRamo.getLocal();
          console.log('[EdicaoSkillTree] 🔄 Ramos sincronizados:', this.ramos);
        }
      });
      this.repoHab.sync().then(async (updated) => {
        if (updated) {
          this.habilidades = await this.repoHab.getLocal();
          console.log('[EdicaoSkillTree] 🔄 Habilidades sincronizadas:', this.habilidades);
          this.renderPreview();
        }
      });
    } finally {
      this.carregando = false;
    }
  }

  arvoresDoCaminho: ArvoreDomain[] = [];
  ramosDaArvore: RamoDomain[] = [];
  habilidadesDoRamo: HabilidadeDomain[] = [];

  onCaminhoChange(caminhoId: string | null) {
    this.caminhoSelecionado = caminhoId;
    this.arvoresDoCaminho = caminhoId
      ? this.arvores.filter(a => String(a.caminho) === String(caminhoId))
      : [];
    this.arvoreSelecionada = null;
    this.ramoSelecionado = null;
    console.log('[EdicaoSkillTree] 🔎 arvoresDoCaminho atualizado', this.arvoresDoCaminho);
    this.atualizarPreview();
  }

  onArvoreChange(arvoreId: string | null) {
    this.arvoreSelecionada = arvoreId;
    this.ramosDaArvore = arvoreId
      ? this.ramos.filter(r => String(r.arvore) === String(arvoreId))
      : [];
    this.ramoSelecionado = null;
    console.log('[EdicaoSkillTree] 🔎 ramosDaArvore atualizado', this.ramosDaArvore);
    this.atualizarPreview();
  }

  onRamoChange(ramoId: string | null) {
    this.ramoSelecionado = ramoId;
    this.habilidadesDoRamo = ramoId
      ? this.habilidades.filter(h => String(h.ramo) === String(ramoId))
      : [];
    console.log('[EdicaoSkillTree] 🔎 habilidadesDoRamo atualizado', this.habilidadesDoRamo);
    this.atualizarPreview();
  }


  ngAfterViewInit(): void {
    console.log('[EdicaoSkillTree] 📦 AfterViewInit → renderPreview inicial');
    setTimeout(() => this.renderPreview(), 0);
  }

  // ======================
  // PREVIEW
  // ======================
  private renderPreview() {
    if (!this.cyPreviewRef) return;
    console.log('[EdicaoSkillTree] 🎨 Renderizando preview...');

    const elements: ElementDefinition[] = [];

    // 🔹 Sempre renderizar TODA a árvore selecionada
    let existentes: HabilidadeDomain[] = [];
    if (this.arvoreSelecionada) {
      const ramosDaArvore = this.ramos.filter(
        (r) => String(r.arvore) === String(this.arvoreSelecionada)
      );
      existentes = this.habilidades.filter((h) =>
        ramosDaArvore.some((r) => String(r.id) === String(h.ramo))
      );
      console.log('[EdicaoSkillTree] 🌳 Renderizando árvore completa:', existentes);
    }

    // 🔹 Adiciona todos os nós existentes
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

    // 🔹 Adiciona a nova habilidade (mesmo ramo selecionado)
    if (this.habilidadeEdit.habilidade && this.ramoSelecionado) {
      const tempId = this.habilidadeEdit.id || 'nova';
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
      console.log('[EdicaoSkillTree] ➕ Nova habilidade adicionada:', this.habilidadeEdit);
    }

    if (this.cyInstance) {
      this.cyInstance.destroy();
      console.log('[EdicaoSkillTree] ♻️ CyInstance destruída antes de recriar');
    }

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
          selector: 'node.nova-habilidade',
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
            'line-color': '#666',
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [-30, 30],
            'control-point-weights': [0.5, 0.5],
          },
        },
      ],
      layout: { name: 'dagre', rankDir: 'TB', nodeSep: 100, rankSep: 80 } as any,
      autoungrabify: true,
      userZoomingEnabled: true,   // ✅ agora dá zoom
      userPanningEnabled: true,   // ✅ arrastar liberado
    });

    console.log('[EdicaoSkillTree] ✅ Preview renderizado', elements);
  }


  // ======================
  // SALVAR
  // ======================
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;
      console.log('[EdicaoSkillTree] 💾 Salvando habilidade:', this.habilidadeEdit);

      if (!this.habilidadeEdit.id) {
        this.habilidadeEdit.id = IdUtils.generateULID();
        this.habilidadeEdit.caminho = this.caminhoSelecionado || '';
        this.habilidadeEdit.arvore = this.arvoreSelecionada || '';
        this.habilidadeEdit.ramo = this.ramoSelecionado || '';
        await this.repoHab.create(this.habilidadeEdit);
        console.log('[EdicaoSkillTree] 🆕 Criada:', this.habilidadeEdit);
      } else {
        await this.repoHab.update(this.habilidadeEdit);
        console.log('[EdicaoSkillTree] ✏️ Atualizada:', this.habilidadeEdit);
      }

      alert('✅ Habilidade salva com sucesso!');
    } catch (err) {
      console.error('[EdicaoSkillTree] ❌ Erro ao salvar', err);
      alert('❌ Erro ao salvar habilidade');
    } finally {
      this.salvando = false;
    }
  }

  // ======================
  // EVENTOS
  // ======================
  atualizarPreview() {
    console.log('[EdicaoSkillTree] 🔄 Atualizando preview', {
      caminhoSelecionado: this.caminhoSelecionado,
      arvoreSelecionada: this.arvoreSelecionada,
      ramoSelecionado: this.ramoSelecionado,
      dependenciaSelecionada: this.dependenciaSelecionada,
    });
    setTimeout(() => this.renderPreview(), 0);
  }
}

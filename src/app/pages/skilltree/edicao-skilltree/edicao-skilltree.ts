import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Core } from 'cytoscape';

import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';
import { HabilidadeService } from '../../../services/HabilidadeService';

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

  carregando = true;
  salvando = false;
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
    requisitos: '',
    descricao: '',
    dependencia: null,
  };

  habilidadeSelecionada: HabilidadeDomain | null = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private habilidadeService: HabilidadeService,
    private el: ElementRef,
    private zone: NgZone
  ) { }

  // Autoexpand textareas
  ngAfterViewInit(): void {
    this.renderPreview();
    this.scheduleAutoExpand();
  }

  private scheduleAutoExpand() {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.applyAutoExpand(), 0);
    });
  }

  private applyAutoExpand() {
    const textareas = this.el.nativeElement.querySelectorAll('textarea.auto-expand');
    textareas.forEach((ta: HTMLTextAreaElement) => {
      // aplica altura inicial
      ta.style.height = 'auto';
      const maxHeight = 200;
      ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';

      // remove listeners antigos para não acumular
      ta.removeEventListener('input', this.autoResize);
      // adiciona o listener
      ta.addEventListener('input', this.autoResize);
    });
  }

  // função separada para reuso
  private autoResize = (event: Event) => {
    const ta = event.target as HTMLTextAreaElement;
    ta.style.height = 'auto';
    const maxHeight = 200;
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
  };


  async ngOnInit() {
    await this.habilidadeService.carregarTudo();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const hab = this.habilidadeService.habilidades.find(
        (h) => String(h.id) === String(id)
      );
      if (hab) {
        this.habilidadeEdit = {
          id: String(hab.id),
          caminho: String(hab.caminho),
          arvore: String(hab.arvore),
          habilidade: hab.habilidade,
          requisitos: hab.requisitos || '',
          descricao: hab.descricao || '',
          dependencia: hab.dependencia ? String(hab.dependencia) : null,
        };

        this.caminhoSelecionado = this.habilidadeEdit.caminho;
        this.arvoreSelecionada = this.habilidadeEdit.arvore;
        this.dependenciaSelecionada = this.habilidadeEdit.dependencia;
        this.editMode = true;

        this.onCaminhoChange(this.caminhoSelecionado, false);
        this.onArvoreChange(this.arvoreSelecionada);
        this.atualizarPreview();
      }
    }

    this.renderPreview();
  }


  get arvoresDoCaminho(): ArvoreDomain[] {
    return this.habilidadeService.getArvoresDoCaminho(this.caminhoSelecionado);
  }

  get habilidadesDaArvore(): HabilidadeDomain[] {
    return this.habilidadeService.getHabilidadesDaArvore(this.arvoreSelecionada);
  }

  onCaminhoChange(id: string | null, fromUser = true) {
    this.caminhoSelecionado = id ? String(id) : null;
    if (fromUser) this.arvoreSelecionada = null;
    this.atualizarPreview();
  }

  onArvoreChange(id: string | null) {
    this.arvoreSelecionada = id ? String(id) : null;
    if (id === 'nova') this.novaArvoreNome = '';
    this.atualizarPreview();
  }

  renderPreview() {
    if (!this.cyPreviewRef) return;
    if (this.cyInstance) this.cyInstance.destroy();

    this.cyInstance = this.habilidadeService.renderPreview(
      this.cyPreviewRef.nativeElement,
      this.habilidadesDaArvore,
      this.habilidadeEdit,
      this.dependenciaSelecionada,
      this.editMode,
      (h) => (this.habilidadeSelecionada = h)
    );


  }

  async salvar(form: NgForm) {
    if (form.invalid) return;
    try {
      this.salvando = true;
      await this.habilidadeService.salvarHabilidade(
        this.habilidadeEdit,
        this.caminhoSelecionado,
        this.arvoreSelecionada,
        this.dependenciaSelecionada,
        this.novaArvoreNome,
        this.habilidadeService.arvores,
        this.habilidadeService.habilidades
      );
      alert('✅ Habilidade salva com sucesso!');
      this.router.navigate(['/skilltree']);
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao salvar');
    } finally {
      this.salvando = false;
    }
  }

  async excluir() {
    if (!this.habilidadeEdit.id) return;
    try {
      this.salvando = true;
      const ok = await this.habilidadeService.excluirHabilidadeComDependencias(
        this.habilidadeEdit.id,
        this.habilidadeService.habilidades
      );
      if (ok) {
        alert('🗑️ Habilidade excluída com sucesso!');
        this.router.navigate(['/skilltree']);
      }
    } catch (err) {
      console.error('[EdicaoSkillTree] ❌ Erro ao excluir:', err);
      alert('❌ Erro ao excluir');
    } finally {
      this.salvando = false;
    }
  }

  atualizarPreview() {
    setTimeout(() => {
      this.habilidadeEdit.caminho = this.caminhoSelecionado || '';
      this.habilidadeEdit.arvore = this.arvoreSelecionada || '';

      this.renderPreview();
      this.habilidadeSelecionada = { ...this.habilidadeEdit };

      this.scheduleAutoExpand(); // 👈 garante o ajuste
    }, 0);
  }

  
  get arvoreSelecionadaNome(): string {
    if (this.arvoreSelecionada === 'nova')
      return this.novaArvoreNome || 'Nova Árvore';
    const arvore = this.habilidadeService.arvores.find(
      (a) => String(a.id) === String(this.arvoreSelecionada)
    );
    return arvore ? arvore.arvore : 'Sem árvore';
  }

  // proxies para usar no HTML
  get caminhos() {
    return this.habilidadeService.caminhos;
  }
  get arvores() {
    return this.habilidadeService.arvores;
  }
  get habilidades() {
    return this.habilidadeService.habilidades;
  }
}

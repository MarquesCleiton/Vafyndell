import { Component, OnInit, AfterViewInit, ElementRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AnotacaoDomain } from '../../../domain/AnotacaoDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageUtils } from '../../../core/utils/ImageUtils';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

@Component({
  selector: 'app-criar-anotacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './criar-anotacao.html',
  styleUrls: ['./criar-anotacao.css'],
})
export class CriarAnotacao implements OnInit, AfterViewInit {
  anotacao: AnotacaoDomain = {
    id: '',
    jogador: '',
    autor: '',
    titulo: '',
    descricao: '',
    imagem: '', // sempre URL final ou '-'
    data: '',
    tags: '',
  };

  /** base64 temporário até salvar */
  imagemBase64Temp: string | null = null;

  salvando = false;
  excluindo = false;
  editMode = false;

  private repo = new BaseRepositoryV2<AnotacaoDomain>('Anotacoes');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private el: ElementRef,
    private zone: NgZone
  ) { }

  // CriarAnotacao.ngOnInit
  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;
      try {
        // 1. Busca local apenas
        const existente = await this.repo.getById(id, true);
        if (existente) {
          this.anotacao = { ...existente };
          this.scheduleAutoExpand();
        }

        // 2. Não faz forceFetch imediato!
        // Apenas agenda sync em paralelo
        this.repo.sync().then(async (updated) => {
          if (updated) {
            const atualizado = await this.repo.getById(id, true);
            if (atualizado) {
              this.anotacao = { ...atualizado };
              this.scheduleAutoExpand();
            }
          }
        });
      } catch (err) {
        console.error('[CriarAnotacao] Erro ao carregar anotação:', err);
      }
    }
  }




  ngAfterViewInit() {
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
      const maxHeight = 300;
      const ajustar = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
      };
      ajustar();
      ta.addEventListener('input', ajustar);
    });
  }

  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      try {
        this.imagemBase64Temp = await ImageUtils.toOptimizedBase64(file, 0.7, 1024);
      } catch (err) {
        console.error('[CriarAnotacao] Erro ao otimizar imagem:', err);
      }
    }
  }

  removerImagem() {
    this.anotacao.imagem = '-'; // 🔑 padronizado
    this.imagemBase64Temp = null;
  }

  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');

      this.anotacao.autor = user.email;
      this.anotacao.jogador = user.email;

      // 🔑 Só define data se for nova ou se estava vazia
      if (!this.editMode || !this.anotacao.data) {
        this.anotacao.data = new Date().toISOString();
      }

      if (!this.editMode) {
        // ⚡ gera o id ANTES de montar o payload
        this.anotacao.id = IdUtils.generateULID();
      }

      // Agora sim monta o payload atualizado
      const payload: any = { ...this.anotacao };
      if (this.imagemBase64Temp) {
        payload.imagem = this.imagemBase64Temp; // envia base64 → Script cuida
      }

      if (this.editMode) {
        const updated = await this.repo.update(payload);
        this.anotacao = { ...updated };
        window.alert('✅ Anotação atualizada!');
      } else {
        const created = await this.repo.create(payload);
        this.anotacao = { ...created };
        window.alert('✅ Anotação criada!');
      }

      this.router.navigate(['/anotacoes']);
    } catch (err) {
      console.error('[CriarAnotacao] Erro ao salvar anotação:', err);
      window.alert('❌ Erro ao salvar anotação.');
    } finally {
      this.salvando = false;
      this.imagemBase64Temp = null;
    }
  }


  cancelar() {
    this.router.navigate(['/anotacoes']);
  }

  async excluir() {
    if (!this.anotacao.id) return;
    const confirmar = confirm(`🗑 Deseja realmente excluir a anotação "${this.anotacao.titulo}"?`);
    if (!confirmar) return;

    try {
      this.excluindo = true;
      await this.repo.delete(this.anotacao.id);
      window.alert('✅ Anotação excluída com sucesso!');
      this.router.navigate(['/anotacoes']);
    } catch (err) {
      console.error('[CriarAnotacao] Erro ao excluir anotação:', err);
      window.alert('❌ Erro ao excluir anotação.');
    } finally {
      this.excluindo = false;
    }
  }
}

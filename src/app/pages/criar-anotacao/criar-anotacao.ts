import { Component, OnInit, AfterViewInit, ElementRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { AnotacaoRepository } from '../../repositories/AnotacaoRepository';
import { AnotacaoDomain } from '../../domain/AnotacaoDomain';
import { AuthService } from '../../core/auth/AuthService';

@Component({
  selector: 'app-criar-anotacao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './criar-anotacao.html',
  styleUrls: ['./criar-anotacao.css'],
})
export class CriarAnotacao implements OnInit, AfterViewInit {
  anotacao: AnotacaoDomain = {
    id: 0,
    index: 0,
    jogador: '',
    autor: '',
    titulo: '',
    descricao: '',
    imagem: '',
    data: '',
    tags: '',
  };

  salvando = false;
  excluindo = false;
  editMode = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private el: ElementRef,
    private zone: NgZone
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;
      try {
        // 1. Busca local primeiro
        const locais = await AnotacaoRepository.getLocalAnotacoes();
        const existente = locais.find(a => String(a.id) === id);
        if (existente) {
          this.anotacao = { ...existente };
          this.scheduleAutoExpand();
        }

        // 2. Em paralelo, dispara sync
        AnotacaoRepository.syncAnotacoes().then(async updated => {
          if (updated) {
            const atualizadas = await AnotacaoRepository.getLocalAnotacoes();
            const atualizado = atualizadas.find(a => String(a.id) === id);
            if (atualizado) {
              this.anotacao = { ...atualizado };
              this.scheduleAutoExpand();
            }
          }
        });

        // 3. Se não tinha local, força buscar online
        if (!existente) {
          const online = await AnotacaoRepository.forceFetchAnotacoes();
          const achada = online.find(a => String(a.id) === id);
          if (achada) {
            this.anotacao = { ...achada };
            this.scheduleAutoExpand();
          }
        }
      } catch (err) {
        console.error('[CriarAnotacao] Erro ao carregar anotação:', err);
      }
    }
  }

  ngAfterViewInit() {
    this.scheduleAutoExpand();
  }

  /** 🔑 agenda o auto expand depois da renderização */
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

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.anotacao.imagem = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
  removerImagem() {
    this.anotacao.imagem = '';
  }

  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.anotacao.autor = user.email;
      this.anotacao.jogador = user.email;
      this.anotacao.data = new Date().toISOString();

      if (this.editMode) {
        await AnotacaoRepository.updateAnotacao(this.anotacao);
        window.alert('✅ Anotação atualizada!');
      } else {
        // 🔄 sincroniza para garantir maxIndex atualizado
        await AnotacaoRepository.syncAnotacoes();

        const locais = await AnotacaoRepository.getLocalAnotacoes();
        const maxIndex = locais.length > 0 ? Math.max(...locais.map(a => a.index || 0)) : 0;

        this.anotacao.index = maxIndex + 1;
        this.anotacao.id = maxIndex + 1;

        await AnotacaoRepository.createAnotacao(this.anotacao);
        window.alert('✅ Anotação criada!');
      }

      this.router.navigate(['/anotacoes']);
    } catch (err) {
      console.error('[CriarAnotacao] Erro ao salvar anotação:', err);
      window.alert('❌ Erro ao salvar anotação.');
    } finally {
      this.salvando = false;
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
      await AnotacaoRepository.deleteAnotacao(this.anotacao.id);
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

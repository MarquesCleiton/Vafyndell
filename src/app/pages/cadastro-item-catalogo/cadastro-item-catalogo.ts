import { Component, AfterViewInit, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CatalogoRepository } from '../../repositories/CatalogoRepository';
import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { AuthService } from '../../core/auth/AuthService';

@Component({
  selector: 'app-cadastro-item-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-item-catalogo.html',
  styleUrls: ['./cadastro-item-catalogo.css'],
})
export class CadastroItemCatalogo implements AfterViewInit {
  item: CatalogoDomain = {
    index: 0,
    id: 0,
    nome: '',
    unidade_medida: '',
    peso: 0,
    categoria: '',
    origem: '',
    raridade: '',
    efeito: '',
    colateral: '',
    descricao: '',
    imagem: '',
    email: '',
  };

  salvando = false;

  unidadesMedida = ['g', 'kg', 'ml', 'l', 'cm', 'm', 'unidade'];
  origens = ['Fabricável', 'Natural'];
  raridades = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário'];

  categorias = [
    'Recursos botânicos',
    'Mineral',
    'Equipamento',
    'Moeda',
    'Tesouro',
    'Componentes bestiais e animalescos',
    'Poção de Cura – Regenera vida, cicatriza feridas',
    'Poção Mental – Calmante, foco, memória, sono, esquecimento',
    'Poção de Aprimoramento Físico – Força, resistência, agilidade',
    'Poção Sensorial – Visão, audição, percepção, voz, respiração',
    'Poção de Furtividade – Camuflagem, passos suaves, silêncio',
    'Poção de Energia – Percepção da energia fundamental',
    'Veneno – Sonolência, confusão ou morte',
    'Utilitário – Bombas, armadilhas, luz, som, gás, adesivos',
    'Ferramentas',
    'Outros',
  ];

  constructor(private router: Router, private el: ElementRef) {}

  ngAfterViewInit() {
    // 🔹 Auto-ajuste dos textareas
    const textareas = this.el.nativeElement.querySelectorAll('textarea.auto-expand');
    textareas.forEach((ta: HTMLTextAreaElement) => {
      const resize = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
      };
      ta.addEventListener('input', resize);
      resize(); // ajusta já na inicialização
    });
  }

  // Upload imagem
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.item.imagem = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removerImagem() {
    this.item.imagem = '';
  }

  // Salvar
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.item.email = user.email;

      // 🔄 sincroniza antes de salvar
      await CatalogoRepository.syncItens();

      // pega todos os itens para calcular próximo índice
      const todos = await CatalogoRepository.getAllItens();
      let maxIndex = 0;
      if (todos.length > 0) {
        maxIndex = Math.max(...todos.map(i => i.index || 0));
      }
      this.item.index = maxIndex + 1;
      this.item.id = maxIndex + 1;

      await CatalogoRepository.createItem(this.item);

      window.alert('✅ Item salvo com sucesso!');
      this.router.navigate(['/catalogo']);
    } catch (err) {
      console.error('[CadastroItemCatalogo] Erro ao salvar:', err);
      window.alert('❌ Erro ao salvar item. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }
}

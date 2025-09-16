import { Component, AfterViewInit, ElementRef, OnInit, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { ImageUtils } from '../../../core/utils/ImageUtils';
import { IdUtils } from '../../../core/utils/IdUtils';
import { AuthService } from '../../../core/auth/AuthService';

@Component({
  selector: 'app-cadastro-item-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-item-catalogo.html',
  styleUrls: ['./cadastro-item-catalogo.css'],
})
export class CadastroItemCatalogo implements OnInit, AfterViewInit {
  item: CatalogoDomain = {
    id: '',
    index: 0,
    nome: '',
    unidade_medida: '',
    peso: 0,
    categoria: '',
    origem: '',
    raridade: '',
    efeito: '',
    colateral: '',
    descricao: '',
    imagem: '-', // 🔑 padronizado
    email: '',
  };

  imagemBase64Temp: string | null = null; // 🔑 preview temporária
  salvando = false;
  editMode = false;

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

  private repo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');

  constructor(
    private router: Router,
    private el: ElementRef,
    private route: ActivatedRoute,
    private zone: NgZone,
    private location: Location // ✅ agora disponível para cancelar()
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;
      try {
        // 1️⃣ Carrega local primeiro
        const itensLocais = await this.repo.getLocal();
        const existente = itensLocais.find(i => String(i.id) === id);
        if (existente) {
          this.item = { ...existente };
        }

        // 2️⃣ Em paralelo, sincroniza
        this.repo.sync().then(async updated => {
          if (updated) {
            const itensAtualizados = await this.repo.getLocal();
            const atualizado = itensAtualizados.find(i => String(i.id) === id);
            if (atualizado) this.item = { ...atualizado };
          }
        });

        // 3️⃣ Se não havia local, força buscar online
        if (!existente) {
          const online = await this.repo.forceFetch();
          const achadoOnline = online.find(i => String(i.id) === id);
          if (achadoOnline) this.item = { ...achadoOnline };
        }
      } catch (err) {
        console.error('[CadastroItemCatalogo] Erro ao carregar item:', err);
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
      const maxHeight = 200;
      const resize = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
      };
      resize();
      ta.addEventListener('input', resize);
    });
  }

  // Upload imagem com otimização
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      try {
        this.imagemBase64Temp = await ImageUtils.toOptimizedBase64(file, 0.72, 800);
      } catch (err) {
        console.error('[CadastroItemCatalogo] Erro ao otimizar imagem:', err);
      }
    }
  }

  removerImagem() {
    this.item.imagem = '-'; // 🔑 padronizado
    this.imagemBase64Temp = null;
  }

  // Salvar
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.item.email = user.email;

      if (this.editMode) {
        const payload: any = { ...this.item };
        if (this.imagemBase64Temp) {
          payload.imagem = this.imagemBase64Temp;
        }

        const updated = await this.repo.update(payload);
        this.item = { ...updated };
        window.alert('✅ Item atualizado com sucesso!');
      } else {
        const locais = await this.repo.getLocal();
        const maxIndex = locais.length > 0 ? Math.max(...locais.map(i => i.index || 0)) : 0;

        this.item.id = IdUtils.generateULID();   // gera id antes
        this.item.index = maxIndex + 1;

        const payload: any = { ...this.item };
        if (this.imagemBase64Temp) {
          payload.imagem = this.imagemBase64Temp;
        }

        const created = await this.repo.create(payload);
        this.item = { ...created };
        window.alert('✅ Item criado com sucesso!');
      }

      this.cancelar();
    } catch (err) {
      console.error('[CadastroItemCatalogo] Erro ao salvar:', err);
      window.alert('❌ Erro ao salvar item. Veja o console.');
    } finally {
      this.salvando = false;
      this.imagemBase64Temp = null;
    }
  }


  // 🔙 Cancelar → volta para tela anterior
  cancelar() {
    this.location.back();
  }
}

import { Component, OnInit, AfterViewInit, ElementRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { NpcDomain } from '../../../domain/NpcDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageUtils } from '../../../core/utils/ImageUtils';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';

type AtributoChave = keyof Pick<
  NpcDomain,
  | 'nivel' | 'xp'
  | 'forca' | 'destreza' | 'constituicao'
  | 'inteligencia' | 'sabedoria' | 'carisma'
  | 'energia' | 'classe_armadura'
  | 'escudo' | 'pontos_de_sorte'
  | 'pontos_de_vida' | 'fator_de_cura'
  | 'deslocamento'
>;


@Component({
  selector: 'app-cadastro-npc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-npc.html',
  styleUrls: ['./cadastro-npc.css'],
})
export class CadastroNpc implements OnInit, AfterViewInit {
  npc: NpcDomain = {
    id: '',
    imagem: '',
    nome: '',
    classificacao: 'Inimigo',
    tipo: 'Comum',
    descricao: '',
    alinhamento: '',
    ataques: '',
    visivel_jogadores: false,
    email: '',
    // Combate
    pontos_de_vida: 0,
    classe_armadura: 0,
    escudo: 0,
    xp: 0,
    // Primários
    forca: 0,
    destreza: 0,
    constituicao: 0,
    inteligencia: 0,
    sabedoria: 0,
    carisma: 0,
    energia: 0,
    // Secundários
    nivel: 1,
    pontos_de_sorte: 0,
    fator_de_cura: 0,
    deslocamento: 0,
  };

  imagemBase64Temp: string | null = null;
  salvando = false;
  editMode = false;

  atributosNumericos = [
    { key: 'nivel'          as AtributoChave, label: 'Nível',        icon: '🏅' },
    { key: 'xp'            as AtributoChave, label: 'XP',           icon: '⭐' },
    { key: 'forca'         as AtributoChave, label: 'Força',        icon: '💪' },
    { key: 'destreza'      as AtributoChave, label: 'Destreza',     icon: '🤸‍♂️' },
    { key: 'constituicao'  as AtributoChave, label: 'Constituição', icon: '🪨' },
    { key: 'inteligencia'  as AtributoChave, label: 'Inteligência', icon: '🧠' },
    { key: 'sabedoria'     as AtributoChave, label: 'Sabedoria',    icon: '📖' },
    { key: 'carisma'       as AtributoChave, label: 'Carisma',      icon: '😎' },
    { key: 'energia'       as AtributoChave, label: 'Energia',      icon: '⚡' },
    { key: 'classe_armadura' as AtributoChave, label: 'Armadura',   icon: '🛡️' },
    { key: 'escudo'        as AtributoChave, label: 'Escudo',       icon: '🔰' },
    { key: 'pontos_de_sorte' as AtributoChave, label: 'Sorte',      icon: '🍀' },
    { key: 'pontos_de_vida'  as AtributoChave, label: 'Pontos de Vida', icon: '❤️' },
    { key: 'fator_de_cura'   as AtributoChave, label: 'Fator de Cura', icon: '✨' },
    { key: 'deslocamento'    as AtributoChave, label: 'Deslocamento',  icon: '🚶' },
  ];


  classificacoes = ['Inimigo', 'Bestial'];
  tipos = ['Comum', 'Elite', 'Mágico', 'Lendário'];

  private repo = new BaseRepositoryV2<NpcDomain>('NPCs');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private el: ElementRef,
    private zone: NgZone
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;
      try {
        // 1️⃣ Local
        const locais = await this.repo.getLocal();
        const existente = locais.find(n => String(n.id) === id);
        if (existente) {
          this.npc = { ...existente };
          this.scheduleAutoExpand();
        }

        // 2️⃣ Sync paralelo
        this.repo.sync().then(async updated => {
          if (updated) {
            const atualizados = await this.repo.getLocal();
            const atualizado = atualizados.find(n => String(n.id) === id);
            if (atualizado) {
              this.npc = { ...atualizado };
              this.scheduleAutoExpand();
            }
          }
        });

        // 3️⃣ Fallback online
        if (!existente) {
          const online = await this.repo.forceFetch();
          const achadoOnline = online.find(n => String(n.id) === id);
          if (achadoOnline) {
            this.npc = { ...achadoOnline };
            this.scheduleAutoExpand();
          }
        }
      } catch (err) {
        console.error('[CadastroNpc] Erro ao carregar NPC:', err);
      }
    }
  }

  ngAfterViewInit() {
    this.scheduleAutoExpand();
  }

  // Autoexpand textareas
  private scheduleAutoExpand() {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.applyAutoExpand(), 0);
    });
  }
  private applyAutoExpand() {
    const textareas = this.el.nativeElement.querySelectorAll('textarea.auto-expand');
    textareas.forEach((ta: HTMLTextAreaElement) => {
      ta.style.height = 'auto';
      const maxHeight = 200;
      ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';

      ta.oninput = () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
      };
    });
  }

  // Helpers atributos
  getValor(campo: AtributoChave): number {
    return this.npc[campo] as number;
  }
  setValor(campo: AtributoChave, valor: number) {
    this.npc[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      try {
        this.imagemBase64Temp = await ImageUtils.toOptimizedBase64(file, 0.7, 1024);
      } catch (err) {
        console.error('[CadastroNpc] Erro ao otimizar imagem:', err);
      }
    }
  }
  removerImagem() {
    this.npc.imagem = '-';
    this.imagemBase64Temp = null;
  }

  // Salvar
  async salvar(form: NgForm) {
    if (form.invalid) return;
    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.npc.email = user.email;

      const payload: NpcDomain = { ...this.npc };
      if (this.imagemBase64Temp) {
        payload.imagem = this.imagemBase64Temp;
      }

      if (this.editMode) {
        const updated = await this.repo.update(payload);
        this.npc = { ...updated };
        alert('✅ NPC atualizado com sucesso!');
      } else {
        payload.id = IdUtils.generateULID();
        const created = await this.repo.create(payload);
        this.npc = { ...created };
        alert('✅ NPC criado com sucesso!');
      }

      this.router.navigate(['/npcs']);
    } catch (err) {
      console.error('[CadastroNpc] Erro ao salvar NPC:', err);
      alert('❌ Erro ao salvar NPC. Veja o console.');
    } finally {
      this.salvando = false;
      this.imagemBase64Temp = null;
    }
  }

  cancelar() {
    if (this.editMode && this.npc?.id) {
      this.router.navigate(['/npc-detalhes', this.npc.id]);
    } else {
      this.router.navigate(['/npcs']);
    }
  }
}

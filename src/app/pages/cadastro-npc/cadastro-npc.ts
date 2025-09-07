import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { NpcRepository } from '../../repositories/NpcRepository';
import { NpcDomain } from '../../domain/NpcDomain';
import { AuthService } from '../../core/auth/AuthService';

type AtributoChave = keyof Pick<
  NpcDomain,
  'forca' | 'constituicao' | 'destreza' |
  'sabedoria' | 'inteligencia' | 'energia' |
  'classe_armadura' | 'pontos_de_vida' | 'xp'
>;

@Component({
  selector: 'app-cadastro-npc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-npc.html',
  styleUrls: ['./cadastro-npc.css'],
})
export class CadastroNpc {
  npc: NpcDomain = {
    id: 0,
    index: 0,
    imagem: '',
    nome: '',
    classificacao: 'Inimigo',
    tipo: 'Comum',
    descricao: '',
    alinhamento: '',
    pontos_de_vida: 0,
    classe_armadura: 0,
    forca: 0,
    constituicao: 0,
    destreza: 0,
    sabedoria: 0,
    inteligencia: 0,
    energia: 0,
    ataques: '',
    xp: 0,
    email: '',
  };

  atributosNumericos = [
    { key: 'xp' as AtributoChave, label: 'XP', icon: '⭐' },
    { key: 'pontos_de_vida' as AtributoChave, label: 'Vida', icon: '❤️' },
    { key: 'classe_armadura' as AtributoChave, label: 'Armadura', icon: '🛡️' },
    { key: 'forca' as AtributoChave, label: 'Força', icon: '💪' },
    { key: 'constituicao' as AtributoChave, label: 'Constituição', icon: '🪨' },
    { key: 'destreza' as AtributoChave, label: 'Destreza', icon: '🤸‍♂️' },
    { key: 'sabedoria' as AtributoChave, label: 'Sabedoria', icon: '📖' },
    { key: 'inteligencia' as AtributoChave, label: 'Inteligência', icon: '🧠' },
    { key: 'energia' as AtributoChave, label: 'Energia', icon: '⚡' },
  ];

  classificacoes = ['Inimigo', 'Bestial'];
  tipos = ['Comum', 'Elite', 'Mágico', 'Lendário'];

  salvando = false;
  editMode = false; // 👈 agora existe

  constructor(private router: Router, private route: ActivatedRoute) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode = true;
      try {
        // 1. Tenta carregar local
        const locais = await NpcRepository.getLocalNpcs();
        const existente = locais.find(n => String(n.id) === id);
        if (existente) this.npc = { ...existente };

        // 2. Faz sync em paralelo
        NpcRepository.syncNpcs().then(async updated => {
          if (updated) {
            const atualizados = await NpcRepository.getLocalNpcs();
            const atualizado = atualizados.find(n => String(n.id) === id);
            if (atualizado) this.npc = { ...atualizado };
          }
        });

        // 3. Se não havia local, força buscar online
        if (!existente) {
          const online = await NpcRepository.forceFetchNpcs();
          const achadoOnline = online.find(n => String(n.id) === id);
          if (achadoOnline) this.npc = { ...achadoOnline };
        }
      } catch (err) {
        console.error('[CadastroNpc] Erro ao carregar NPC:', err);
      }
    }
  }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return this.npc[campo] as number;
  }
  setValor(campo: AtributoChave, valor: number) {
    this.npc[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload imagem
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.npc.imagem = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
  removerImagem() {
    this.npc.imagem = '';
  }

  // Salvar
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.npc.email = user.email;

      // 🔄 sincroniza antes de salvar
      await NpcRepository.syncNpcs();

      if (this.editMode) {
        await NpcRepository.updateNpc(this.npc);
        window.alert('✅ NPC atualizado com sucesso!');
      } else {
        const todos = await NpcRepository.getLocalNpcs();
        let maxIndex = 0;
        if (todos.length > 0) {
          maxIndex = Math.max(...todos.map(n => n.index || 0));
        }
        this.npc.index = maxIndex + 1;
        this.npc.id = maxIndex + 1;

        await NpcRepository.createNpc(this.npc);
        window.alert('✅ NPC criado com sucesso!');
      }

      this.router.navigate(['/npcs']);
    } catch (err) {
      console.error('[CadastroNpc] Erro ao salvar NPC:', err);
      window.alert('❌ Erro ao salvar NPC. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  cancelar() {
    this.router.navigate(['/npcs']);
  }
}

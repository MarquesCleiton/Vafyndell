import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';
import { ImageUtils } from '../../../core/utils/ImageUtils';

type AtributoChave = keyof Pick<
  JogadorDomain,
  | 'forca' | 'destreza' | 'constituicao' | 'inteligencia'
  | 'sabedoria' | 'carisma' | 'energia'
  | 'classe_de_armadura' | 'nivel' | 'xp'
>;

@Component({
  selector: 'app-edicao-jogador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edicao-jogador.html',
  styleUrls: ['./edicao-jogador.css'],
})
export class EdicaoJogador implements OnInit {
  jogador: JogadorDomain | null = null;
  salvando = false;

  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  atributosNumericos = [
    { key: 'nivel' as AtributoChave, label: 'Nível', icon: '🏅' },
    { key: 'xp' as AtributoChave, label: 'XP', icon: '⭐' },
    { key: 'forca' as AtributoChave, label: 'Força', icon: '💪' },
    { key: 'destreza' as AtributoChave, label: 'Destreza', icon: '🏃' },
    { key: 'constituicao' as AtributoChave, label: 'Constituição', icon: '🪨' },
    { key: 'inteligencia' as AtributoChave, label: 'Inteligência', icon: '🧠' },
    { key: 'sabedoria' as AtributoChave, label: 'Sabedoria', icon: '📖' },
    { key: 'carisma' as AtributoChave, label: 'Carisma', icon: '😎' },
    { key: 'energia' as AtributoChave, label: 'Energia', icon: '⚡' },
    { key: 'classe_de_armadura' as AtributoChave, label: 'Armadura', icon: '🛡️' },
  ];

  // 🔢 Atributos calculados
  get vida() { return this.jogador ? (this.jogador.energia || 0) + (this.jogador.constituicao || 0) : 0; }
  get vidaTotal() { return this.jogador ? this.vida + (this.jogador.classe_de_armadura || 0) : 0; }
  get fatorCura() { return this.jogador ? Math.floor((this.jogador.energia || 0) / 3) : 0; }
  get deslocamento() { return this.jogador ? Math.floor((this.jogador.destreza || 0) / 3) : 0; }

  constructor(
    private router: Router,
    private location: Location
  ) { }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return this.jogador ? (this.jogador[campo] as number) || 0 : 0;
  }
  setValor(campo: AtributoChave, valor: number) {
    if (this.jogador) this.jogador[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload imagem otimizada
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length && this.jogador) {
      try {
        const file = input.files[0];
        this.jogador.imagem = await ImageUtils.toOptimizedBase64(file, 0.72, 1024);
      } catch (err) {
        console.error('[EdicaoJogador] Erro ao otimizar imagem:', err);
      }
    }
  }
  removerImagem() {
    if (this.jogador) this.jogador.imagem = '';
  }

  // Salvar edição
  async salvar(form: NgForm) {
    if (form.invalid || !this.jogador) return;

    try {
      this.salvando = true;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.jogador.email = user.email;

      const atualizado = await this.repo.update(this.jogador);
      this.jogador = { ...atualizado };

      alert('✅ Jogador atualizado com sucesso!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[EdicaoJogador] Erro ao salvar:', err);
      alert('❌ Erro ao salvar jogador. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  async ngOnInit() {
    try {
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');

      // 1️⃣ Local first
      const local = (await this.repo.getLocal()).find(j => j.email === user.email);
      if (local) this.jogador = local;

      // 2️⃣ Sync paralelo
      this.repo.sync().then(async updated => {
        if (updated) {
          const atualizado = (await this.repo.getLocal()).find(j => j.email === user.email);
          if (atualizado) this.jogador = atualizado;
        }
      });

      // 3️⃣ Fallback online
      if (!local) {
        const online = await this.repo.forceFetch();
        const encontrado = online.find(j => j.email === user.email);
        if (encontrado) {
          this.jogador = encontrado;
        } else {
          alert('Nenhum jogador encontrado. Vá para o cadastro primeiro.');
          this.router.navigate(['/cadastro-jogador']);
        }
      }
    } catch (err) {
      console.error('[EdicaoJogador] Erro ao carregar jogador:', err);
      this.router.navigate(['/login']);
    }
  }

  cancelar() {
    this.location.back();
  }
}

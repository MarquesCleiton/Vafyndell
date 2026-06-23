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
  | 'pontos_de_sorte' | 'escudo'
  | 'pontos_de_vida'
  | 'fator_de_cura' | 'deslocamento'
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
  // BUG-11 fix: flag para proteger o formulário de ser sobrescrito pelo sync em background
  isDirty = false;

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
    { key: 'escudo' as AtributoChave, label: 'Escudo', icon: '🔰' },         // 🆕
    { key: 'pontos_de_sorte' as AtributoChave, label: 'Sorte', icon: '🍀' },
    { key: 'pontos_de_vida' as AtributoChave, label: 'Pontos de Vida', icon: '❤️' },
    { key: 'fator_de_cura' as AtributoChave, label: 'Fator de Cura', icon: '✨' },
    { key: 'deslocamento' as AtributoChave, label: 'Deslocamento', icon: '🏃' },
  ];


  // 🔢 Atributos calculados
  get vida() { return this.jogador ? (this.jogador.energia || 0) + (this.jogador.constituicao || 0) : 0; }
  // BUG-19 fix: vidaTotal não inclui armadura — armadura é uma camada separada de proteção, não vida
  get vidaTotal() { return this.vida; }

  constructor(
    private router: Router,
    private location: Location
  ) { }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return this.jogador ? (this.jogador[campo] as number) || 0 : 0;
  }
  setValor(campo: AtributoChave, valor: number) {
    if (this.jogador) {
      this.jogador[campo] = Math.max(0, valor) as any;
      this.isDirty = true; // BUG-11 fix: marca form como modificado
    }
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

      // 2️⃣ Sync paralelo — BUG-11 fix: não sobrescreve se usuário já editou
      this.repo.sync().then(async updated => {
        if (updated && !this.isDirty) {
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

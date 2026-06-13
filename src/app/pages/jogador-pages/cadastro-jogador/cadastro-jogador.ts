import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { ImageUtils } from '../../../core/utils/ImageUtils';

type AtributoChave = keyof Pick<
  JogadorDomain,
  | 'forca'
  | 'destreza'
  | 'constituicao'
  | 'inteligencia'
  | 'sabedoria'
  | 'carisma'
  | 'energia'
  | 'classe_de_armadura'
  | 'nivel'
  | 'xp'
  | 'pontos_de_vida'
  | 'fator_de_cura'
  | 'deslocamento'
>;

@Component({
  selector: 'app-cadastro-jogador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-jogador.html',
  styleUrls: ['./cadastro-jogador.css'],
})
export class CadastroJogador {
  jogador: JogadorDomain = {
    id: '',
    email: '',
    imagem: '',
    nome_do_jogador: '',
    personagem: '',
    pontos_de_vida: 0,
    fator_de_cura: 0,
    deslocamento: 0,
    alinhamento: '',
    classe_de_armadura: 0,
    forca: 0,
    destreza: 0,
    constituicao: 0,
    inteligencia: 0,
    sabedoria: 0,
    carisma: 0,
    energia: 0,
    nivel: 1,
    xp: 0,
    dano_tomado: 0,
    tipo_jogador: '',
    efeitos_temporarios: '',
    registo_de_jogo: '',
    classificacao: '',
    tipo: '',
    descricao: '',
    ataques: '',
  };

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
    { key: 'pontos_de_vida' as AtributoChave, label: 'Pontos de Vida', icon: '❤️' },
    { key: 'fator_de_cura' as AtributoChave, label: 'Fator de Cura', icon: '✨' },
    { key: 'deslocamento' as AtributoChave, label: 'Deslocamento', icon: '🏃' },
  ];

  salvando = false;

  private repo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  // 🔢 Atributos calculados
  get vida() {
    return (this.jogador.energia || 0) + (this.jogador.constituicao || 0);
  }
  get vidaTotal() {
    return this.vida + (this.jogador.classe_de_armadura || 0);
  }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return (this.jogador[campo] as number) || 0;
  }
  setValor(campo: AtributoChave, valor: number) {
    this.jogador[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload imagem otimizada
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      try {
        const file = input.files[0];
        this.jogador.imagem = await ImageUtils.toOptimizedBase64(file, 0.72, 1024);
      } catch (err) {
        console.error('[CadastroJogador] Erro ao otimizar imagem:', err);
      }
    }
  }

  removerImagem() {
    this.jogador.imagem = '';
  }

  // Salvar
  async salvar(form: NgForm) {
    if (form.invalid) return;

    try {
      this.salvando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.jogador.email = user.email;

      this.jogador.id = IdUtils.generateULID();

      await this.repo.create(this.jogador);

      alert('✅ Jogador salvo com sucesso!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[CadastroJogador] Erro ao salvar:', err);
      alert('❌ Erro ao salvar jogador. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  constructor(private router: Router) { }
}

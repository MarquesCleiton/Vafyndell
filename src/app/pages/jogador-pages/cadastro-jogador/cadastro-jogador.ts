import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { JogadorDomain } from '../../../domain/jogadorDomain';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';
import { BaseRepository } from '../../../repositories/BaseRepository';
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
    index: 0,
    id: '', // ULID
    email: '',
    imagem: '',
    nome_do_jogador: '',
    personagem: '',
    pontos_de_vida: 0,
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

    // extras
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
    { key: 'constituicao' as AtributoChave, label: 'Constituição', icon: '🛡️' },
    { key: 'inteligencia' as AtributoChave, label: 'Inteligência', icon: '🧠' },
    { key: 'sabedoria' as AtributoChave, label: 'Sabedoria', icon: '📖' },
    { key: 'carisma' as AtributoChave, label: 'Carisma', icon: '😎' },
    { key: 'energia' as AtributoChave, label: 'Energia', icon: '⚡' },
    { key: 'classe_de_armadura' as AtributoChave, label: 'Armadura', icon: '🛡️' },
  ];

  salvando = false;

  // 🔗 repositório genérico
  private repo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');

  // 🔢 Atributos calculados
  get vida() {
    return this.jogador.energia + this.jogador.constituicao;
  }
  get vidaTotal() {
    return this.vida + this.jogador.classe_de_armadura;
  }
  get fatorCura() {
    return Math.floor(this.jogador.energia / 3);
  }
  get deslocamento() {
    return Math.floor(this.jogador.destreza / 3);
  }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return this.jogador[campo] as number;
  }
  setValor(campo: AtributoChave, valor: number) {
    this.jogador[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload imagem
  // Upload imagem otimizada
  async onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      try {
        // 📌 Mantendo padrão (qualidade 0.72, largura máx. 1024px)
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

      // 🔄 sincroniza antes
      await this.repo.sync();

      // gera ULID
      this.jogador.id = IdUtils.generateULID();

      // calcula próximo index incremental
      const locais = await this.repo.getLocal();
      const maxIndex =
        locais.length > 0 ? Math.max(...locais.map(j => j.index || 0)) : 0;
      this.jogador.index = maxIndex + 1;

      await this.repo.create(this.jogador);

      window.alert('✅ Jogador salvo com sucesso!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[CadastroJogador] Erro ao salvar:', err);
      window.alert('❌ Erro ao salvar jogador. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  constructor(private router: Router) { }
}

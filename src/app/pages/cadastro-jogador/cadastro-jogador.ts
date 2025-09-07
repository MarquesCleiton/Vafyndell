import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { AuthService } from '../../core/auth/AuthService';

type AtributoChave = keyof Pick<
  JogadorDomain,
  'forca' | 'destreza' | 'constituicao' | 'inteligencia' |
  'sabedoria' | 'carisma' | 'energia' | 'classe_de_armadura'
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
    id: 0,
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
  };

  atributosNumericos = [
    { key: 'forca' as AtributoChave, label: 'Força', icon: '💪' },
    { key: 'destreza' as AtributoChave, label: 'Destreza', icon: '🏃' },
    { key: 'constituicao' as AtributoChave, label: 'Constituição', icon: '🛡️' },
    { key: 'inteligencia' as AtributoChave, label: 'Inteligência', icon: '🧠' },
    { key: 'sabedoria' as AtributoChave, label: 'Sabedoria', icon: '📖' },
    { key: 'carisma' as AtributoChave, label: 'Carisma', icon: '😎' },
    { key: 'energia' as AtributoChave, label: 'Energia', icon: '⚡' },
    { key: 'classe_de_armadura' as AtributoChave, label: 'Classe de Armadura', icon: '🛡️' },
  ];

  salvando = false; // estado de loading no botão salvar

  // 🔢 Atributos calculados
  get vida() { return this.jogador.energia + this.jogador.constituicao; }
  get vidaTotal() { return this.vida + this.jogador.classe_de_armadura; }
  get fatorCura() { return Math.floor(this.jogador.energia / 3); }
  get deslocamento() { return Math.floor(this.jogador.destreza / 3); }

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
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.jogador.imagem = reader.result as string;
      };
      reader.readAsDataURL(file);
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

      // garante usuário logado
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      this.jogador.email = user.email;

      // 🔄 sincroniza antes de salvar
      await JogadorRepository.syncJogadores();

      // pega todos os jogadores para calcular próximo índice
      const todos = await JogadorRepository.getAllJogadores();
      let maxIndex = 0;
      if (todos.length > 0) {
        maxIndex = Math.max(...todos.map(j => j.index || 0));
      }
      this.jogador.index = maxIndex + 1;
      this.jogador.id = maxIndex + 1;

      await JogadorRepository.createJogador(this.jogador);

      window.alert('✅ Jogador salvo com sucesso!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[CadastroJogador] Erro ao salvar:', err);
      window.alert('❌ Erro ao salvar jogador. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  constructor(private router: Router) {}
}

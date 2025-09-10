import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { AuthService } from '../../core/auth/AuthService';

type AtributoChave = keyof Pick<
  JogadorDomain,
  'forca' | 'destreza' | 'constituicao' | 'inteligencia' |
  'sabedoria' | 'carisma' | 'energia' | 'classe_de_armadura' |
  'nivel' | 'xp'
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
  get vida() { return this.jogador ? this.jogador.energia + this.jogador.constituicao : 0; }
  get vidaTotal() { return this.jogador ? this.vida + this.jogador.classe_de_armadura : 0; }
  get fatorCura() { return this.jogador ? Math.floor(this.jogador.energia / 3) : 0; }
  get deslocamento() { return this.jogador ? Math.floor(this.jogador.destreza / 3) : 0; }

  // Ajustar valores
  getValor(campo: AtributoChave): number {
    return this.jogador ? (this.jogador[campo] as number) : 0;
  }
  setValor(campo: AtributoChave, valor: number) {
    if (this.jogador) this.jogador[campo] = Math.max(0, valor) as any;
  }
  ajustarValor(campo: AtributoChave, delta: number) {
    this.setValor(campo, this.getValor(campo) + delta);
  }

  // Upload imagem
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.jogador) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (this.jogador) this.jogador.imagem = reader.result as string;
      };
      reader.readAsDataURL(file);
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

      await JogadorRepository.updateJogador(this.jogador);

      window.alert('✅ Jogador atualizado com sucesso!');
      this.router.navigate(['/jogador']);
    } catch (err) {
      console.error('[EdicaoJogador] Erro ao salvar:', err);
      window.alert('❌ Erro ao salvar jogador. Veja o console.');
    } finally {
      this.salvando = false;
    }
  }

  async ngOnInit() {
    try {
      const encontrado = await JogadorRepository.getCurrentJogador();
      if (!encontrado) {
        window.alert('Nenhum jogador encontrado. Vá para o cadastro primeiro.');
        this.router.navigate(['/cadastro-jogador']);
        return;
      }

      this.jogador = encontrado;

      // dispara sync em paralelo
      JogadorRepository.syncJogadores().then(async updated => {
        if (updated) {
          const atualizado = await JogadorRepository.getCurrentJogador();
          if (atualizado) this.jogador = atualizado;
        }
      });
    } catch (err) {
      console.error('[EdicaoJogador] Erro ao carregar jogador:', err);
      this.router.navigate(['/login']);
    }
  }

  cancelar() {
    this.router.navigate(['/jogador']);
  }

  constructor(private router: Router) {}
}

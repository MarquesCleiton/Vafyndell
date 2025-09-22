import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnotacaoDomain } from '../../../domain/AnotacaoDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { IdUtils } from '../../../core/utils/IdUtils';
import { ImageUtils } from '../../../core/utils/ImageUtils';

interface SecaoAnotacao {
  data: string;
  itens: AnotacaoDomain[];
  expandido: boolean;
}

@Component({
  selector: 'app-anotacoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anotacoes.html',
  styleUrls: ['./anotacoes.css'],
})
export class Anotacoes implements OnInit {
  secoes: SecaoAnotacao[] = [];
  secoesFiltradas: SecaoAnotacao[] = [];
  carregando = true;
  filtro = '';

  jogadores: JogadorDomain[] = [];
  modalAberto = false;
  anotacaoSelecionada: AnotacaoDomain | null = null;
  jogadorDestino: string = '';
  processando = false;

  private repo = new BaseRepositoryV2<AnotacaoDomain>('Anotacoes');
  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private uploadRepo = new BaseRepositoryV2<any>('Upload'); // 🔑 repositorio usado p/ upload imagens

  constructor(private router: Router) {}

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();

      // jogadores
      const user = AuthService.getUser();
      const todos = await this.jogadoresRepo.getLocal();
      this.jogadores = todos.filter((j) => j.email !== user?.email);
    } catch (err) {
      console.error('[Anotacoes] Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** 🔄 Carrega cache local e sincroniza em paralelo */
  private async loadLocalAndSync() {
    const user = AuthService.getUser();
    if (!user?.email) return;

    // 1. Local
    const locais = await this.repo.getLocal();
    const minhasLocais = locais.filter((a) => a.jogador === user.email);
    this.processarSecoes(minhasLocais);

    // 2. Sync paralelo
    this.repo.sync().then(async (updated) => {
      if (updated) {
        const atualizadas = await this.repo.getLocal();
        const minhasAtualizadas = atualizadas.filter(
          (a) => a.jogador === user.email
        );
        this.processarSecoes(minhasAtualizadas);
      }
    });

    // 3. Se não havia nada local → força fetch
    if (minhasLocais.length === 0) {
      const online = await this.repo.forceFetch();
      const minhasOnline = online.filter((a) => a.jogador === user.email);
      this.processarSecoes(minhasOnline);
    }
  }

  /** Agrupa por data e mantém expandido */
  private processarSecoes(lista: AnotacaoDomain[]) {
    const estados = new Map(this.secoes.map((s) => [s.data, s.expandido]));
    const mapa = new Map<string, AnotacaoDomain[]>();

    lista.forEach((a) => {
      const rawData = a.data || '';
      const soData = rawData.includes('T') ? rawData.split('T')[0] : rawData;
      if (!mapa.has(soData)) mapa.set(soData, []);
      mapa.get(soData)!.push(a);
    });

    this.secoes = Array.from(mapa.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([data, itens]) => ({
        data,
        itens: itens.sort(
          (a, b) =>
            new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
        ),
        expandido: estados.get(data) ?? false,
      }));

    this.secoesFiltradas = [...this.secoes];
  }

  aplicarFiltro() {
    const termo = this.normalizarTexto(this.filtro);
    if (!termo) {
      this.secoesFiltradas = [...this.secoes];
      return;
    }

    this.secoesFiltradas = this.secoes
      .map((s) => ({
        ...s,
        itens: s.itens.filter(
          (a) =>
            this.normalizarTexto(a.titulo || '').includes(termo) ||
            this.normalizarTexto(a.descricao || '').includes(termo) ||
            this.normalizarTexto(a.tags || '').includes(termo) ||
            this.normalizarTexto(a.autor || '').includes(termo)
        ),
        expandido: true,
      }))
      .filter((s) => s.itens.length > 0);
  }

  toggleSecao(secao: SecaoAnotacao) {
    secao.expandido = !secao.expandido;
  }

  formatarData(data: string): string {
    try {
      const d = data.includes('T')
        ? new Date(data)
        : new Date(data + 'T00:00:00');
      return d.toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  }

  novaAnotacao() {
    this.router.navigate(['/criar-anotacao']);
  }

  abrirAnotacao(anotacao: AnotacaoDomain) {
    this.router.navigate(['/criar-anotacao', anotacao.id]);
  }

  abrirModalTransferir(anotacao: AnotacaoDomain) {
    this.anotacaoSelecionada = anotacao;
    this.modalAberto = true;
    this.jogadorDestino = '';
  }

  fecharModal() {
    this.modalAberto = false;
    this.anotacaoSelecionada = null;
  }

  async confirmarTransferencia() {
    if (!this.anotacaoSelecionada) return;
    if (!this.jogadorDestino) {
      alert('⚠️ Selecione um jogador ou a opção Todos!');
      return;
    }

    this.processando = true;
    try {
      const anot = this.anotacaoSelecionada;
      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');

      // 🔄 duplicar imagem se houver
      let novaImagemUrl: string | undefined = undefined;
      if (anot.imagem && anot.imagem !== '-') {
        try {
          const file = await this.urlToFile(
            anot.imagem,
            `anotacao-${Date.now()}.jpg`
          );
          const base64 = await ImageUtils.toOptimizedBase64(file);
          // 🔼 Upload com repositório de upload
          const result = await this.uploadRepo.create({
            id: IdUtils.generateULID(),
            base64,
            nome: file.name,
          });
          novaImagemUrl = result?.url || anot.imagem;
        } catch (err) {
          console.warn('[Transferencia] falha ao duplicar imagem:', err);
        }
      }

      let criacoes: AnotacaoDomain[] = [];

      if (this.jogadorDestino === '__all__') {
        criacoes = this.jogadores.map((j) =>
          this.criarCopia(anot, j.email, user.email, novaImagemUrl)
        );
      } else {
        criacoes = [
          this.criarCopia(anot, this.jogadorDestino, user.email, novaImagemUrl),
        ];
      }

      await this.repo.createBatch(criacoes);

      alert('✅ Anotação transferida com sucesso!');
      this.fecharModal();
    } catch (err) {
      console.error('[Anotacoes] Erro na transferência:', err);
      alert('❌ Erro ao transferir anotação');
    } finally {
      this.processando = false;
    }
  }

  private criarCopia(
    orig: AnotacaoDomain,
    destino: string,
    autor: string,
    novaImagemUrl?: string
  ): AnotacaoDomain {
    return {
      ...orig,
      id: IdUtils.generateULID(),
      jogador: destino,
      autor: autor,
      data: new Date().toISOString(),
      imagem: novaImagemUrl || orig.imagem,
    };
  }

  /** 🔧 Converte URL → File */
  private async urlToFile(url: string, filename: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  /** Remove acentos e normaliza texto */
  private normalizarTexto(txt: string): string {
    return txt
      ? txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      : '';
  }
}

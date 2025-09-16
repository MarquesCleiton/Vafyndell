import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnotacaoDomain } from '../../../domain/AnotacaoDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { AuthService } from '../../../core/auth/AuthService';

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

  private repo = new BaseRepository<AnotacaoDomain>('Anotacoes', 'Anotacoes');

  constructor(private router: Router) { }

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
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
    const minhasLocais = locais.filter(a => a.jogador === user.email);
    this.processarSecoes(minhasLocais);

    // 2. Sync paralelo
    this.repo.sync().then(async (updated) => {
      if (updated) {
        const atualizadas = await this.repo.getLocal();
        const minhasAtualizadas = atualizadas.filter(a => a.jogador === user.email);
        this.processarSecoes(minhasAtualizadas);
      }
    });

    // 3. Se não havia nada local
    if (minhasLocais.length === 0) {
      const online = await this.repo.forceFetch();
      const minhasOnline = online.filter(a => a.jogador === user.email);
      this.processarSecoes(minhasOnline);
    }
  }

  /** Agrupa por data e mantém expandido */
  private processarSecoes(lista: AnotacaoDomain[]) {
    const estados = new Map(this.secoes.map(s => [s.data, s.expandido]));
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
        itens: itens.sort((a, b) =>
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
        itens: s.itens.filter((a) =>
          this.normalizarTexto(a.titulo || "").includes(termo) ||
          this.normalizarTexto(a.descricao || "").includes(termo) ||
          this.normalizarTexto(a.tags || "").includes(termo) ||
          this.normalizarTexto(a.autor || "").includes(termo)
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
      const d = data.includes('T') ? new Date(data) : new Date(data + 'T00:00:00');
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

  /** Remove acentos e normaliza texto */
  private normalizarTexto(txt: string): string {
    return txt
      ? txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      : "";
  }

}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AnotacaoRepository } from '../../repositories/AnotacaoRepository';
import { AnotacaoDomain } from '../../domain/AnotacaoDomain';

@Component({
  selector: 'app-anotacoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anotacoes.html',
  styleUrls: ['./anotacoes.css'],
})
export class Anotacoes implements OnInit {
  secoes: { data: string; itens: AnotacaoDomain[]; expandido: boolean }[] = [];
  secoesFiltradas: { data: string; itens: AnotacaoDomain[]; expandido: boolean }[] = [];
  carregando = true;
  filtro = '';

  constructor(private router: Router) { }

  async ngOnInit() {
    try {
      console.log('[Anotacoes] Iniciando carregamento...');
      this.carregando = true;

      // 1. Busca local
      const locais = await AnotacaoRepository.getLocalAnotacoes();
      if (locais.length) {
        this.processarAnotacoes(locais);
        this.carregando = false;
      }

      // 2. Valida online em paralelo
      (async () => {
        const updated = await AnotacaoRepository.syncAnotacoes();
        if (updated) {
          console.log('[Anotacoes] Sync trouxe alterações.');
          const atualizadas = await AnotacaoRepository.getLocalAnotacoes();
          this.processarAnotacoes(atualizadas);
        }
      })();

      // 3. Se não havia nada local → fallback online
      if (!locais.length) {
        console.log('[Anotacoes] Nenhuma anotação local. Buscando online...');
        const online = await AnotacaoRepository.forceFetchAnotacoes();
        this.processarAnotacoes(online);
        this.carregando = false;
      }
    } catch (err) {
      console.error('[Anotacoes] Erro ao carregar:', err);
      this.carregando = false;
    }
  }


  /** Agrupa anotações por data (ignora hora) */
  private processarAnotacoes(itens: AnotacaoDomain[]) {
    const mapa = new Map<string, AnotacaoDomain[]>();

    itens.forEach(i => {
      const rawData = i.data || '';
      // Se tiver hora → pega só a parte da data
      const soData = rawData.includes('T') ? rawData.split('T')[0] : rawData;
      if (!mapa.has(soData)) mapa.set(soData, []);
      mapa.get(soData)!.push(i);
    });

    this.secoes = Array.from(mapa.entries())
      .sort((a, b) => {
        const dataA = new Date(a[0]).getTime();
        const dataB = new Date(b[0]).getTime();
        return dataB - dataA; // mais recente primeiro
      })
      .map(([data, itens]) => ({
        data,
        itens: itens.sort((a, b) =>
          new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime()
        ), // dentro da sessão, mais novas primeiro
        expandido: false,
      }));

    this.secoesFiltradas = [...this.secoes];
  }

  toggleSecao(secao: any) {
    secao.expandido = !secao.expandido;
  }

  aplicarFiltro() {
    const termo = this.filtro.toLowerCase();
    if (!termo) {
      this.secoesFiltradas = [...this.secoes];
      return;
    }

    this.secoesFiltradas = this.secoes
      .map(s => ({
        ...s,
        itens: s.itens.filter(i =>
          String(i.titulo || '').toLowerCase().includes(termo) ||
          String(i.descricao || '').toLowerCase().includes(termo) ||
          String(i.tags || '').toLowerCase().includes(termo) ||
          String(i.autor || '').toLowerCase().includes(termo)
        ),
        expandido: true, // 👈 sempre expande quando há filtro
      }))
      .filter(s => s.itens.length > 0);
  }

  /** Formata a data ISO para dd/MM/yyyy */
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
}

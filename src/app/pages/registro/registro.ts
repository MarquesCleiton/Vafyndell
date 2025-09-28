import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegistroDomain } from '../../domain/RegistroDomain';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../repositories/BaseRepositoryV2';

interface SecaoRegistro {
  data: string;
  itens: RegistroDomain[];
  expandido: boolean;
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css'],
})
export class Registro implements OnInit {
  secoes: SecaoRegistro[] = [];
  secoesFiltradas: SecaoRegistro[] = [];
  carregando = true;
  filtro = '';

  private repo = new BaseRepositoryV2<RegistroDomain>('Registro');
  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();
    } catch (err) {
      console.error('[Registro] Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  /** 🔄 Carrega registros locais e sincroniza em paralelo */
  private async loadLocalAndSync() {
    const locais = await this.repo.getLocal();
    await this.resolveJogadores(locais);
    this.processarSecoes(locais);

    this.repo.sync().then(async updated => {
      if (updated) {
        const atualizados = await this.repo.getLocal();
        await this.resolveJogadores(atualizados);
        this.processarSecoes(atualizados);
      }
    });

    if (locais.length === 0) {
      const online = await this.repo.forceFetch();
      await this.resolveJogadores(online);
      this.processarSecoes(online);
    }
  }

  /** 🔑 Resolve IDs → jogadores reais */
  private async resolveJogadores(registros: RegistroDomain[]) {
    const jogadores = await this.jogadoresRepo.getLocal();

    registros.forEach(r => {
      r.ofensor = jogadores.find(j => j.email === r.jogador) || null;
      r.vitima = jogadores.find(j => j.email === r.alvo) || null;
    });
  }

  /** Agrupa registros por data */
  private processarSecoes(lista: RegistroDomain[]) {
    const estados = new Map(this.secoes.map(s => [s.data, s.expandido]));
    const mapa = new Map<string, RegistroDomain[]>();

    lista.forEach(r => {
      const rawData = r.data || '';
      const soData = rawData.includes('T') ? rawData.split('T')[0] : rawData;
      if (!mapa.has(soData)) mapa.set(soData, []);
      mapa.get(soData)!.push(r);
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
      .map(s => ({
        ...s,
        itens: s.itens.filter(r =>
          this.normalizarTexto(r.detalhes).includes(termo)
        ),
        expandido: true,
      }))
      .filter(s => s.itens.length > 0);
  }

  toggleSecao(secao: SecaoRegistro) {
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

  private normalizarTexto(txt: string): string {
    return txt
      ? txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      : '';
  }
}

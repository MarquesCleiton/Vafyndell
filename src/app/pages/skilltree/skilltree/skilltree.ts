import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxGraphModule } from '@swimlane/ngx-graph';

import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../../../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../../../domain/skilltreeDomains/ArvoreDomain';
import { RamoDomain } from '../../../domain/skilltreeDomains/RamoDomain';
import { HabilidadeDomain } from '../../../domain/skilltreeDomains/HabilidadeDomain';

@Component({
  selector: 'app-skilltree',
  standalone: true,
  imports: [CommonModule, NgxGraphModule],
  templateUrl: './skilltree.html',
  styleUrls: ['./skilltree.css'],
})
export class SkillTree implements OnInit {
  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  ramos: RamoDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  carregando = true;
  habilidadeSelecionada: HabilidadeDomain | null = null;

  // Grafo atual
  nodes: any[] = [];
  links: any[] = [];

  abaAtiva: string | null = null;

  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoRamo = new BaseRepositoryV2<RamoDomain>('Ramos');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  async ngOnInit() {
    this.carregando = true;
    try {
      await this.loadLocalAndSync();

      if (this.caminhos.length > 0) {
        this.abaAtiva = this.caminhos[0].id;
        this.montarGrafo(this.abaAtiva);
      }
    } catch (err) {
      console.error('[SkillTree] ❌ Erro ao carregar:', err);
    } finally {
      this.carregando = false;
    }
  }

  private async loadLocalAndSync() {
    console.log('[SkillTree] 📂 Carregando dados locais...');
    this.caminhos = await this.repoCaminho.getLocal();
    this.arvores = await this.repoArvore.getLocal();
    this.ramos = await this.repoRamo.getLocal();
    this.habilidades = await this.repoHab.getLocal();

    // sync em paralelo
    this.repoCaminho.sync().then(async (updated) => {
      if (updated) this.caminhos = await this.repoCaminho.getLocal();
    });
    this.repoArvore.sync().then(async (updated) => {
      if (updated) this.arvores = await this.repoArvore.getLocal();
    });
    this.repoRamo.sync().then(async (updated) => {
      if (updated) this.ramos = await this.repoRamo.getLocal();
    });
    this.repoHab.sync().then(async (updated) => {
      if (updated) this.habilidades = await this.repoHab.getLocal();
    });

    // se vazio local → força online
    if (this.caminhos.length === 0) {
      console.log('[SkillTree] 🌐 Nenhum dado local, forçando fetch online...');
      const result = await BaseRepositoryV2.multiFetch(['Caminhos', 'Arvores', 'Ramos', 'Habilidades']);
      this.caminhos = result['Caminhos'] as CaminhoDomain[];
      this.arvores = result['Arvores'] as ArvoreDomain[];
      this.ramos = result['Ramos'] as RamoDomain[];
      this.habilidades = result['Habilidades'] as HabilidadeDomain[];
    }
  }

  private montarGrafo(caminhoId: string) {
    console.log(`[SkillTree] 🔗 Montando grafo para caminho ${caminhoId}`);
    const arvoresDoCaminho = this.arvores.filter(a => String(a.caminho) === String(caminhoId));
    const ramosDoCaminho = this.ramos.filter(r => arvoresDoCaminho.some(a => String(a.id) === String(r.arvore)));
    const habilidadesDoCaminho = this.habilidades.filter(h => ramosDoCaminho.some(r => String(r.id) === String(h.ramo)));

    this.nodes = habilidadesDoCaminho.map(h => ({
      id: String(h.id),
      label: `${h.habilidade} (Lv ${h.nivel})`
    }));

    this.links = habilidadesDoCaminho
      .filter(h => h.dependencia)
      .map(h => ({
        source: String(h.dependencia),
        target: String(h.id)
      }));
  }

  selecionarAba(caminho: CaminhoDomain) {
    this.abaAtiva = caminho.id;
    this.montarGrafo(this.abaAtiva);
  }

  selecionarHab(h: HabilidadeDomain) {
    this.habilidadeSelecionada = h;
  }
}

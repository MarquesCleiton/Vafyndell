import { Injectable } from '@angular/core';
import { BaseRepositoryV2 } from '../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../domain/skilltreeDomains/HabilidadeDomain';
import { IdUtils } from '../core/utils/IdUtils';

@Injectable({ providedIn: 'root' })
export class CaminhoService {
  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  async carregarCaminhos() {
    this.caminhos = await this.repoCaminho.getLocal();
    this.arvores = await this.repoArvore.getLocal();
    this.habilidades = await this.repoHab.getLocal();
  }

  getArvoresDoCaminho(caminhoId: string | null): ArvoreDomain[] {
    return caminhoId ? this.arvores.filter(a => String(a.caminho) === String(caminhoId)) : [];
  }

  getHabilidadesDoCaminho(caminhoId: string | null): HabilidadeDomain[] {
    if (!caminhoId) return [];
    const arvoresIds = this.arvores.filter(a => String(a.caminho) === String(caminhoId)).map(a => a.id);
    return this.habilidades.filter(h => arvoresIds.includes(h.arvore));
  }

  async salvarCaminho(id: string | null, nome: string) {
    if (!nome.trim()) return;
    if (!id) {
      const novo: CaminhoDomain = { id: IdUtils.generateULID(), caminho: nome.trim() };
      this.caminhos.push(novo);
      await BaseRepositoryV2.batch({ create: { Caminhos: [novo] } });
    } else {
      const c = this.caminhos.find(x => x.id === id);
      if (c) c.caminho = nome.trim();
      await BaseRepositoryV2.batch({ updateById: { Caminhos: this.caminhos } });
    }
  }

  async excluirCaminho(id: string) {
    const dependentesArvores = this.arvores.filter(a => String(a.caminho) === String(id));
    const dependentesHabs = this.habilidades.filter(h => dependentesArvores.some(a => a.id === h.arvore));

    if (dependentesArvores.length || dependentesHabs.length) {
      const confirma = confirm('⚠️ Este caminho possui dependências que serão afetadas. Deseja continuar?');
      if (!confirma) return false;
    }

    this.caminhos = this.caminhos.filter(c => c.id !== id);
    await BaseRepositoryV2.batch({ deleteById: { Caminhos: [{ id }] } });
    return true;
  }
}

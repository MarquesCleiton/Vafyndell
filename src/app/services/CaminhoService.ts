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
      if (!c) return;
      c.caminho = nome.trim();
      // BUG-03 fix: envia apenas o caminho editado, não todos
      await BaseRepositoryV2.batch({ updateById: { Caminhos: [c] } });
    }
  }

  async excluirCaminho(id: string) {
    const dependentesArvores = this.arvores.filter(a => String(a.caminho) === String(id));
    const idsArvores = dependentesArvores.map(a => a.id);
    const dependentesHabs = this.habilidades.filter(h => idsArvores.includes(h.arvore));

    if (dependentesArvores.length || dependentesHabs.length) {
      const confirma = confirm(
        `⚠️ Este caminho possui ${dependentesArvores.length} árvore(s) e ${dependentesHabs.length} habilidade(s) dependentes.

Todos serão excluídos permanentemente. Deseja continuar?`
      );
      if (!confirma) return false;
    }

    // BUG-04 fix: deletão em cascata — Caminhos + Arvores + Habilidades num único batch
    const deletePayload: Record<string, { id: string }[]> = {
      Caminhos: [{ id }],
    };
    if (idsArvores.length > 0) {
      deletePayload['Arvores'] = idsArvores.map(aid => ({ id: aid }));
    }
    if (dependentesHabs.length > 0) {
      deletePayload['Habilidades'] = dependentesHabs.map(h => ({ id: String(h.id) }));
    }

    await BaseRepositoryV2.batch({ deleteById: deletePayload });

    // Atualiza estado local
    this.caminhos = this.caminhos.filter(c => c.id !== id);
    this.arvores = this.arvores.filter(a => !idsArvores.includes(a.id));
    this.habilidades = this.habilidades.filter(h => !idsArvores.includes(h.arvore));

    return true;
  }
}

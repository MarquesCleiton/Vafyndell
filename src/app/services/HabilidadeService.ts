import { Injectable } from '@angular/core';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';

import { BaseRepositoryV2 } from '../repositories/BaseRepositoryV2';
import { CaminhoDomain } from '../domain/skilltreeDomains/CaminhoDomain';
import { ArvoreDomain } from '../domain/skilltreeDomains/ArvoreDomain';
import { HabilidadeDomain } from '../domain/skilltreeDomains/HabilidadeDomain';
import { IdUtils } from '../core/utils/IdUtils';

cytoscape.use(dagre);

@Injectable({ providedIn: 'root' })
export class HabilidadeService {
  private repoCaminho = new BaseRepositoryV2<CaminhoDomain>('Caminhos');
  private repoArvore = new BaseRepositoryV2<ArvoreDomain>('Arvores');
  private repoHab = new BaseRepositoryV2<HabilidadeDomain>('Habilidades');

  caminhos: CaminhoDomain[] = [];
  arvores: ArvoreDomain[] = [];
  habilidades: HabilidadeDomain[] = [];

  /** 🔥 Carrega tudo já normalizando IDs para string */
  async carregarTudo() {
    this.caminhos = (await this.repoCaminho.getLocal()).map(c => ({
      ...c,
      id: String(c.id),
    }));

    this.arvores = (await this.repoArvore.getLocal()).map(a => ({
      ...a,
      id: String(a.id),
      caminho: String(a.caminho),
    }));

    this.habilidades = (await this.repoHab.getLocal()).map(h => ({
      ...h,
      id: String(h.id),
      caminho: String(h.caminho),
      arvore: String(h.arvore),
      dependencia: h.dependencia ? String(h.dependencia) : null,
    }));
  }

  getArvoresDoCaminho(caminhoId: string | null): ArvoreDomain[] {
    return caminhoId
      ? this.arvores.filter((a) => String(a.caminho) === String(caminhoId))
      : [];
  }

  getHabilidadesDaArvore(arvoreId: string | null): HabilidadeDomain[] {
    return arvoreId && arvoreId !== 'nova'
      ? this.habilidades.filter((h) => String(h.arvore) === String(arvoreId))
      : [];
  }

  renderPreview(
    container: HTMLElement,
    habilidades: HabilidadeDomain[],
    habilidadeEdit: HabilidadeDomain,
    dependenciaSelecionada: string | null,
    editMode: boolean,
    onSelect: (h: HabilidadeDomain | null) => void
  ): Core {
    const elements: ElementDefinition[] = [];

    // Habilidades já existentes (ignora a que está em edição)
    habilidades.forEach((h) => {
      if (habilidadeEdit.id && String(h.id) === String(habilidadeEdit.id)) return;

      elements.push({
        data: { id: String(h.id), label: `${h.habilidade}` },
      });

      if (h.dependencia) {
        elements.push({
          data: { source: String(h.dependencia), target: String(h.id) },
        });
      }
    });

    // Sempre renderizar a habilidade em edição (nova ou existente)
    if (habilidadeEdit.caminho && habilidadeEdit.arvore) {
      const tempId = habilidadeEdit.id || 'novaHab';
      const label = habilidadeEdit.habilidade
        ? `${habilidadeEdit.habilidade}`
        : `Nova Habilidade`;

      elements.push({
        data: { id: String(tempId), label },
        classes: editMode ? 'habilidade-edit' : 'nova-habilidade',
      });

      if (dependenciaSelecionada) {
        elements.push({
          data: { source: String(dependenciaSelecionada), target: String(tempId) },
        });
      }
    }

    const cyInstance = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#222',
            'border-color': '#555',
            'border-width': 2,
            label: 'data(label)',
            color: '#eee',
            'text-valign': 'center',
            'text-halign': 'center',
            width: '65px',
            height: '65px',
            'font-size': '10px',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            shape: 'ellipse',
          },
        },
        {
          selector: 'node.habilidade-edit',
          style: {
            'background-color': '#0056b3',
            'border-color': '#0d6efd',
            'border-width': 4,
            color: '#fff',
          },
        },
        {
          selector: 'node.nova-habilidade',
          style: {
            'background-color': '#007bff',
            'border-color': '#fff',
            'border-width': 3,
            color: '#fff',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#666',
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [-30, 30],
            'control-point-weights': [0.5, 0.5],
          },
        },
      ],
      layout: { name: 'dagre', rankDir: 'TB', nodeSep: 100, rankSep: 80 } as any,
      autoungrabify: true,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    cyInstance.on('tap', 'node', (evt) => {
      const id = String(evt.target.id());
      const found = habilidades.find((h) => String(h.id) === id) || null;
      onSelect(found);
    });

    return cyInstance;
  }

  async salvarHabilidade(
    habilidadeEdit: HabilidadeDomain,
    caminhoSelecionado: string | null,
    arvoreSelecionada: string | null,
    dependenciaSelecionada: string | null,
    novaArvoreNome: string,
    arvores: ArvoreDomain[],
    habilidades: HabilidadeDomain[],
  ) {
    const creates: any = {};
    const updates: any = {};
    const deletes: any = {};

    // Nova árvore
    if (arvoreSelecionada === 'nova' && novaArvoreNome.trim()) {
      const novaArvore: ArvoreDomain = {
        id: IdUtils.generateULID(),
        caminho: String(caminhoSelecionado || ''),
        arvore: novaArvoreNome.trim(),
      };
      arvores.push(novaArvore);
      arvoreSelecionada = novaArvore.id;

      creates['Arvores'] = [novaArvore];
    }

    // Normalização 🔥
    habilidadeEdit.id = String(habilidadeEdit.id || IdUtils.generateULID());
    habilidadeEdit.caminho = String(caminhoSelecionado || '');
    habilidadeEdit.arvore = String(arvoreSelecionada || '');
    habilidadeEdit.dependencia = dependenciaSelecionada ? String(dependenciaSelecionada) : null;

    // Insert ou Update
    if (!habilidades.find((h) => String(h.id) === habilidadeEdit.id)) {
      if (!creates['Habilidades']) creates['Habilidades'] = [];
      creates['Habilidades'].push(habilidadeEdit);
    } else {
      if (!updates['Habilidades']) updates['Habilidades'] = [];
      updates['Habilidades'].push(habilidadeEdit);
    }

    return await BaseRepositoryV2.batch({
      create: Object.keys(creates).length ? creates : undefined,
      updateById: Object.keys(updates).length ? updates : undefined,
      deleteById: Object.keys(deletes).length ? deletes : undefined,
    });
  }

  async excluirHabilidade(id: string) {
    return await BaseRepositoryV2.batch({
      deleteById: { Habilidades: [{ id: String(id) }] },
    });
  }

  async excluirHabilidadeComDependencias(
    id: string,
    habilidades: HabilidadeDomain[]
  ) {
    const dependentes = habilidades.filter(
      (h) => String(h.dependencia) === String(id)
    );

    if (dependentes.length > 0) {
      const lista = dependentes
        .map((h) => `- ${h.habilidade}`)
        .join('\n');

      const confirma = confirm(
        `⚠️ Esta habilidade possui dependentes:\n\n${lista}\n\n` +
        `Se continuar, esses vínculos serão removidos. Deseja prosseguir?`
      );

      if (!confirma) return false;

      dependentes.forEach((h) => {
        h.dependencia = null;
        h.id = String(h.id); // 🔥 normaliza
        const idx = habilidades.findIndex((x) => String(x.id) === String(h.id));
        if (idx !== -1) habilidades[idx] = { ...h };
      });
    }

    const updates: any = {};
    if (dependentes.length > 0) {
      updates['Habilidades'] = dependentes;
    }

    await BaseRepositoryV2.batch({
      deleteById: { Habilidades: [{ id: String(id) }] },
      updateById: Object.keys(updates).length ? updates : undefined,
    });

    return true;
  }
}

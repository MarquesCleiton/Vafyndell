// src/app/core/services/VisibilidadeService.ts
import { BaseRepositoryV2 } from "../repositories/BaseRepositoryV2";

export class VisibilidadeService<
  T extends { id: string; visivel_jogadores?: boolean }
> {
  constructor(private repo: BaseRepositoryV2<T>) {}

  /** Define visibilidade explícita */
  async setVisibilidade(id: string, visivel: boolean): Promise<T | null> {
    try {
      const item = await this.repo.getById(id, true);
      if (!item) {
        console.warn(`[VisibilidadeService] Item id=${id} não encontrado`);
        return null;
      }

      const atualizado = { ...item, visivel_jogadores: visivel } as T;
      const result = await this.repo.update(atualizado);
      console.log(`[VisibilidadeService] setVisibilidade OK →`, result);
      return result;
    } catch (err) {
      console.error("[VisibilidadeService] Erro em setVisibilidade:", err);
      return null;
    }
  }

  /** Alterna entre visível/oculto */
  async toggleVisibilidade(id: string): Promise<T | null> {
    try {
      const item = await this.repo.getById(id, true);
      if (!item) return null;

      const novoValor = !item.visivel_jogadores;
      return this.setVisibilidade(id, novoValor);
    } catch (err) {
      console.error("[VisibilidadeService] Erro em toggleVisibilidade:", err);
      return null;
    }
  }

  /** Atualiza em lote */
  async setVisibilidadeBatch(ids: string[], visivel: boolean): Promise<T[]> {
    try {
      const locais = await this.repo.getLocal();
      const items = locais
        .filter((i) => ids.includes(i.id))
        .map((i) => ({ ...i, visivel_jogadores: visivel } as T));

      if (items.length === 0) return [];

      const result = await this.repo.updateBatch(items);
      console.log(`[VisibilidadeService] setVisibilidadeBatch OK →`, result);
      return result;
    } catch (err) {
      console.error("[VisibilidadeService] Erro em setVisibilidadeBatch:", err);
      return [];
    }
  }
}

// src/app/core/services/VisibilidadeService.ts
import { BaseRepository } from "../repositories/BaseRepository";

export class VisibilidadeService<
    T extends { id: string; index: number; visivel_jogadores?: boolean }
> {
    constructor(private repo: BaseRepository<T>) { }

    /** Define visibilidade explícita */
    async setVisibilidade(index: number, visivel: boolean): Promise<T | null> {
        try {
            const locais = await this.repo.getLocal();
            const item = locais.find(i => i.index === index);
            if (!item) {
                console.warn(`[VisibilidadeService] Item index=${index} não encontrado`);
                return null;
            }

            const atualizado = { ...item, visivel_jogadores: visivel } as T;
            const result = await this.repo.update(atualizado);
            console.log(`[VisibilidadeService] setVisibilidade OK →`, result);
            return result;
        } catch (err) {
            console.error('[VisibilidadeService] Erro em setVisibilidade:', err);
            return null;
        }
    }

    /** Alterna entre visível/oculto */
    async toggleVisibilidade(index: number): Promise<T | null> {
        try {
            const locais = await this.repo.getLocal();
            const item = locais.find(i => i.index === index);
            if (!item) return null;

            const novoValor = !item.visivel_jogadores;
            return this.setVisibilidade(index, novoValor);
        } catch (err) {
            console.error('[VisibilidadeService] Erro em toggleVisibilidade:', err);
            return null;
        }
    }

    /** Atualiza em lote (útil para vários NPCs/itens de uma vez) */
    async setVisibilidadeBatch(
        indexes: number[],
        visivel: boolean
    ): Promise<T[]> {
        try {
            const locais = await this.repo.getLocal();
            const items = locais
                .filter(i => indexes.includes(i.index))
                .map(i => ({ ...i, visivel_jogadores: visivel } as T));

            if (items.length === 0) return [];

            const result = await this.repo.updateBatch(items);
            console.log(`[VisibilidadeService] setVisibilidadeBatch OK →`, result);
            return result;
        } catch (err) {
            console.error('[VisibilidadeService] Erro em setVisibilidadeBatch:', err);
            return [];
        }
    }
}

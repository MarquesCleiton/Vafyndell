import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';

export interface ReceitaDomain {
  id: number;
  index?: number;
  fabricavel: number;  // id do item resultante
  catalogo: number;    // id do item do catálogo usado como ingrediente
  quantidade: number;  // quantidade necessária
}

export class ReceitaRepository {
  private static TAB = 'Receitas';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[ReceitaRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Buscar todas online
  // =========================================================
  static async getAllReceitas(): Promise<ReceitaDomain[]> {
    console.log('[ReceitaRepository] getAllReceitas...');
    const onlineList = await ScriptClient.controllerGetAll<ReceitaDomain>({ tab: this.TAB });
    return Array.isArray(onlineList) ? onlineList : [];
  }

  // =========================================================
  // 📌 Buscar locais
  // =========================================================
  static async getLocalReceitas(): Promise<ReceitaDomain[]> {
    const db = await this.getDb();
    return await db.getAll<ReceitaDomain>(this.STORE);
  }

  // =========================================================
  // 📌 Força buscar online e atualizar cache
  // =========================================================
  static async forceFetchReceitas(): Promise<ReceitaDomain[]> {
    console.log('[ReceitaRepository] Baixando lista online...');
    const onlineList = await this.getAllReceitas();

    if (!onlineList.length) {
      console.warn('[ReceitaRepository] Nenhuma receita encontrada online.');
      return [];
    }

    const receitasComId = onlineList.map(r => ({ ...r, id: r.index || r.id }));
    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, receitasComId);

    // Atualiza metadados
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (Array.isArray(onlineMetaList)) {
      const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
      if (onlineMeta) {
        await db.put(this.META_STORE, {
          id: this.TAB,
          UltimaModificacao: onlineMeta.UltimaModificacao,
        });
        console.log('[ReceitaRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return receitasComId;
  }

  // =========================================================
  // 📌 Sincronizar (compara metadados)
  // =========================================================
  static async syncReceitas(): Promise<boolean> {
    console.log('[ReceitaRepository] Verificando necessidade de sincronização...');
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (!Array.isArray(onlineMetaList)) return false;

    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) return false;

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[ReceitaRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchReceitas();
      return true;
    }

    console.log('[ReceitaRepository] Cache já está atualizado.');
    return false;
  }
}

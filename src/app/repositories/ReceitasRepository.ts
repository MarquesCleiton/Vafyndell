import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { ReceitaDomain } from '../domain/ReceitaDomain';

export class ReceitasRepository {
  private static TAB = 'Receitas';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[ReceitasRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Criar receita
  // =========================================================
  static async createReceita(nova: ReceitaDomain): Promise<ReceitaDomain> {
    console.log('[ReceitasRepository] Criando nova receita...', nova);

    const created = await ScriptClient.controllerCreate({
      tab: this.TAB,
      attrs: nova,
    });

    const receitaFinal: ReceitaDomain = {
      ...created,
      id: created?.index || Date.now(),
    };

    const db = await this.getDb();
    await db.put(this.STORE, receitaFinal);

    console.log('[ReceitasRepository] Receita criada e salva no cache:', receitaFinal);
    return receitaFinal;
  }

  // =========================================================
  // 📌 Atualizar receita
  // =========================================================
  static async updateReceita(receita: ReceitaDomain): Promise<ReceitaDomain> {
    console.log('[ReceitasRepository] Atualizando receita...', receita);

    const updated = await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: receita.index,
      attrs: receita,
    });

    const receitaFinal: ReceitaDomain = {
      ...receita,
      ...updated,
    };

    const db = await this.getDb();
    await db.put(this.STORE, receitaFinal);

    console.log('[ReceitasRepository] Receita atualizada no cache local:', receitaFinal);
    return receitaFinal;
  }

  // =========================================================
  // 📌 Buscar todas (online)
  // =========================================================
  static async getAllReceitas(): Promise<ReceitaDomain[]> {
    console.log('[ReceitasRepository] getAllReceitas...');
    const onlineList = await ScriptClient.controllerGetAll<ReceitaDomain>({ tab: this.TAB });
    return Array.isArray(onlineList) ? onlineList : [];
  }

  // =========================================================
  // 📌 Buscar local
  // =========================================================
  static async getLocalReceitas(): Promise<ReceitaDomain[]> {
    const db = await this.getDb();
    return await db.getAll<ReceitaDomain>(this.STORE);
  }

  // =========================================================
  // 📌 Força buscar online (atualiza cache e metadados)
  // =========================================================
  static async forceFetchReceitas(): Promise<ReceitaDomain[]> {
    console.log('[ReceitasRepository] Baixando lista online...');
    const onlineList = await this.getAllReceitas();

    if (!onlineList.length) {
      console.warn('[ReceitasRepository] Nenhuma receita encontrada online.');
      return [];
    }

    const receitasComId = onlineList.map(r => ({ ...r, id: r.index }));
    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, receitasComId);
    console.log('[ReceitasRepository] Cache atualizado com lista online.');

    // 🔄 Atualiza metadados
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
        console.log('[ReceitasRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return receitasComId;
  }

  // =========================================================
  // 📌 Sincronizar
  // =========================================================
  static async syncReceitas(): Promise<boolean> {
    console.log('[ReceitasRepository] Verificando necessidade de sincronização...');
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (!Array.isArray(onlineMetaList)) return false;

    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) {
      console.warn('[ReceitasRepository] Nenhum metadado online encontrado.');
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[ReceitasRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchReceitas();
      return true;
    }

    console.log('[ReceitasRepository] Cache já está atualizado.');
    return false;
  }

  // =========================================================
  // 📌 Excluir receita
  // =========================================================
  static async deleteReceita(id: number): Promise<boolean> {
    console.log('[ReceitasRepository] Excluindo receita...', id);

    // Exclui no servidor
    await ScriptClient.controllerDeleteByIndex({
      tab: this.TAB,
      index: id,
    });

    // Exclui local
    const db = await this.getDb();
    await db.delete(this.STORE, id);

    console.log('[ReceitasRepository] Receita excluída do cache/local:', id);
    return true;
  }
}

import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { CatalogoDomain } from '../domain/CatalogoDomain';

export class CatalogoRepository {
  private static TAB = 'Catalogo';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  // 👉 Pasta compartilhada no Drive para imagens
  private static FOLDER_ID = '1zId11Ydti8d0FOQoQjd9lQmPo6GiJx26';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[CatalogoRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Criar item
  // =========================================================
  static async createItem(novo: CatalogoDomain): Promise<CatalogoDomain> {
    console.log('[CatalogoRepository] Criando novo item...', novo);

    const created = await ScriptClient.controllerCreate({
      tab: this.TAB,
      attrs: novo,
      folderId: this.FOLDER_ID,
    });

    const itemFinal: CatalogoDomain = {
      ...created,
      id: created?.index || Date.now(),
    };

    const db = await this.getDb();
    await db.put(this.STORE, itemFinal);

    console.log('[CatalogoRepository] Item criado e salvo no cache:', itemFinal);
    return itemFinal;
  }

  // =========================================================
  // 📌 Atualizar item
  // =========================================================
  static async updateItem(item: CatalogoDomain): Promise<CatalogoDomain> {
    console.log('[CatalogoRepository] Atualizando item...', item);

    const updated = await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: item.index,
      attrs: item,
      folderId: this.FOLDER_ID,
    });

    const itemFinal: CatalogoDomain = {
      ...item,
      ...updated,
    };

    const db = await this.getDb();
    await db.put(this.STORE, itemFinal);

    console.log('[CatalogoRepository] Item atualizado no cache local:', itemFinal);
    return itemFinal;
  }

  // =========================================================
  // 📌 Buscar todos (online)
  // =========================================================
  static async getAllItens(): Promise<CatalogoDomain[]> {
    console.log('[CatalogoRepository] getAllItens...');
    const onlineList = await ScriptClient.controllerGetAll<CatalogoDomain>({ tab: this.TAB });
    return Array.isArray(onlineList) ? onlineList : [];
  }

  // =========================================================
  // 📌 Buscar local
  // =========================================================
  static async getLocalItens(): Promise<CatalogoDomain[]> {
    const db = await this.getDb();
    return await db.getAll<CatalogoDomain>(this.STORE);
  }

  // =========================================================
  // 📌 Força buscar online (atualiza cache e metadados)
  // =========================================================
  static async forceFetchItens(): Promise<CatalogoDomain[]> {
    console.log('[CatalogoRepository] Baixando lista online...');
    const onlineList = await this.getAllItens();

    if (!onlineList.length) {
      console.warn('[CatalogoRepository] Nenhum item encontrado online.');
      return [];
    }

    const itensComId = onlineList.map(i => ({ ...i, id: i.index }));
    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, itensComId);
    console.log('[CatalogoRepository] Cache atualizado com lista online.');

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
        console.log('[CatalogoRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return itensComId;
  }

  // =========================================================
  // 📌 Sincronizar
  // =========================================================
  static async syncItens(): Promise<boolean> {
    console.log('[CatalogoRepository] Verificando necessidade de sincronização...');
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (!Array.isArray(onlineMetaList)) return false;

    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) {
      console.warn('[CatalogoRepository] Nenhum metadado online encontrado.');
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[CatalogoRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchItens();
      return true;
    }

    console.log('[CatalogoRepository] Cache já está atualizado.');
    return false;
  }
}

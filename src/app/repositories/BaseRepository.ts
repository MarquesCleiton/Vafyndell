import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClientV2 } from '../core/script/ScriptClientV2';
import { IdUtils } from '../core/utils/IdUtils';

export class BaseRepository<T extends { id: string; index: number }> {
  private static META_STORE = 'Metadados';
  private static dbPromise: Promise<IndexedDBClient> | null = null;

  constructor(private tab: string, private store: string = tab) { }

  private async getDb(): Promise<IndexedDBClient> {
    if (!BaseRepository.dbPromise) {
      BaseRepository.dbPromise = IndexedDBClient.create();
    }
    return BaseRepository.dbPromise;
  }

  // =========================================================
  // 📌 CRUD Unitários
  // =========================================================
  async create(item: Omit<T, 'id' | 'index'>): Promise<T> {
    console.log(`[BaseRepository:${this.tab}] ▶️ create →`, item);

    const result = await ScriptClientV2.controllerCreate({ tab: this.tab, ...item });
    console.log(`[BaseRepository:${this.tab}] ◀️ create result`, result);

    const created = ScriptClientV2.normalizeResponse<T>(result, this.tab)[0];
    const entity: T = {
      ...(item as any),
      ...created,
      id: created?.id || IdUtils.generateULID(),
      index: created?.index ?? Date.now(),
    };

    // Garantia da imagem final
    if ('imagem' in (created || {})) {
      const img = (created as any).imagem;
      if ((img || '').startsWith('http')) {
        (entity as any).imagem = img;
      }
    }

    await (await this.getDb()).put(this.store, entity);
    console.log(`[BaseRepository:${this.tab}] 💾 create persistido localmente →`, entity);
    return entity;
  }

  async update(item: T): Promise<T> {
    console.log(`[BaseRepository:${this.tab}] ▶️ update →`, item);

    const { index, ...rest } = item;
    const result = await ScriptClientV2.controllerUpdateByIndex({ tab: this.tab, index, ...rest });
    console.log(`[BaseRepository:${this.tab}] ◀️ update result`, result);

    const updated = ScriptClientV2.normalizeResponse<T>(result, this.tab)[0];
    const entity: T = {
      ...item,
      ...updated,
      id: updated?.id || item.id,
      index: updated?.index ?? item.index,
    };

    if ('imagem' in (updated || {})) {
      const img = (updated as any).imagem;
      if ((img || '').startsWith('http')) {
        (entity as any).imagem = img;
      }
    }

    await (await this.getDb()).put(this.store, entity);
    console.log(`[BaseRepository:${this.tab}] 💾 update persistido localmente →`, entity);
    return entity;
  }

  async delete(index: number): Promise<boolean> {
    console.log(`[BaseRepository:${this.tab}] ▶️ delete → index=${index}`);

    const db = await this.getDb();
    const entity = await db.get<T>(this.store, index);
    if (!entity) {
      console.warn(`[BaseRepository:${this.tab}] ⚠️ entidade index=${index} não encontrada localmente`);
      return false;
    }

    await ScriptClientV2.controllerDeleteByIndex({ tab: this.tab, index: entity.index });
    await db.delete(this.store, index);

    console.log(`[BaseRepository:${this.tab}] ◀️ delete concluído → index=${index}`);
    return true;
  }

  async getLocal(): Promise<T[]> {
    const db = await this.getDb();
    const list = await db.getAll<T>(this.store);
    console.log(`[BaseRepository:${this.tab}] 📂 getLocal →`, list);
    return list;
  }

  async getAllOnline(): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] 🌐 getAllOnline iniciado`);
    const result = await ScriptClientV2.controllerGetAll({ tab: this.tab });
    console.log(`[BaseRepository:${this.tab}] ◀️ getAllOnline result`, result);
    return ScriptClientV2.normalizeResponse<T>(result, this.tab);
  }

  async forceFetch(): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] 🌐 forceFetch iniciado`);
    const result = await ScriptClientV2.controllerGetAll({ tabs: [this.tab, 'Metadados'] });
    console.log(`[BaseRepository:${this.tab}] ◀️ forceFetch result`, result);

    const list = ScriptClientV2.normalizeResponse<T>(result, this.tab);

    const db = await this.getDb();
    await db.clear(this.store);
    await db.bulkPut(this.store, list);
    console.log(`[BaseRepository:${this.tab}] 💾 forceFetch persistiu ${list.length} registros`);

    const meta = (result as any)['Metadados']?.find((m: any) => m.SheetName === this.tab);
    if (meta) {
      await db.put(BaseRepository.META_STORE, {
        index: this.tab,
        SheetName: this.tab,
        UltimaModificacao: meta.UltimaModificacao,
      } as any);
      console.log(`[BaseRepository:${this.tab}] 📝 metadados atualizados →`, meta);
    }

    return list;
  }

  async sync(): Promise<boolean> {
    console.log(`[BaseRepository:${this.tab}] 🔄 sync iniciado`);
    const result = await ScriptClientV2.controllerGetAll<{ Metadados: any[] }>({ tabs: ['Metadados'] });
    console.log(`[BaseRepository:${this.tab}] ◀️ sync result`, result);

    const onlineMeta = (result as any)['Metadados']?.find((m: any) => m.SheetName === this.tab);
    if (!onlineMeta) {
      console.warn(`[BaseRepository:${this.tab}] ⚠️ Nenhum metadado encontrado online`);
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ index: string; UltimaModificacao: string }>(
      BaseRepository.META_STORE,
      this.tab
    );

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;
    if (precisaAtualizar) {
      console.log(`[BaseRepository:${this.tab}] ⚠️ Atualização necessária → executando forceFetch()`);
      await this.forceFetch();
      return true;
    }

    console.log(`[BaseRepository:${this.tab}] ✅ Nada para atualizar`);
    return false;
  }

  // =========================================================
  // 📌 Multioperações
  // =========================================================
  async createBatch(items: Omit<T, 'id' | 'index'>[]): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] ▶️ createBatch →`, items);
    const result = await ScriptClientV2.controllerCreateBatch({ [this.tab]: items });
    console.log(`[BaseRepository:${this.tab}] ◀️ createBatch result`, result);

    const arr = ScriptClientV2.normalizeResponse<T>(result, this.tab);
    const entities = arr.map((r, i) => ({
      ...(items[i] as any),
      ...r,
      id: r.id || IdUtils.generateULID(),
      index: r.index ?? Date.now() + i,
    }));

    await (await this.getDb()).bulkPut(this.store, entities);
    console.log(`[BaseRepository:${this.tab}] 💾 createBatch persistiu ${entities.length} registros`);
    return entities;
  }

  async updateBatch(items: T[]): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] ▶️ updateBatch →`, items);
    const payloads = items.map(({ index, ...rest }) => ({ index, ...rest }));
    const result = await ScriptClientV2.controllerUpdateBatch({ [this.tab]: payloads });
    console.log(`[BaseRepository:${this.tab}] ◀️ updateBatch result`, result);

    const arr = (result as any)[this.tab] || [];
    const entities: T[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r = arr[i] || {};

      if (r.error === 'Linha apagada') {
        console.warn(`[BaseRepository:${this.tab}] ⚠️ index ${it.index} apagado → recriando`);
        const [created] = await this.createBatch([it]);
        entities.push(created);
      } else {
        entities.push({
          ...it,
          ...r,
          id: r.id || it.id,
          index: r.index ?? it.index,
        } as T);
      }
    }

    await (await this.getDb()).bulkPut(this.store, entities);
    console.log(`[BaseRepository:${this.tab}] 💾 updateBatch persistiu ${entities.length} registros`);
    return entities;
  }

  async deleteBatch(indexes: (number | string)[]): Promise<boolean> {
    console.log(`[BaseRepository:${this.tab}] ▶️ deleteBatch →`, indexes);

    await ScriptClientV2.controllerDeleteBatch({
      [this.tab]: indexes.map((index) => ({ index })),
    });

    const db = await this.getDb();
    await Promise.all(indexes.map((i) => db.delete(this.store, i)));

    console.log(`[BaseRepository:${this.tab}] ◀️ deleteBatch concluído →`, indexes);
    return true;
  }

  async getAllMulti(tabs: string[]): Promise<Record<string, any[]>> {
    console.log(`[BaseRepository:${this.tab}] 🌐 getAllMulti →`, tabs);
    const result = await ScriptClientV2.controllerGetAll({ tabs });
    console.log(`[BaseRepository:${this.tab}] ◀️ getAllMulti result`, result);

    const mapped: Record<string, any[]> = {};
    tabs.forEach((tab) => {
      mapped[tab] = ((result as any)[tab] || []).map((r: any) => ({
        ...r,
        id: String(r.id),
        index: r.index,
      }));
    });
    console.log(`[BaseRepository:${this.tab}] 📊 getAllMulti mapeado →`, mapped);
    return mapped;
  }

  // =========================================================
  // 📌 Helpers locais
  // =========================================================
  async putLocal(item: T) {
    console.log(`[BaseRepository:${this.tab}] 💾 putLocal →`, item);
    await (await this.getDb()).put(this.store, item);
  }

  async bulkPutLocal(items: T[]) {
    console.log(`[BaseRepository:${this.tab}] 💾 bulkPutLocal →`, items);
    await (await this.getDb()).bulkPut(this.store, items);
  }

  async clearLocal() {
    console.log(`[BaseRepository:${this.tab}] 🧹 clearLocal`);
    await (await this.getDb()).clear(this.store);
  }

  async deleteLocal(index: number) {
    console.log(`[BaseRepository:${this.tab}] 🗑️ deleteLocal → index=${index}`);
    await (await this.getDb()).delete(this.store, index);
  }
}

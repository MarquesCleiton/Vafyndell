import { IndexedDBClientV2 } from '../core/db/IndexedDBClientV2';
import { ScriptClientV3 } from '../core/script/ScriptClientV3';

export class BaseRepositoryV2<T extends { id: string }> {
  private static META_STORE = 'Metadados';
  private static dbPromise: Promise<IndexedDBClientV2> | null = null;

  constructor(private tab: string) { }
  private get store() { return this.tab; }

  private async getDb(): Promise<IndexedDBClientV2> {
    if (!BaseRepositoryV2.dbPromise) {
      BaseRepositoryV2.dbPromise = IndexedDBClientV2.create();
    }
    return BaseRepositoryV2.dbPromise;
  }

  // =========================================================
  // 📌 Helper: normalizar ID sempre para string
  // =========================================================
  private normalizeId<U extends { id: any }>(item: U): U {
    return { ...item, id: String(item.id) } as U;
  }

  // =========================================================
  // 📌 CRUD por ID
  // =========================================================
  async create(item: Omit<T, 'id'>): Promise<T> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ create →`, item);

    const result = await ScriptClientV3.create({ [this.tab]: [item] });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ create result`, result);

    const created = (result?.create?.[this.tab] || [])[0];
    if (!created?.ok) throw new Error(`[${this.tab}] Erro ao criar: ${created?.erro || 'desconhecido'}`);

    const entity = this.normalizeId({ ...(item as any), ...created }) as T;
    await (await this.getDb()).put(this.store, entity);

    console.log(`[BaseRepositoryV2:${this.tab}] 💾 create persistido localmente →`, entity);
    return entity;
  }

  async update(item: T): Promise<T> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ update →`, item);

    const result = await ScriptClientV3.updateById({ [this.tab]: [item] });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ update result`, result);

    const updated = (result?.updateById?.[this.tab] || [])[0];
    if (!updated?.ok) throw new Error(`[${this.tab}] Erro ao atualizar: ${updated?.erro || 'desconhecido'}`);

    const entity = this.normalizeId({ ...item, ...updated }) as T;
    await (await this.getDb()).put(this.store, entity);

    console.log(`[BaseRepositoryV2:${this.tab}] 💾 update persistido localmente →`, entity);
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ delete → id=${id}`);

    const result = await ScriptClientV3.deleteById({ [this.tab]: [{ id }] });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ delete result`, result);

    const deleted = (result?.deleteById?.[this.tab] || [])[0];
    if (!deleted?.ok) {
      console.warn(`[BaseRepositoryV2:${this.tab}] ⚠️ não foi possível deletar id=${id}`);
      return false;
    }

    await (await this.getDb()).delete(this.store, String(id));
    console.log(`[BaseRepositoryV2:${this.tab}] 💾 delete persistido localmente → id=${id}`);
    return true;
  }

  // =========================================================
  // 📌 Multioperações
  // =========================================================
  async createBatch(items: Omit<T, 'id'>[]): Promise<T[]> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ createBatch →`, items);

    const result = await ScriptClientV3.create({ [this.tab]: items });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ createBatch result`, result);

    const arr = result?.create?.[this.tab] || [];
    const map = new Map(arr.map((r: any) => [String(r.id), r]));
    const entities = items.map(it =>
      this.normalizeId({ ...(it as any), ...(map.get(String((it as any).id)) || {}) })
    ) as T[];

    await (await this.getDb()).bulkPut(this.store, entities);
    console.log(`[BaseRepositoryV2:${this.tab}] 💾 createBatch persistiu ${entities.length} registros`);
    return entities;
  }

  async updateBatch(items: T[]): Promise<T[]> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ updateBatch →`, items);

    const result = await ScriptClientV3.updateById({ [this.tab]: items });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ updateBatch result`, result);

    const arr = result?.updateById?.[this.tab] || [];
    const map = new Map(arr.map((r: any) => [String(r.id), r]));
    const entities = items.map(it =>
      this.normalizeId({ ...it, ...(map.get(String(it.id)) || {}) })
    ) as T[];

    await (await this.getDb()).bulkPut(this.store, entities);
    console.log(`[BaseRepositoryV2:${this.tab}] 💾 updateBatch persistiu ${entities.length} registros`);
    return entities;
  }

  async deleteBatch(ids: string[]): Promise<boolean> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ deleteBatch →`, ids);

    const result = await ScriptClientV3.deleteById({
      [this.tab]: ids.map((id) => ({ id: String(id) })),
    });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ deleteBatch result`, result);

    const arr = result?.deleteById?.[this.tab] || [];
    const ok = arr.every((r: any) => r.ok);

    const db = await this.getDb();
    await Promise.all(ids.map((id) => db.delete(this.store, String(id))));

    console.log(`[BaseRepositoryV2:${this.tab}] 💾 deleteBatch persistido localmente → ${ids.length} registros`);
    return ok;
  }

  // =========================================================
  // 📌 Consultas
  // =========================================================
  async getLocal(): Promise<T[]> {
    const db = await this.getDb();
    const list = await db.getAll<T>(this.store);
    const normalized = list.map(it => this.normalizeId(it));
    console.log(`[BaseRepositoryV2:${this.tab}] 📂 getLocal →`, normalized);
    return normalized;
  }

  async getById(id: string, preferLocal = true): Promise<T | null> {
    console.log(`[BaseRepositoryV2:${this.tab}] ▶️ getById → id=${id} preferLocal=${preferLocal}`);

    if (preferLocal) {
      const local = await (await this.getDb()).get<T>(this.store, String(id));
      if (local) {
        const normalized = this.normalizeId(local);
        console.log(`[BaseRepositoryV2:${this.tab}] 📂 getById encontrado localmente →`, normalized);
        return normalized;
      }
      return null; // 🚨 não vai online quando preferLocal = true
    }

    const result = await ScriptClientV3.getById({ [this.tab]: [{ id: String(id) }] });
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ getById result`, result);
    const achado = result?.[this.tab]?.[0] || null;
    return achado ? this.normalizeId(achado) : null;
  }

  async getAllOnline(): Promise<T[]> {
    console.log(`[BaseRepositoryV2:${this.tab}] 🌐 getAllOnline iniciado`);
    const result = await ScriptClientV3.getAll(this.tab);
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ getAllOnline result`, result);

    return (result?.[this.tab] || []).map((it: any) => this.normalizeId(it));
  }

  async forceFetch(): Promise<T[]> {
    console.log(`[BaseRepositoryV2:${this.tab}] 🌐 forceFetch iniciado`);
    const result = await ScriptClientV3.getAll([this.tab, 'Metadados']);
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ forceFetch result`, result);

    const list = (result?.[this.tab] || []).map((it: any) => this.normalizeId(it));
    const db = await this.getDb();
    await db.clear(this.store);
    await db.bulkPut(this.store, list);

    console.log(`[BaseRepositoryV2:${this.tab}] 💾 forceFetch persistiu ${list.length} registros`);

    const meta = result?.['Metadados']?.find((m: any) => m.SheetName === this.tab);
    if (meta) {
      await db.put(BaseRepositoryV2.META_STORE, {
        id: this.tab,
        SheetName: this.tab,
        UltimaModificacao: meta.UltimaModificacao,
      } as any);
      console.log(`[BaseRepositoryV2:${this.tab}] 📝 metadados atualizados →`, meta);
    }

    return list;
  }

  async sync(): Promise<boolean> {
    console.log(`[BaseRepositoryV2:${this.tab}] 🔄 sync iniciado`);
    const result = await ScriptClientV3.getAll('Metadados');
    console.log(`[BaseRepositoryV2:${this.tab}] ◀️ sync result`, result);

    const onlineMeta = result?.['Metadados']?.find((m: any) => m.SheetName === this.tab);
    if (!onlineMeta) {
      console.warn(`[BaseRepositoryV2:${this.tab}] ⚠️ Nenhum metadado encontrado online`);
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(
      BaseRepositoryV2.META_STORE,
      this.tab
    );

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;
    if (precisaAtualizar) {
      console.log(`[BaseRepositoryV2:${this.tab}] ⚠️ Atualização necessária → executando forceFetch()`);
      await this.forceFetch();
      return true;
    }

    console.log(`[BaseRepositoryV2:${this.tab}] ✅ Nada para atualizar`);
    return false;
  }
}

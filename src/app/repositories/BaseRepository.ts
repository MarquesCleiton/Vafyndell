import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClientV2 } from '../core/script/ScriptClientV2';
import { IdUtils } from '../core/utils/IdUtils';

/**
 * Repository genérico baseado em IndexedDB + ScriptClientV2
 * - Suporta Cache First
 * - Suporta múltiplas operações em uma única chamada
 */
export class BaseRepository<T extends { id: string; index: number }> {
  private static META_STORE = 'metadados';
  private static dbPromise: Promise<IndexedDBClient> | null = null;

  constructor(
    private tab: string,
    private store: string = tab
  ) {}

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

    const created = (result as any)[this.tab]?.[0];
    const entity: T = {
      ...(item as any),
      ...created,
      id: created?.id ? String(created.id) : IdUtils.generateULID(),
      index: created?.index ?? 0,
    };

    const db = await this.getDb();
    await db.put(this.store, entity);

    return entity;
  }

  async update(item: T): Promise<T> {
    console.log(`[BaseRepository:${this.tab}] ▶️ update →`, item);

    const { index, ...rest } = item;
    const result = await ScriptClientV2.controllerUpdateByIndex({
      tab: this.tab,
      index,
      ...rest,
    });

    console.log(`[BaseRepository:${this.tab}] ◀️ update result`, result);

    const updated = (result as any)[this.tab]?.[0];
    const entity: T = {
      ...item,
      ...updated,
      id: updated?.id ? String(updated.id) : item.id,
      index: updated?.index || item.index,
    };

    const db = await this.getDb();
    await db.put(this.store, entity);

    return entity;
  }

  async delete(id: string): Promise<boolean> {
    console.log(`[BaseRepository:${this.tab}] ▶️ delete → id=${id}`);

    const db = await this.getDb();
    const entity = await db.get<T>(this.store, id);
    if (!entity) return false;

    await ScriptClientV2.controllerDeleteByIndex({
      tab: this.tab,
      index: entity.index,
    });

    await db.delete(this.store, id);

    console.log(`[BaseRepository:${this.tab}] ◀️ delete concluído para id=${id}`);
    return true;
  }

  async getLocal(): Promise<T[]> {
    const db = await this.getDb();
    const list = await db.getAll<T>(this.store);
    console.log(`[BaseRepository:${this.tab}] 📂 getLocal →`, list);
    return list;
  }

  async getAllOnline(): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] 🌐 getAllOnline`);
    const result = await ScriptClientV2.controllerGetAll({ tab: this.tab });
    console.log(`[BaseRepository:${this.tab}] ◀️ getAllOnline result`, result);

    return ((result as any)[this.tab] || []).map((r: any) => ({
      ...r,
      id: String(r.id),
      index: r.index,
    }));
  }

  async forceFetch(): Promise<T[]> {
    console.log(`[BaseRepository:${this.tab}] 🌐 forceFetch`);

    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const result = await ScriptClientV2.controllerGetAll({
      tabs: [this.tab, 'Metadados'],
    });
    console.log(`[BaseRepository:${this.tab}] ◀️ forceFetch result`, result);

    const list: T[] = ((result as any)[this.tab] || []).map((r: any) => ({
      ...r,
      id: String(r.id),
      index: r.index,
    }));

    const db = await this.getDb();
    await db.clear(this.store);
    await db.bulkPut(this.store, list);

    const meta = (result as any)['Metadados']?.find(
      (m: any) => m.SheetName === this.tab
    );
    if (meta) {
      await db.put(BaseRepository.META_STORE, {
        id: this.tab,
        UltimaModificacao: meta.UltimaModificacao,
      });
    }

    return list;
  }

  async sync(): Promise<boolean> {
    console.log(`[BaseRepository:${this.tab}] 🔄 sync iniciado`);

    const result =
      await ScriptClientV2.controllerGetAll<{
        Metadados: { SheetName: string; UltimaModificacao: string }[];
      }>({ tabs: ['Metadados'] });

    console.log(`[BaseRepository:${this.tab}] ◀️ sync result`, result);

    const metadados = (result as any)['Metadados'] || [];
    const onlineMeta = metadados.find((m: any) => m.SheetName === this.tab);
    if (!onlineMeta) {
      console.warn(`[BaseRepository:${this.tab}] Nenhum metadado encontrado`);
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(
      BaseRepository.META_STORE,
      this.tab
    );

    console.log(`[BaseRepository:${this.tab}] localMeta`, localMeta, 'onlineMeta', onlineMeta);

    const precisaAtualizar =
      !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

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
  async getAllMulti<Tabs extends string>(
    tabs: Tabs[]
  ): Promise<Record<Tabs, any[]>> {
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
    return mapped as Record<Tabs, any[]>;
  }

  async createBatch(payloads: Record<string, any[]>): Promise<Record<string, any[]>> {
    console.log(`[BaseRepository:${this.tab}] ▶️ createBatch →`, payloads);
    const result = await ScriptClientV2.controllerCreateBatch(payloads);
    console.log(`[BaseRepository:${this.tab}] ◀️ createBatch result`, result);

    Object.keys(result as any).forEach((tab) => {
      (result as any)[tab] = (result as any)[tab].map((r: any) => ({
        ...r,
        id: String(r.id),
        index: r.index,
      }));
    });
    return result as Record<string, any[]>;
  }

  async updateBatch(payloads: Record<string, any[]>): Promise<Record<string, any[]>> {
    console.log(`[BaseRepository:${this.tab}] ▶️ updateBatch →`, payloads);
    const result = await ScriptClientV2.controllerUpdateBatch(payloads);
    console.log(`[BaseRepository:${this.tab}] ◀️ updateBatch result`, result);

    Object.keys(result as any).forEach((tab) => {
      (result as any)[tab] = (result as any)[tab].map((r: any) => ({
        ...r,
        id: String(r.id),
        index: r.index,
      }));
    });
    return result as Record<string, any[]>;
  }

  async deleteBatch(payloads: Record<string, { index: number }[]>): Promise<Record<string, any[]>> {
    console.log(`[BaseRepository:${this.tab}] ▶️ deleteBatch →`, payloads);
    const result = await ScriptClientV2.controllerDeleteBatch(payloads);
    console.log(`[BaseRepository:${this.tab}] ◀️ deleteBatch result`, result);
    return result as Record<string, any[]>;
  }
}

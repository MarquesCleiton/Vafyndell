import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { InventarioDomain } from '../domain/InventarioDomain';

export class InventarioRepository {
  private static TAB = 'Inventario';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[InventarioRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Criar registro no inventário
  // =========================================================
  static async createInventario(novo: InventarioDomain): Promise<InventarioDomain> {
    console.log('[InventarioRepository] Criando novo registro de inventário...', novo);

    const created = await ScriptClient.controllerCreate({
      tab: this.TAB,
      attrs: novo,
    });

    const inventarioFinal: InventarioDomain = {
      ...created,
      id: Number(created?.id) || Date.now(),
      index: created?.index,
    };

    const db = await this.getDb();
    await db.put(this.STORE, inventarioFinal);

    console.log('[InventarioRepository] Registro criado e salvo no cache:', inventarioFinal);
    return inventarioFinal;
  }

  // =========================================================
  // 📌 Atualizar inventário
  // =========================================================
  static async updateInventario(item: InventarioDomain): Promise<InventarioDomain> {
    console.log('[InventarioRepository] Atualizando inventário...', item);

    const updated = await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: item.index!,
      attrs: item,
    });

    const inventarioFinal: InventarioDomain = {
      ...item,
      ...updated,
      id: Number(updated?.id || item.id),
      index: updated?.index || item.index,
    };

    const db = await this.getDb();
    await db.put(this.STORE, inventarioFinal);

    console.log('[InventarioRepository] Inventário atualizado no cache local:', inventarioFinal);
    return inventarioFinal;
  }

  // =========================================================
  // 📌 Subtrair quantidade
  // =========================================================
  static async subtrairQuantidade(email: string, catalogoId: number, quantidade: number): Promise<void> {
    const db = await this.getDb();
    const all = await db.getAll<InventarioDomain>(this.STORE);
    const item = all.find(i => i.jogador === email && i.item_catalogo === catalogoId);

    if (!item) {
      console.warn(`[InventarioRepository] Item ${catalogoId} não encontrado para ${email}`);
      return;
    }

    item.quantidade = Math.max(0, (item.quantidade || 0) - quantidade);

    await db.put(this.STORE, item);

    await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: item.index!,
      attrs: item,
    });

    console.log(`[InventarioRepository] Subtraído ${quantidade} do item ${catalogoId}. Nova qtd: ${item.quantidade}`);
  }

  // =========================================================
  // 📌 Adicionar ou incrementar quantidade
  // =========================================================
  static async adicionarOuIncrementar(email: string, catalogoId: number, quantidade: number): Promise<void> {
    const db = await this.getDb();
    const all = await db.getAll<InventarioDomain>(this.STORE);
    let item = all.find(i => i.jogador === email && i.item_catalogo === catalogoId);

    if (!item) {
      // Criar novo registro
      item = {
        id: Date.now(),
        index: undefined,
        jogador: email,
        item_catalogo: catalogoId,
        quantidade,
      } as InventarioDomain;

      await this.createInventario(item);
      console.log(`[InventarioRepository] Item ${catalogoId} criado com quantidade ${quantidade}`);
      return;
    }

    // Incrementar
    item.quantidade = (item.quantidade || 0) + quantidade;

    await db.put(this.STORE, item);

    await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: item.index!,
      attrs: item,
    });

    console.log(`[InventarioRepository] Item ${catalogoId} incrementado em ${quantidade}. Nova qtd: ${item.quantidade}`);
  }

  // =========================================================
  // 📌 Deletar inventário
  // =========================================================
  static async deleteInventario(id: number): Promise<boolean> {
    console.log('[InventarioRepository] Deletando inventário...', id);

    const db = await this.getDb();
    const item = await db.get<InventarioDomain>(this.STORE, id);

    if (!item) {
      console.warn('[InventarioRepository] Item não encontrado no cache:', id);
      return false;
    }

    await ScriptClient.controllerDeleteByIndex({
      tab: this.TAB,
      index: item.index!,
    });

    await db.delete(this.STORE, id);

    console.log('[InventarioRepository] Registro excluído do cache/local:', id);
    return true;
  }

  // =========================================================
  // 📌 Buscar inventário (online/local)
  // =========================================================
  static async getAllInventario(): Promise<InventarioDomain[]> {
    console.log('[InventarioRepository] getAllInventario...');
    const onlineList = await ScriptClient.controllerGetAll<InventarioDomain>({ tab: this.TAB });

    return Array.isArray(onlineList)
      ? onlineList.map(i => ({
          ...i,
          id: Number(i.id),
          index: i.index,
        }))
      : [];
  }

  static async getLocalInventarioByJogador(email: string): Promise<InventarioDomain[]> {
    const db = await this.getDb();
    const allLocal = await db.getAll<InventarioDomain>(this.STORE);
    return allLocal.filter(i => i.jogador === email);
  }

  // =========================================================
  // 📌 Forçar fetch e sincronizar
  // =========================================================
  static async forceFetchInventario(): Promise<InventarioDomain[]> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    console.log('[InventarioRepository] Baixando lista online...');
    const onlineList = await this.getAllInventario();

    if (!onlineList.length) {
      console.warn('[InventarioRepository] Nenhum inventário encontrado online.');
      return [];
    }

    const inventarioComId = onlineList.map(i => ({
      ...i,
      id: Number(i.id),
      index: i.index,
    }));

    const db = await this.getDb();
    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, inventarioComId);

    console.log('[InventarioRepository] Cache atualizado com lista online.');

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
      }
    }

    return inventarioComId.filter(i => i.jogador === user.email);
  }

  static async syncInventario(): Promise<boolean> {
    console.log('[InventarioRepository] Verificando necessidade de sincronização...');
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
      await this.forceFetchInventario();
      return true;
    }

    return false;
  }
}

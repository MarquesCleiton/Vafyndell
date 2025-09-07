import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { NpcDomain } from '../domain/NpcDomain';

export class NpcRepository {
  private static TAB = 'Npcs';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  // Pasta compartilhada para imagens (opcional)
  private static FOLDER_ID = '1zId11Ydti8d0FOQoQjd9lQmPo6GiJx26';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[NpcRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Criar NPC
  // =========================================================
  static async createNpc(novo: NpcDomain): Promise<NpcDomain> {
    console.log('[NpcRepository] Criando novo NPC...', novo);

    const created = await ScriptClient.controllerCreate({
      tab: this.TAB,
      attrs: novo,
      folderId: this.FOLDER_ID,
    });

    const npcFinal: NpcDomain = {
      ...created,
      id: created?.index || Date.now(),
    };

    const db = await this.getDb();
    await db.put(this.STORE, npcFinal);

    console.log('[NpcRepository] NPC criado e salvo no cache:', npcFinal);
    return npcFinal;
  }

  // =========================================================
  // 📌 Atualizar NPC
  // =========================================================
  static async updateNpc(npc: NpcDomain): Promise<NpcDomain> {
    console.log('[NpcRepository] Atualizando NPC...', npc);

    const updated = await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: npc.index,
      attrs: npc,
      folderId: this.FOLDER_ID,
    });

    const npcFinal: NpcDomain = {
      ...npc,
      ...updated,
    };

    const db = await this.getDb();
    await db.put(this.STORE, npcFinal);

    console.log('[NpcRepository] NPC atualizado no cache local:', npcFinal);
    return npcFinal;
  }

  // =========================================================
  // 📌 Deletar NPC
  // =========================================================
  static async deleteNpc(id: number): Promise<boolean> {
    console.log('[NpcRepository] Deletando NPC...', id);

    await ScriptClient.controllerDeleteByIndex({
      tab: this.TAB,
      index: id,
    });

    const db = await this.getDb();
    await db.delete(this.STORE, id);

    console.log('[NpcRepository] NPC excluído do cache/local:', id);
    return true;
  }

  // =========================================================
  // 📌 Buscar todos (online)
  // =========================================================
  static async getAllNpcs(): Promise<NpcDomain[]> {
    console.log('[NpcRepository] getAllNpcs...');
    const onlineList = await ScriptClient.controllerGetAll<NpcDomain>({ tab: this.TAB });
    return Array.isArray(onlineList) ? onlineList : [];
  }

  // =========================================================
  // 📌 Buscar local
  // =========================================================
  static async getLocalNpcs(): Promise<NpcDomain[]> {
    const db = await this.getDb();
    const allLocal = await db.getAll<NpcDomain>(this.STORE);
    console.log('[NpcRepository] getLocalNpcs → total encontrados:', allLocal.length);
    return allLocal;
  }

  // =========================================================
  // 📌 Força buscar online (atualiza cache e metadados)
  // =========================================================
  static async forceFetchNpcs(): Promise<NpcDomain[]> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    console.log('[NpcRepository] Baixando lista online...');
    const onlineList = await this.getAllNpcs();

    if (!onlineList.length) {
      console.warn('[NpcRepository] Nenhum NPC encontrado online.');
      return [];
    }

    const npcsComId = onlineList.map(n => ({
      ...n,
      id: n.index ?? n.id,
    }));

    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, npcsComId);
    console.log('[NpcRepository] Cache atualizado com lista online.');

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
        console.log('[NpcRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return npcsComId;
  }

  // =========================================================
  // 📌 Sincronizar
  // =========================================================
  static async syncNpcs(): Promise<boolean> {
    console.log('[NpcRepository] Verificando necessidade de sincronização...');
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (!Array.isArray(onlineMetaList)) return false;

    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) {
      console.warn('[NpcRepository] Nenhum metadado online encontrado.');
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[NpcRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchNpcs();
      return true;
    }

    console.log('[NpcRepository] Cache já está atualizado.');
    return false;
  }
}

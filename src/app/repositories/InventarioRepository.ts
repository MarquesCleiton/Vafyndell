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
            id: created?.index || Date.now(),
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
            index: item.id,
            attrs: item,
        });

        const inventarioFinal: InventarioDomain = {
            ...item,
            ...updated,
        };

        const db = await this.getDb();
        await db.put(this.STORE, inventarioFinal);

        console.log('[InventarioRepository] Inventário atualizado no cache local:', inventarioFinal);
        return inventarioFinal;
    }

    // =========================================================
    // 📌 Deletar inventário
    // =========================================================
    static async deleteInventario(id: number): Promise<boolean> {
        console.log('[InventarioRepository] Deletando inventário...', id);

        await ScriptClient.controllerDeleteByIndex({
            tab: this.TAB,
            index: id,
        });

        const db = await this.getDb();
        await db.delete(this.STORE, id);

        console.log('[InventarioRepository] Registro excluído do cache/local:', id);
        return true;
    }

    // =========================================================
    // 📌 Buscar todos (online)
    // =========================================================
    static async getAllInventario(): Promise<InventarioDomain[]> {
        console.log('[InventarioRepository] getAllInventario...');
        const onlineList = await ScriptClient.controllerGetAll<InventarioDomain>({ tab: this.TAB });
        return Array.isArray(onlineList) ? onlineList : [];
    }

    // =========================================================
    // 📌 Buscar inventário de um jogador (local)
    // =========================================================
    static async getLocalInventarioByJogador(email: string): Promise<InventarioDomain[]> {
        const db = await this.getDb();
        const allLocal = await db.getAll<InventarioDomain>(this.STORE);

        console.log('[InventarioRepository] getLocalInventarioByJogador → total encontrados:', allLocal.length);
        return allLocal.filter(i => i.jogador === email);
    }

    // =========================================================
    // 📌 Força buscar online (atualiza cache e metadados)
    // =========================================================
    static async forceFetchInventario(): Promise<InventarioDomain[]> {
        const user = AuthService.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        console.log('[InventarioRepository] Baixando lista online...');
        const onlineList = await this.getAllInventario();

        // 🔑 garante que o campo id sempre existe
        const inventarioComId = onlineList.map(i => ({
            ...i,
            id: i.index ?? i.id, // usa index se vier do Script, senão mantém id
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
                console.log('[InventarioRepository] Metadados locais atualizados:', onlineMeta);
            }
        }

        return inventarioComId.filter(i => i.jogador === user.email);
    }


    // =========================================================
    // 📌 Sincronizar
    // =========================================================
    static async syncInventario(): Promise<boolean> {
        console.log('[InventarioRepository] Verificando necessidade de sincronização...');
        const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
            tab: 'Metadados',
        });

        if (!Array.isArray(onlineMetaList)) return false;

        const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
        if (!onlineMeta) {
            console.warn('[InventarioRepository] Nenhum metadado online encontrado.');
            return false;
        }

        const db = await this.getDb();
        const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

        const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

        if (precisaAtualizar) {
            console.log('[InventarioRepository] Cache desatualizado → sincronizando...');
            await this.forceFetchInventario();
            return true;
        }

        console.log('[InventarioRepository] Cache já está atualizado.');
        return false;
    }
}

import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { AnotacaoDomain } from '../domain/AnotacaoDomain';

export class AnotacaoRepository {
    private static TAB = 'Anotacoes';
    private static STORE = this.TAB;
    private static META_STORE = 'metadados';

    private static FOLDER_ID = 'PASTA_ID_DRIVE_ANOTACOES';

    private static dbPromise: Promise<IndexedDBClient> | null = null;

    private static async getDb(): Promise<IndexedDBClient> {
        if (!this.dbPromise) {
            console.log('[AnotacaoRepository] Criando instância IndexedDBClient...');
            this.dbPromise = IndexedDBClient.create();
        }
        return this.dbPromise;
    }

    // =========================================================
    // 📌 Criar anotação
    // =========================================================
    static async createAnotacao(nova: AnotacaoDomain): Promise<AnotacaoDomain> {
        // 🔄 força salvar data/hora ISO
        if (!nova.data) {
            nova.data = new Date().toISOString();
        }

        const created = await ScriptClient.controllerCreate({
            tab: this.TAB,
            attrs: nova,
            folderId: this.FOLDER_ID,
        });

        const anotacaoFinal: AnotacaoDomain = {
            ...created,
            id: created?.index || Date.now(),
        };

        const db = await this.getDb();
        await db.put(this.STORE, anotacaoFinal);

        return anotacaoFinal;
    }


    // =========================================================
    // 📌 Atualizar anotação
    // =========================================================
    static async updateAnotacao(anotacao: AnotacaoDomain): Promise<AnotacaoDomain> {
        // 🔄 garante que está em ISO (data completa)
        if (!anotacao.data || !anotacao.data.includes('T')) {
            anotacao.data = new Date().toISOString();
        }

        const updated = await ScriptClient.controllerUpdateByIndex({
            tab: this.TAB,
            index: anotacao.index,
            attrs: anotacao,
            folderId: this.FOLDER_ID,
        });

        const anotacaoFinal: AnotacaoDomain = {
            ...anotacao,
            ...updated,
        };

        const db = await this.getDb();
        await db.put(this.STORE, anotacaoFinal);

        return anotacaoFinal;
    }


    // =========================================================
    // 📌 Buscar todas online
    // =========================================================
    static async getAllAnotacoes(): Promise<AnotacaoDomain[]> {
        const onlineList = await ScriptClient.controllerGetAll<AnotacaoDomain>({ tab: this.TAB });
        return Array.isArray(onlineList) ? onlineList : [];
    }

    // =========================================================
    // 📌 Buscar locais do jogador autenticado
    // =========================================================
    static async getLocalAnotacoes(): Promise<AnotacaoDomain[]> {
        const user = AuthService.getUser();
        if (!user) {
            console.warn('[AnotacaoRepository] Usuário não autenticado → retornando []');
            return [];
        }

        const db = await this.getDb();
        const todas = await db.getAll<AnotacaoDomain>(this.STORE);

        return todas.filter(a => a.jogador === user.email);
    }


    // =========================================================
    // 📌 Força buscar online e atualizar cache
    // =========================================================
    static async forceFetchAnotacoes(): Promise<AnotacaoDomain[]> {
        const user = AuthService.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        const onlineList = await this.getAllAnotacoes();
        if (!onlineList.length) return [];

        const anotacoesComId = onlineList.map(a => ({ ...a, id: a.index }));
        const db = await this.getDb();

        await db.clear(this.STORE);
        await db.bulkPut(this.STORE, anotacoesComId);

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
            }
        }

        return anotacoesComId.filter(a => a.jogador === user.email);
    }

    // =========================================================
    // 📌 Sincronizar (compara metadados)
    // =========================================================
    static async syncAnotacoes(): Promise<boolean> {
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
            await this.forceFetchAnotacoes();
            return true;
        }

        return false;
    }

    // =========================================================
    // 📌 Buscar anotacoes atuais (local + valida online em paralelo)
    // =========================================================
    static async getCurrentAnotacoes(): Promise<AnotacaoDomain[]> {
        const user = AuthService.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        // 1. Local primeiro
        let locais = await this.getLocalAnotacoes();
        if (locais.length > 0) {
            // 2. Valida em paralelo
            this.syncAnotacoes()
                .then(async updated => {
                    if (updated) {
                        locais = await this.getLocalAnotacoes();
                    }
                })
                .catch(err => console.error('[AnotacaoRepository] Erro ao sincronizar:', err));

            return locais;
        }

        // 3. Se não tinha local → força online
        return await this.forceFetchAnotacoes();
    }

    // =========================================================
    // 📌 Excluir anotação
    // =========================================================
    static async deleteAnotacao(id: number): Promise<boolean> {
        await ScriptClient.controllerDeleteByIndex({
            tab: this.TAB,
            index: id,
        });

        const db = await this.getDb();
        await db.delete(this.STORE, id);

        return true;
    }
}

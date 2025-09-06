import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { JogadorDomain } from '../domain/jogadorDomain';

// Tipagem mínima do Metadados
interface Metadata {
    SheetName: string;
    UltimaModificacao: string;
}


export class JogadorRepository {
    private static TAB = 'Personagem';
    private static META_TAB = 'Metadados';

    /**
     * Retorna o jogador logado (cache primeiro, depois valida online).
     */
    static async getCurrentJogador(): Promise<JogadorDomain | null> {
        const user = AuthService.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        const email = user.email;

        // 1. Buscar jogadores no cache local
        let localPlayers = await IndexedDBClient.getAll<JogadorDomain>(this.TAB);
        let jogadorAtual = localPlayers.find((j) => j.email === email) || null;

        // 2. Se encontrou no cache → retorna imediatamente (UX rápido)
        if (jogadorAtual) {
            this.validateAndSync(); // sync em paralelo
            return jogadorAtual;
        }

        // 3. Se não encontrou → força sync com online
        await this.syncFromOnline();
        localPlayers = await IndexedDBClient.getAll<JogadorDomain>(this.TAB);
        jogadorAtual = localPlayers.find((j) => j.email === email) || null;

        // 4. Agora sim decide se existe ou não
        return jogadorAtual;
    }


    /**
     * Valida cache comparando Metadados local x online
     */
    private static async validateAndSync(): Promise<void> {
        try {
            const localMeta = await IndexedDBClient.get<Metadata>(this.META_TAB, this.TAB);

            const onlineMetaList = await ScriptClient.controllerGetAll<Metadata>({ tab: this.META_TAB });
            const onlineMeta = onlineMetaList.find((m) => m.SheetName === this.TAB);

            const localTs = localMeta?.UltimaModificacao;
            const onlineTs = onlineMeta?.UltimaModificacao;

            if (!localTs || localTs !== onlineTs) {
                await this.syncFromOnline();
            }
        } catch (err) {
            console.error('Erro na validação de sync de jogadores:', err);
        }
    }

    /**
     * Baixa jogadores do Script e atualiza cache + metadados
     */
    private static async syncFromOnline(): Promise<void> {
        try {
            // 1. Buscar jogadores online
            const onlinePlayers = await ScriptClient.controllerGetAll<JogadorDomain>({ tab: this.TAB });

            // 2. Atualizar cache local
            await IndexedDBClient.clear(this.TAB);
            await IndexedDBClient.bulkPut(this.TAB, onlinePlayers);

            // 3. Atualizar metadados local
            const onlineMetaList = await ScriptClient.controllerGetAll<Metadata>({ tab: this.META_TAB });
            const onlineMeta = onlineMetaList.find((m) => m.SheetName === this.TAB);
            if (onlineMeta) {
                await IndexedDBClient.put(this.META_TAB, {
                    name: this.TAB, // keyPath da store Metadados deve ser 'name'
                    UltimaModificacao: onlineMeta.UltimaModificacao,
                });
            }
        } catch (err) {
            console.error('Erro ao sincronizar jogadores online:', err);
        }
    }
}

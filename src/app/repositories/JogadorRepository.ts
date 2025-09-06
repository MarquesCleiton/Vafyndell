import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { JogadorDomain } from '../domain/jogadorDomain';

export class JogadorRepository {
  private static TAB = 'Personagem';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  // 🔑 Singleton da instância do IndexedDB
  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[JogadorRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  /**
   * Busca jogador local (se existir)
   */
  static async getLocalJogador(): Promise<JogadorDomain | null> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const db = await this.getDb();
    const allLocal = await db.getAll<JogadorDomain>(this.STORE);

    console.log('[JogadorRepository] getLocalJogador → total encontrados:', allLocal.length);
    return allLocal.find(j => j.email === user.email) || null;
  }

  /**
   * Força buscar jogador online e atualizar cache/metadados
   */
  static async forceFetchJogador(): Promise<JogadorDomain | null> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    console.log('[JogadorRepository] Baixando lista online...');

    const onlineList = await ScriptClient.controllerGetAll<JogadorDomain>({ tab: this.TAB });
    if (!onlineList.length) {
      console.warn('[JogadorRepository] Nenhum jogador encontrado online.');
      return null;
    }

    // 🔑 Sempre garantir id = index
    const jogadoresComId = onlineList.map(j => ({ ...j, id: j.index }));

    const db = await this.getDb();

    // ♻️ Atualiza cache local
    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, jogadoresComId);
    console.log('[JogadorRepository] Cache atualizado com lista online.');

    // 💾 Atualiza metadados locais
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });
    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (onlineMeta) {
      await db.put(this.META_STORE, {
        id: this.TAB,
        UltimaModificacao: onlineMeta.UltimaModificacao,
      });
      console.log('[JogadorRepository] Metadados locais atualizados:', onlineMeta);
    }

    return jogadoresComId.find(j => j.email === user.email) || null;
  }

  /**
   * Sincroniza cache com dados online caso metadados indiquem atualização
   * Retorna true se houve atualização
   */
  static async syncJogadores(): Promise<boolean> {
    console.log('[JogadorRepository] Verificando necessidade de sincronização...');

    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });
    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) {
      console.warn('[JogadorRepository] Nenhum metadado online encontrado.');
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(
      this.META_STORE,
      this.TAB
    );

    const precisaAtualizar =
      !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[JogadorRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchJogador();
      return true;
    } else {
      console.log('[JogadorRepository] Cache já está atualizado.');
      return false;
    }
  }

  /**
   * Recupera jogador priorizando cache local, mas sempre validando online em paralelo
   */
  static async getCurrentJogador(): Promise<JogadorDomain | null> {
    console.log('[JogadorRepository] getCurrentJogador iniciado.');

    const user = AuthService.getUser();
    if (!user) {
      console.error('[JogadorRepository] Usuário não autenticado.');
      throw new Error('Usuário não autenticado.');
    }

    // 1. Primeiro tenta local
    let jogadorLocal = await this.getLocalJogador();
    if (jogadorLocal) {
      console.log('[JogadorRepository] Retornando jogador local:', jogadorLocal);

      // 2. Em paralelo valida atualização
      this.syncJogadores()
        .then(async updated => {
          if (updated) {
            console.log('[JogadorRepository] Cache atualizado → recarregando jogador.');
            jogadorLocal = await this.getLocalJogador();
          }
        })
        .catch(err => {
          console.error('[JogadorRepository] Erro ao sincronizar em paralelo:', err);
        });

      return jogadorLocal;
    }

    // 3. Se não tem local → força buscar online
    console.log('[JogadorRepository] Nenhum jogador local → buscando online...');
    return await this.forceFetchJogador();
  }
}

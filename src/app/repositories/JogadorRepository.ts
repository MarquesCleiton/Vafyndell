import { AuthService } from '../core/auth/AuthService';
import { IndexedDBClient } from '../core/db/IndexedDBClient';
import { ScriptClient } from '../core/script/ScriptClient';
import { JogadorDomain } from '../domain/jogadorDomain';

export class JogadorRepository {
  private static TAB = 'Personagem';
  private static STORE = this.TAB;
  private static META_STORE = 'metadados';

  // 👇 ID da pasta compartilhada no Drive onde as imagens ficarão salvas
  private static FOLDER_ID = '1zId11Ydti8d0FOQoQjd9lQmPo6GiJx26';

  private static dbPromise: Promise<IndexedDBClient> | null = null;

  private static async getDb(): Promise<IndexedDBClient> {
    if (!this.dbPromise) {
      console.log('[JogadorRepository] Criando instância IndexedDBClient...');
      this.dbPromise = IndexedDBClient.create();
    }
    return this.dbPromise;
  }

  // =========================================================
  // 📌 Criar jogador
  // =========================================================
  static async createJogador(novo: JogadorDomain): Promise<JogadorDomain> {
    console.log('[JogadorRepository] Criando novo jogador...', novo);

    const created = await ScriptClient.controllerCreate({
      tab: this.TAB,
      attrs: novo,
      folderId: this.FOLDER_ID,
    });

    const jogadorFinal: JogadorDomain = {
      ...created,
      id: created?.index || Date.now(),
    };

    const db = await this.getDb();
    await db.put(this.STORE, jogadorFinal);

    console.log('[JogadorRepository] Jogador criado e salvo no cache:', jogadorFinal);
    return jogadorFinal;
  }

  // =========================================================
  // 📌 Atualizar jogador
  // =========================================================
  static async updateJogador(jogador: JogadorDomain): Promise<JogadorDomain> {
    console.log('[JogadorRepository] Atualizando jogador...', jogador);

    const updated = await ScriptClient.controllerUpdateByIndex({
      tab: this.TAB,
      index: jogador.index,
      attrs: jogador,
      folderId: this.FOLDER_ID,
    });

    const jogadorFinal: JogadorDomain = {
      ...jogador,
      ...updated,
    };

    const db = await this.getDb();
    await db.put(this.STORE, jogadorFinal);

    console.log('[JogadorRepository] Jogador atualizado no cache local:', jogadorFinal);
    return jogadorFinal;
  }

  // =========================================================
  // 📌 Buscar todos (online)
  // =========================================================
  static async getAllJogadores(): Promise<JogadorDomain[]> {
    console.log('[JogadorRepository] getAllJogadores...');
    const onlineList = await ScriptClient.controllerGetAll<JogadorDomain>({ tab: this.TAB });
    return Array.isArray(onlineList) ? onlineList : [];
  }

  // =========================================================
  // 📌 Buscar local
  // =========================================================
  static async getLocalJogador(): Promise<JogadorDomain | null> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    const db = await this.getDb();
    const allLocal = await db.getAll<JogadorDomain>(this.STORE);

    console.log('[JogadorRepository] getLocalJogador → total encontrados:', allLocal.length);
    return allLocal.find(j => j.email === user.email) || null;
  }

  // =========================================================
  // 📌 Força buscar online (atualiza cache e metadados)
  // =========================================================
  static async forceFetchJogador(): Promise<JogadorDomain | null> {
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    console.log('[JogadorRepository] Baixando lista online...');
    const onlineList = await this.getAllJogadores();

    if (!onlineList.length) {
      console.warn('[JogadorRepository] Nenhum jogador encontrado online.');
      return null;
    }

    const jogadoresComId = onlineList.map(j => ({ ...j, id: j.index }));
    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, jogadoresComId);
    console.log('[JogadorRepository] Cache atualizado com lista online.');

    // 🔄 Atualiza metadados somente aqui
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
        console.log('[JogadorRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return jogadoresComId.find(j => j.email === user.email) || null;
  }

  // =========================================================
  // 📌 Buscar todos os jogadores (local IndexedDB)
  // =========================================================
  static async getLocalJogadores(): Promise<JogadorDomain[]> {
    const db = await this.getDb();
    const allLocal = await db.getAll<JogadorDomain>(this.STORE);
    console.log('[JogadorRepository] getLocalJogadores → total encontrados:', allLocal.length);
    return allLocal;
  }


  // =========================================================
  // 📌 Sincronizar
  // =========================================================
  static async syncJogadores(): Promise<boolean> {
    console.log('[JogadorRepository] Verificando necessidade de sincronização...');
    const onlineMetaList = await ScriptClient.controllerGetAll<{ SheetName: string; UltimaModificacao: string }>({
      tab: 'Metadados',
    });

    if (!Array.isArray(onlineMetaList)) return false;

    const onlineMeta = onlineMetaList.find(m => m.SheetName === this.TAB);
    if (!onlineMeta) {
      console.warn('[JogadorRepository] Nenhum metadado online encontrado.');
      return false;
    }

    const db = await this.getDb();
    const localMeta = await db.get<{ id: string; UltimaModificacao: string }>(this.META_STORE, this.TAB);

    const precisaAtualizar = !localMeta || localMeta.UltimaModificacao !== onlineMeta.UltimaModificacao;

    if (precisaAtualizar) {
      console.log('[JogadorRepository] Cache desatualizado → sincronizando...');
      await this.forceFetchJogador();
      return true;
    }

    console.log('[JogadorRepository] Cache já está atualizado.');
    return false;
  }

  // =========================================================
  // 📌 Recupera jogador atual (refatorado para consistência)
  // =========================================================
  static async getCurrentJogador(): Promise<JogadorDomain | null> {
    console.log('[JogadorRepository] getCurrentJogador iniciado.');
    const user = AuthService.getUser();
    if (!user) throw new Error('Usuário não autenticado.');

    // Primeiro tenta local
    let jogadorLocal = await this.getLocalJogador();
    if (jogadorLocal) {
      console.log('[JogadorRepository] Jogador local encontrado.');
      // dispara sync em paralelo, mas retorna já o jogador local
      this.syncJogadores().then(async updated => {
        if (updated) {
          console.log('[JogadorRepository] Jogador atualizado após sync.');
          jogadorLocal = await this.getLocalJogador();
        }
      }).catch(err => console.error('[JogadorRepository] Erro ao sincronizar:', err));

      return jogadorLocal;
    }

    // Se não tem local, força fetch online
    return await this.forceFetchJogador();
  }



  // =========================================================
  // 📌 Excluir jogador
  // =========================================================
  static async deleteJogador(id: number): Promise<boolean> {
    console.log('[JogadorRepository] Excluindo jogador...', id);

    await ScriptClient.controllerDeleteByIndex({
      tab: this.TAB,
      index: id,
    });

    const db = await this.getDb();
    await db.delete(this.STORE, id);

    console.log('[JogadorRepository] Jogador excluído do cache/local:', id);
    return true;
  }

  // =========================================================
  // 📌 Força buscar todos online (atualiza cache e metadados)
  // =========================================================
  static async forceFetchJogadores(): Promise<JogadorDomain[]> {
    console.log('[JogadorRepository] Baixando lista online (todos jogadores)...');
    const onlineList = await this.getAllJogadores();

    if (!onlineList.length) {
      console.warn('[JogadorRepository] Nenhum jogador encontrado online.');
      return [];
    }

    const jogadoresComId = onlineList.map(j => ({ ...j, id: j.index }));
    const db = await this.getDb();

    await db.clear(this.STORE);
    await db.bulkPut(this.STORE, jogadoresComId);
    console.log('[JogadorRepository] Cache atualizado com lista online (todos jogadores).');

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
        console.log('[JogadorRepository] Metadados locais atualizados:', onlineMeta);
      }
    }

    return jogadoresComId;
  }


}

import { AuthService } from '../auth/AuthService';

export class ScriptClientV4 {
  private static BASE_URL =
    'https://script.google.com/macros/s/AKfycbzWPwJz714gSuRPPPjSJJ2P_WE-QrWDPJkWm0FCDhTCAyp0_g6URBGnPABsuFSrdnBhUw/exec';

  // Map para coalescer requisições idênticas em andamento
  private static inFlightRequests = new Map<string, Promise<any>>();

  // Cache para consultas leves (ex: Metadados)
  private static cache = new Map<string, { data: any; expiry: number }>();
  private static CACHE_TTL_MS = 10 * 1000; // 10 segundos

  static clearCache() {
    this.cache.clear();
    console.log('[ScriptClientV4] 🧹 Cache limpo');
  }

  /** Método interno genérico */
  private static async call<T>(bodyPayload: any, retry = true): Promise<T> {
    const cacheKey = JSON.stringify(bodyPayload);

    if (retry && this.inFlightRequests.has(cacheKey)) {
      console.log(`[ScriptClientV4] 🔄 Reutilizando requisição em andamento para a chave:`, cacheKey);
      return this.inFlightRequests.get(cacheKey) as Promise<T>;
    }

    const promise = (async () => {
      let idToken = AuthService.getIdToken();

      if (!idToken || !AuthService.isAuthenticated()) {
        const user = await AuthService.refreshIdToken();
        if (!user) throw new Error('Usuário precisa fazer login novamente.');
        idToken = user.idToken;
      }

      const body = {
        idToken,
        // SHEET_ID e FOLDER_ID são omitidos pois o backend V4 já os possui fixados
        ...bodyPayload,
      };

      console.log(`➡️ [ScriptClientV4] Enviando →`, body);

      const res = await fetch(this.BASE_URL, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error(`❌ [ScriptClientV4] Erro bruto do Script:`, text);
        if (res.status === 401 && retry) {
          console.warn(`[ScriptClientV4] Token inválido, tentando renovar...`);
          const user = await AuthService.refreshIdToken();
          if (!user) throw new Error('Usuário precisa se autenticar novamente.');
          return this.call<T>(bodyPayload, false);
        }
        throw new Error(`[ScriptClientV4] HTTP ${res.status} - ${res.statusText}\n${text}`);
      }

      try {
        const parsed = JSON.parse(text) as T;
        console.log(`⬅️ [ScriptClientV4] Resposta →`, parsed);
        return parsed;
      } catch (err) {
        console.error(`❌ [ScriptClientV4] Resposta não-JSON:`, text);
        throw err;
      }
    })();

    if (retry) {
      this.inFlightRequests.set(cacheKey, promise);
    }

    try {
      return await promise;
    } finally {
      if (retry) {
        this.inFlightRequests.delete(cacheKey);
      }
    }
  }

  // ========================
  // OPERAÇÕES EM LOTE POR ID
  // ========================

  /** Operações em lote (create/update/delete de múltiplas abas em 1 chamada) */
  static async batch<T = any>(payloads: {
    create?: Record<string, any[]>;
    updateById?: Record<string, any[]>;
    deleteById?: Record<string, { id: string }[]>;
  }) {
    const res = await this.call<any>({ payloads });
    return res || {};
  }

  /** Criação em lote (não duplica IDs já existentes) */
  static create<T = any>(payloads: Record<string, any[]>) {
    return this.call<T>({ payloads: { create: payloads } });
  }

  /** Atualização em lote por ID */
  static updateById<T = any>(payloads: Record<string, any[]>) {
    return this.call<T>({ payloads: { updateById: payloads } });
  }

  /** Exclusão em lote por ID */
  static deleteById<T = any>(payloads: Record<string, { id: string }[]>) {
    return this.call<T>({ payloads: { deleteById: payloads } });
  }

  // ========================
  // CONSULTAS E SINCRONIA
  // ========================

  /** Sincronização inteligente com PropertiesService (V4) */
  static async sync(tabs: Record<string, { versao?: number; UltimaModificacao?: string }>) {
    return this.call<any>({ payloads: { sync: tabs } });
  }

  /** Retorna todos os registros de uma aba ou várias abas (Fallback/Legacy) */
  static async getAll<T = any>(tabs: string[] | string) {
    const isMetadadosOnly = tabs === 'Metadados' || (Array.isArray(tabs) && tabs.length === 1 && tabs[0] === 'Metadados');

    if (isMetadadosOnly) {
      const cached = this.cache.get('Metadados');
      if (cached && cached.expiry > Date.now()) {
        console.log('[ScriptClientV4] ⚡ Retornando Metadados do cache em memória (TTL active)');
        return cached.data;
      }
    }

    const res = await this.call<any>({ payloads: { getAll: Array.isArray(tabs) ? tabs : [tabs] } });
    const unwrapped = res?.getAll || {};

    if (isMetadadosOnly) {
      this.cache.set('Metadados', {
        data: unwrapped,
        expiry: Date.now() + this.CACHE_TTL_MS
      });
      console.log('[ScriptClientV4] 📝 Metadados salvos no cache');
    }

    return unwrapped;
  }

  /** Busca registros específicos por ID */
  static async getById<T = any>(payloads: Record<string, { id: string }[]>) {
    const res = await this.call<any>({ payloads: { getById: payloads } });
    return res?.getById || {}; // 🔑 unwrap
  }

  // ========================
  // HELPERS
  // ========================

  /** Normaliza a resposta de uma aba específica */
  static normalizeResponse<T>(result: any, tab: string): T[] {
    return (result?.[tab] || []).map((r: any) => ({
      ...r,
      id: String(r.id),
      index: r.index,
    }));
  }
}

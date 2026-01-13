import { AuthService } from '../auth/AuthService';

export class ScriptClientV3 {
  private static BASE_URL =
    'https://script.google.com/macros/s/AKfycbyF7zPufz4P_6gDpxIo5_MJ8_B_bhFV3L6yQh6jXNfIlnuSHjaQHr37gpsi97-OWy1vTA/exec';

  private static SHEET_ID = '1r3l3yg2jK5ZvamDxtSfkXprU6Ap8YWkAzmR_wY9rqr8';
  private static FOLDER_ID = '1lo6Xwydu1-GZAh-kRkgCnDqseCFno3ty';

  /** Método interno genérico */
  private static async call<T>(bodyPayload: any, retry = true): Promise<T> {
    let idToken = AuthService.getIdToken();

    if (!idToken || !AuthService.isAuthenticated()) {
      const user = await AuthService.refreshIdToken();
      if (!user) throw new Error('Usuário precisa fazer login novamente.');
      idToken = user.idToken;
    }

    const body = {
      idToken,
      sheetId: this.SHEET_ID,
      folderId: this.FOLDER_ID,
      ...bodyPayload,
    };

    console.log(`➡️ [ScriptClientV3] Enviando →`, body);

    const res = await fetch(this.BASE_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error(`❌ [ScriptClientV3] Erro bruto do Script:`, text);
      if (res.status === 401 && retry) {
        console.warn(`[ScriptClientV3] Token inválido, tentando renovar...`);
        const user = await AuthService.refreshIdToken();
        if (!user) throw new Error('Usuário precisa se autenticar novamente.');
        return this.call<T>(bodyPayload, false);
      }
      throw new Error(`[ScriptClientV3] HTTP ${res.status} - ${res.statusText}\n${text}`);
    }

    try {
      const parsed = JSON.parse(text) as T;
      console.log(`⬅️ [ScriptClientV3] Resposta →`, parsed);
      return parsed;
    } catch (err) {
      console.error(`❌ [ScriptClientV3] Resposta não-JSON:`, text);
      throw err;
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
  // CONSULTAS
  // ========================

  /** Retorna todos os registros de uma aba ou várias abas */
  static async getAll<T = any>(tabs: string[] | string) {
    const res = await this.call<any>({ payloads: { getAll: Array.isArray(tabs) ? tabs : [tabs] } });
    return res?.getAll || {}; // 🔑 unwrap
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

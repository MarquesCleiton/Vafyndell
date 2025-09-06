import { AuthService } from '../auth/AuthService';

export class ScriptClient {
  // alterna automaticamente entre dev (proxy) e prod (endpoint real)
  private static ENDPOINT ='https://script.google.com/macros/s/AKfycby-ec_h6sljntLAgoWhpeyBFGTkWygqS7Xx1Yvkx8RKDKiXDHPxtHZ8hhh6vrN91JEL/exec';

  private static SHEET_ID =
    '19B2aMGrajvhPJfOvYXt059-fECytaN38iFsP8GInD_g';

  /** Método interno genérico */
  private static async call<T>(action: string, payload: any): Promise<T> {
    const idToken = AuthService.getIdToken();
    if (!idToken) throw new Error('Usuário não autenticado.');

    // injeta sempre o sheetId fixo
    const body = {
      idToken,
      action,
      payload: {
        ...payload,
        sheetId: this.SHEET_ID,
      },
    };

    console.log('➡️ Enviando para Script:', this.ENDPOINT, body);

    const res = await fetch(this.ENDPOINT, {
      method: 'POST',
      //headers: { 'text/plain': 'charset=UTF-8' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('❌ Erro bruto do Script:', text);
      throw new Error(`Erro no Script: ${res.status} - ${res.statusText}\n${text}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      console.error('❌ Resposta não-JSON:', text);
      throw err;
    }
  }

  // ========================
  // SHEET CLIENT
  // ========================
  static createRow<T = any>(payload: { tab: string; attrs: Record<string, any> }): Promise<T> {
    return this.call<T>('sheet.createRow', payload);
  }

  static getAll<T = any>(payload: { tab: string }): Promise<T[]> {
    return this.call<T[]>('sheet.getAll', payload);
  }

  static getByIndex<T = any>(payload: { tab: string; index: number }): Promise<T> {
    return this.call<T>('sheet.getByIndex', payload);
  }

  static getCell<T = any>(payload: { tab: string; cell?: string; a1?: string }): Promise<T> {
    return this.call<T>('sheet.getCell', payload);
  }

  static updateByIndex<T = any>(payload: { tab: string; index: number; attrs: Record<string, any> }): Promise<T> {
    return this.call<T>('sheet.updateByIndex', payload);
  }

  static updateCell<T = any>(payload: { tab: string; cell?: string; a1?: string; value: any }): Promise<T> {
    return this.call<T>('sheet.updateCell', payload);
  }

  static deleteByIndex<T = any>(payload: { tab: string; index: number }): Promise<T> {
    return this.call<T>('sheet.deleteByIndex', payload);
  }

  // ========================
  // DRIVE CLIENT
  // ========================
  static upload<T = any>(payload: { folderId: string; base64: string; name: string; mimeType: string }): Promise<T> {
    return this.call<T>('drive.upload', payload);
  }

  static update<T = any>(payload: { publicUrlOrId: string; base64: string; name: string; mimeType: string }): Promise<T> {
    return this.call<T>('drive.update', payload);
  }

  static remove<T = any>(payload: { publicUrlOrId: string }): Promise<T> {
    return this.call<T>('drive.delete', payload);
  }

  // ========================
  // CONTROLLER
  // ========================
  static controllerCreate<T = any>(payload: { tab: string; attrs: Record<string, any>; folderId?: string }): Promise<T> {
    return this.call<T>('controller.create', payload);
  }

  static controllerGetAll<T = any>(payload: { tab: string }): Promise<T[]> {
    return this.call<T[]>('controller.getAll', payload);
  }

  static controllerGetByIndex<T = any>(payload: { tab: string; index: number }): Promise<T> {
    return this.call<T>('controller.getByIndex', payload);
  }

  static controllerGetCell<T = any>(payload: { tab: string; cell?: string; a1?: string }): Promise<T> {
    return this.call<T>('controller.getCell', payload);
  }

  static controllerUpdateByIndex<T = any>(payload: { tab: string; index: number; attrs: Record<string, any>; folderId?: string }): Promise<T> {
    return this.call<T>('controller.updateByIndex', payload);
  }

  static controllerUpdateCell<T = any>(payload: { tab: string; cell?: string; a1?: string; value: any; folderId?: string }): Promise<T> {
    return this.call<T>('controller.updateCell', payload);
  }

  static controllerDeleteByIndex<T = any>(payload: { tab: string; index: number }): Promise<T> {
    return this.call<T>('controller.deleteByIndex', payload);
  }
}

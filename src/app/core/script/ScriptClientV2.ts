import { AuthService } from '../auth/AuthService';

export class ScriptClientV2 {
  private static BASE_URL =
    'https://script.google.com/macros/s/AKfycbz6KlBkfWzEFEkHOVtCyMWD83aqi3oKVXdLtCY93XCUA24BBP3BO9aINqGIj5_R1LRX/exec';

  private static SHEET_ID = '19B2aMGrajvhPJfOvYXt059-fECytaN38iFsP8GInD_g';
  private static FOLDER_ID = '1zId11Ydti8d0FOQoQjd9lQmPo6GiJx26';

  /** Método interno genérico */
  private static async call<T>(action: string, payload: any, retry = true): Promise<T> {
    let idToken = AuthService.getIdToken();

    if (!idToken || !AuthService.isAuthenticated()) {
      const user = await AuthService.refreshIdToken();
      if (!user) throw new Error('Usuário precisa fazer login novamente.');
      idToken = user.idToken;
    }

    const body = {
      idToken,
      action,
      sheetId: this.SHEET_ID,
      folderId: this.FOLDER_ID,
      payload,
    };

    console.log('➡️ [ScriptClientV2] Enviando:', this.BASE_URL, body);

    const res = await fetch(this.BASE_URL, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error('❌ [ScriptClientV2] Erro bruto do Script:', text);
      if (res.status === 401 && retry) {
        console.warn('[ScriptClientV2] Token inválido, tentando renovar...');
        const user = await AuthService.refreshIdToken();
        if (!user) throw new Error('Usuário precisa se autenticar novamente.');
        return this.call<T>(action, payload, false);
      }
      throw new Error(`[ScriptClientV2] HTTP ${res.status} - ${res.statusText}\n${text}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      console.error('❌ [ScriptClientV2] Resposta não-JSON:', text);
      throw err;
    }
  }

  // ========================
  // CONTROLLER
  // ========================
  static controllerCreate<T = any>(payload: { tab: string; [k: string]: any }) {
    return this.call<T>('controller.create', {
      ...payload,
      folderId: this.FOLDER_ID,
    });
  }

  static controllerGetAll<T = any>(payload: { tab?: string; tabs?: string[] }) {
    return this.call<T>('controller.getAll', payload);
  }

  static controllerGetByIndex<T = any>(payload: { tab: string; index: number }) {
    return this.call<T>('controller.getByIndex', payload);
  }

  static controllerGetCell<T = any>(payload: { tab: string; cell: string }) {
    return this.call<T>('controller.getCell', payload);
  }

  static controllerUpdateByIndex<T = any>(payload: { tab: string; index: number; [k: string]: any }) {
    return this.call<T>('controller.updateByIndex', {
      ...payload,
      folderId: this.FOLDER_ID,
    });
  }

  static controllerUpdateCell<T = any>(payload: { tab: string; cell: string; value: any }) {
    return this.call<T>('controller.updateCell', payload);
  }

  static controllerDeleteByIndex<T = any>(payload: { tab: string; index: number }) {
    return this.call<T>('controller.deleteByIndex', payload);
  }

  // ========================
  // MULTIOPERAÇÕES
  // ========================
  static controllerCreateBatch<T = any>(payloads: Record<string, any[]>) {
    return this.call<T>('controller.create', {
      payloads,
      folderId: this.FOLDER_ID,
    });
  }

  static controllerUpdateBatch<T = any>(payloads: Record<string, any[]>) {
    return this.call<T>('controller.updateByIndex', {
      payloads,
      folderId: this.FOLDER_ID,
    });
  }

  static controllerDeleteBatch<T = any>(payloads: Record<string, { index: number }[]>) {
    return this.call<T>('controller.deleteByIndex', { payloads });
  }

  // ========================
  // DRIVE
  // ========================
  static driveUpload<T = any>(payload: { base64: string; name: string; mimeType: string }) {
    return this.call<T>('drive.upload', payload);
  }

  static driveUpdate<T = any>(payload: { publicUrlOrId: string; base64: string; name: string; mimeType: string }) {
    return this.call<T>('drive.update', payload);
  }

  static driveDelete<T = any>(payload: { publicUrlOrId: string }) {
    return this.call<T>('drive.delete', payload);
  }
}

import { AuthService } from '../auth/AuthService';

export class ScriptClient {
  private static ENDPOINT =
    'https://script.google.com/macros/s/AKfycbx6BtVqJX0GrLmU51YXdOb0wsNvgIjXk3BfhIJPo652DOInC1-rldbE3Uo46veDPEwx/exec';

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

    const res = await fetch(this.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Erro no Script: ${res.status} - ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  // ========================
  // SHEET CLIENT
  // ========================

  static createRow(payload: { tab: string; attrs: Record<string, any> }) {
    return this.call('sheet.createRow', payload);
  }

  static getAll(payload: { tab: string }) {
    return this.call('sheet.getAll', payload);
  }

  static getByIndex(payload: { tab: string; index: number }) {
    return this.call('sheet.getByIndex', payload);
  }

  static getCell(payload: { tab: string; cell?: string; a1?: string }) {
    return this.call('sheet.getCell', payload);
  }

  static updateByIndex(payload: { tab: string; index: number; attrs: Record<string, any> }) {
    return this.call('sheet.updateByIndex', payload);
  }

  static updateCell(payload: { tab: string; cell?: string; a1?: string; value: any }) {
    return this.call('sheet.updateCell', payload);
  }

  static deleteByIndex(payload: { tab: string; index: number }) {
    return this.call('sheet.deleteByIndex', payload);
  }

  // ========================
  // DRIVE CLIENT
  // ========================

  static upload(payload: { folderId: string; base64: string; name: string; mimeType: string }) {
    return this.call('drive.upload', payload);
  }

  static update(payload: { publicUrlOrId: string; base64: string; name: string; mimeType: string }) {
    return this.call('drive.update', payload);
  }

  static remove(payload: { publicUrlOrId: string }) {
    return this.call('drive.delete', payload);
  }

  // ========================
  // CONTROLLER
  // ========================

  static controllerCreate(payload: { tab: string; attrs: Record<string, any>; folderId?: string }) {
    return this.call('controller.create', payload);
  }

  static controllerGetAll(payload: { tab: string }) {
    return this.call('controller.getAll', payload);
  }

  static controllerGetByIndex(payload: { tab: string; index: number }) {
    return this.call('controller.getByIndex', payload);
  }

  static controllerGetCell(payload: { tab: string; cell?: string; a1?: string }) {
    return this.call('controller.getCell', payload);
  }

  static controllerUpdateByIndex(payload: { tab: string; index: number; attrs: Record<string, any>; folderId?: string }) {
    return this.call('controller.updateByIndex', payload);
  }

  static controllerUpdateCell(payload: { tab: string; cell?: string; a1?: string; value: any; folderId?: string }) {
    return this.call('controller.updateCell', payload);
  }

  static controllerDeleteByIndex(payload: { tab: string; index: number }) {
    return this.call('controller.deleteByIndex', payload);
  }
}

import { IndexedDBClientV2 } from "../db/IndexedDBClientV2";

export interface User {
  name: string;
  email: string;
  picture: string;
  idToken: string;
}

declare const google: any;

export class AuthService {
  private static STORAGE_KEY = 'user';
  private static CLIENT_ID =
    '338305920567-bhd608ebcip1u08qf0gb5f08o4je4dnp.apps.googleusercontent.com';

  /**
   * Sempre abre popup de login Google
   */
  static signInWithGoogle(): Promise<User | null> {
    return new Promise((resolve) => {
      if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services não carregado.');
        resolve(null);
        return;
      }

      // cria container oculto para o botão oficial do Google
      let btn = document.getElementById('gsi-hidden-btn') as HTMLDivElement;
      if (!btn) {
        btn = document.createElement('div');
        btn.id = 'gsi-hidden-btn';
        btn.style.display = 'none';
        document.body.appendChild(btn);

        google.accounts.id.initialize({
          client_id: this.CLIENT_ID,
          auto_select: false,
          callback: (response: any) => {
            const idToken = response.credential;
            if (!idToken) {
              resolve(null);
              return;
            }

            const payload = this.parseJwt(idToken);
            const user: User = {
              name: payload.name,
              email: payload.email,
              picture: payload.picture,
              idToken,
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
            resolve(user);
          },
        });

        google.accounts.id.renderButton(btn, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
        });
      }

      // força o clique → abre popup do Google
      (btn.querySelector('div[role=button]') as HTMLDivElement)?.click();
    });
  }

  static getUser(): User | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  static getIdToken(): string | null {
    return this.getUser()?.idToken || null;
  }

  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static async logoutHard() {
    console.log('[AuthService] logoutHard → limpando user + banco');
    localStorage.removeItem(this.STORAGE_KEY);
    const db = await IndexedDBClientV2.create();
    await db.deleteDatabase();
  }

  static isAuthenticated(): boolean {
    const user = this.getUser();
    if (!user) return false;

    try {
      const payload = this.parseJwt(user.idToken);
      const now = Math.floor(Date.now() / 1000);

      // margem de 12h = 43.200 segundos
      const gracePeriod = 12 * 60 * 60;

      return payload.exp && Number(payload.exp) + gracePeriod > now;
    } catch {
      return false;
    }
  }


  private static parseJwt(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  static async refreshIdToken(): Promise<User | null> {
    try {
      const user = await this.signInWithGoogle();
      return user;
    } catch (err) {
      console.error('[AuthService] Falha ao renovar token:', err);
      return null;
    }
  }
}

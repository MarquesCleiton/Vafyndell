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
   * Tenta login silencioso, se falhar abre popup
   */
  static signInWithGoogle(): Promise<User | null> {
    return new Promise((resolve) => {
      if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services não carregado.');
        resolve(null);
        return;
      }

      google.accounts.id.initialize({
        client_id: this.CLIENT_ID,
        auto_select: true, // tenta usar conta já logada
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

      // Primeiro tenta login silencioso
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // 👇 Se não rolou silencioso, abre popup
          google.accounts.id.renderButton(
            document.createElement('div'), // hack → botão não visível
            { type: 'standard', theme: 'outline' }
          );
          google.accounts.id.prompt(); // força popup
        }
      });
    });
  }

  /** Recupera usuário salvo */
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

  static isAuthenticated(): boolean {
    const user = this.getUser();
    if (!user) return false;

    try {
      const payload = this.parseJwt(user.idToken);
      const now = Math.floor(Date.now() / 1000);
      return payload.exp && Number(payload.exp) > now;
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

  /**
 * Força uma atualização do idToken
 * - Tenta silencioso
 * - Se não rolar, pede interação
 */
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

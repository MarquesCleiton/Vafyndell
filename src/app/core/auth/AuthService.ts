export interface User {
  name: string;
  email: string;
  picture: string;
  idToken: string;
  accessToken: string;
}

declare const google: any;

export class AuthService {
  private static STORAGE_KEY = 'user';
  private static CLIENT_ID =
    '338305920567-bhd608ebcip1u08qf0gb5f08o4je4dnp.apps.googleusercontent.com';
  private static SCOPES =
    'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file openid email profile';

  /**
   * Login único com Google → devolve User completo
   */
  static signInWithGoogle(): Promise<User | null> {
    return new Promise((resolve) => {
      if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services não carregado.');
        resolve(null);
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: async (response: any) => {
          if (response && response.access_token) {
            try {
              // 1. Perfil do usuário
              const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              const profile = await profileRes.json();

              // 2. ID Token (validação no backend)
              const tokenInfoRes = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?access_token=${response.access_token}`
              );
              const tokenInfo = await tokenInfoRes.json();
              const idToken = tokenInfo.id_token || '';

              const user: User = {
                name: profile.name,
                email: profile.email,
                picture: profile.picture,
                accessToken: response.access_token,
                idToken,
              };

              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
              resolve(user);
            } catch (err) {
              console.error('Erro ao buscar perfil/token:', err);
              resolve(null);
            }
          } else {
            console.error('Não foi possível obter access_token');
            resolve(null);
          }
        },
      });

      client.requestAccessToken(); // abre popup
    });
  }

  /** Recupera usuário salvo no localStorage */
  static getUser(): User | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  /** Retorna tokens separadamente */
  static getAccessToken(): string | null {
    return this.getUser()?.accessToken || null;
  }

  static getIdToken(): string | null {
    return this.getUser()?.idToken || null;
  }

  /** Remove usuário da sessão */
  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /** Verifica se há usuário autenticado */
  static isAuthenticated(): boolean {
    return this.getUser() !== null;
  }
}

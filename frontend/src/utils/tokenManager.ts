import appConfig from '@/config/app.config';

class TokenManager {
  readonly token = appConfig.local_storage.auth.token;

  getToken(): string | null {
    return localStorage.getItem(this.token);
  }

  setToken(token: string) {
    localStorage.setItem(this.token, token);
  }

  clearAll() {
    localStorage.removeItem(this.token);
  }
}

export const tokenManager = new TokenManager();

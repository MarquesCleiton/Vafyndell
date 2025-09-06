export class IndexedDBClient {
  private DB_NAME = 'VafyndellDB';
  private DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private storeNames: Set<string> = new Set();

  /** 🔑 Factory para criar instância já inicializada */
  static async create(): Promise<IndexedDBClient> {
    const client = new IndexedDBClient();
    await client.init();
    return client;
  }

  /** 🔒 construtor privado → força usar .create() */
  private constructor() {
    console.log('[IndexedDBClient] Constructor chamado');
  }

  /** Inicializa o banco (pega versão já existente se houver) */
  private async init(): Promise<void> {
    if (this.db) {
      console.log('[IndexedDBClient] Banco já inicializado.');
      return;
    }

    const dbInfo = await indexedDB.databases?.();
    const existing = dbInfo?.find(d => d.name === this.DB_NAME);

    if (existing?.version && existing.version > this.DB_VERSION) {
      this.DB_VERSION = existing.version;
      console.log(`[IndexedDBClient] Ajustando versão para ${this.DB_VERSION}`);
    }

    return new Promise((resolve, reject) => {
      console.log(`[IndexedDBClient] Abrindo banco ${this.DB_NAME} v${this.DB_VERSION}...`);
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.storeNames = new Set(Array.from(this.db!.objectStoreNames));
        console.log('[IndexedDBClient] Banco aberto com stores:', Array.from(this.storeNames));
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        console.log('[IndexedDBClient] Upgrade do banco. Stores existentes:', Array.from(db.objectStoreNames));
      };
    });
  }

  /** Cria a store se não existir (aumentando versão do DB) */
  private async ensureStore(storeName: string): Promise<void> {
    if (this.storeNames.has(storeName)) return;

    console.log(`[IndexedDBClient] Store "${storeName}" não existe → recriando DB...`);
    this.db?.close();

    const dbInfo = await indexedDB.databases?.();
    const existing = dbInfo?.find(d => d.name === this.DB_NAME);
    const currentVersion = existing?.version ?? this.DB_VERSION;

    this.DB_VERSION = Math.max(this.DB_VERSION, currentVersion) + 1;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
          console.log(`[IndexedDBClient] Store criada: ${storeName}`);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.storeNames = new Set(Array.from(this.db!.objectStoreNames));
        console.log('[IndexedDBClient] Banco reaberto com stores:', Array.from(this.storeNames));
        resolve();
      };
    });
  }

  // ============ CRUD ============

  async put<T extends { id: any }>(storeName: string, value: T): Promise<void> {
    await this.ensureStore(storeName);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkPut<T extends { id: any }>(storeName: string, values: T[]): Promise<void> {
    await this.ensureStore(storeName);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      values.forEach((val) => store.put(val));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(storeName: string, key: any): Promise<T | null> {
    if (!this.storeNames.has(storeName)) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.storeNames.has(storeName)) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: any): Promise<void> {
    if (!this.storeNames.has(storeName)) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.storeNames.has(storeName)) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteDatabase(): Promise<void> {
    console.log('[IndexedDBClient] deleteDatabase → resetando banco...');
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.DB_NAME);
      request.onsuccess = () => {
        this.storeNames.clear();
        this.DB_VERSION = 1;
        console.log('[IndexedDBClient] Banco deletado com sucesso.');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export class IndexedDBClient {
  private DB_NAME = 'VafyndellDB';
  private DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private storeNames: Set<string> = new Set();

  /** Stores padrão do app */
  private static DEFAULT_STORES = [
    'Catalogo',
    'Inventario',
    'Receitas',
    'Personagem',
    'Npcs',
    'Anotacoes',
    'metadados',
  ];

  static async create(): Promise<IndexedDBClient> {
    const client = new IndexedDBClient();
    await client.init();
    return client;
  }

  private constructor() {}

  private async init(): Promise<void> {
    if (this.db) return;

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
        console.log('[IndexedDBClient] Upgrade → garantindo stores...');
        IndexedDBClient.DEFAULT_STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
            console.log(`[IndexedDBClient] Store criada: ${store}`);
          }
        });
      };
    });
  }

  // ============ CRUD ============
  async put<T extends { id: any }>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async bulkPut<T extends { id: any }>(storeName: string, values: T[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      values.forEach((val) => store.put(val));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(storeName: string, key: any): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(storeName: string): Promise<void> {
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

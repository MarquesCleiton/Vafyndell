export class IndexedDBClientV2 {
  private DB_NAME = 'VafyndellDBv2';
  private DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private storeNames: Set<string> = new Set();

  private static DEFAULT_STORES = [
    'Catalogo',
    'Inventario',
    'Receitas',
    'Personagem',
    'NPCs',
    'Anotacoes',
    'Metadados',
    'Caminhos',
    'Arvores',
    'Ramos',
    'Habilidades',
  ];

  static async create(): Promise<IndexedDBClientV2> {
    const client = new IndexedDBClientV2();
    await client.init();
    return client;
  }

  private constructor() {}

  private async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      console.log(`[IndexedDBClientV2] Abrindo banco ${this.DB_NAME} v${this.DB_VERSION}...`);
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.storeNames = new Set(Array.from(this.db!.objectStoreNames));
        console.log('[IndexedDBClientV2] Banco aberto com stores:', Array.from(this.storeNames));
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        console.log('[IndexedDBClientV2] Upgrade → garantindo stores...');
        IndexedDBClientV2.DEFAULT_STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            // 🔑 chave padronizada = id
            db.createObjectStore(store, { keyPath: 'id' });
            console.log(`[IndexedDBClientV2] Store criada: ${store}`);
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
    console.log('[IndexedDBClientV2] deleteDatabase → resetando banco...');
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.DB_NAME);
      request.onsuccess = () => {
        this.storeNames.clear();
        this.DB_VERSION = 1;
        console.log('[IndexedDBClientV2] Banco deletado com sucesso.');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

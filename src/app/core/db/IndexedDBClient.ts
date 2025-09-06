export interface StoreConfig {
  name: string;
  keyPath: string;
  autoIncrement?: boolean;
}

export class IndexedDBClient {
  private static DB_NAME = 'VafyndellDB';
  private static DB_VERSION = 1;
  private static db: IDBDatabase | null = null;
  private static storeConfigs: StoreConfig[] = [];

  /** Inicializa o banco com stores configuradas */
  static async init(stores: StoreConfig[] = []): Promise<void> {
    if (this.db) return;
    this.storeConfigs = stores;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        this.storeConfigs.forEach((config) => {
          if (!db.objectStoreNames.contains(config.name)) {
            db.createObjectStore(config.name, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement || false,
            });
          }
        });
      };
    });
  }

  /** Valida se a store existe */
  private static storeExists(storeName: string): boolean {
    return this.db?.objectStoreNames.contains(storeName) ?? false;
  }

  /** Garante que a store existe antes de escrever */
  private static async ensureStore(storeName: string, keyPath = 'id'): Promise<void> {
    if (this.storeExists(storeName)) return;

    // recria DB com versão +1 e adiciona a nova store
    this.db?.close();
    this.db = null;
    this.DB_VERSION++;
    this.storeConfigs.push({ name: storeName, keyPath });
    await this.init(this.storeConfigs);
  }

  // ============ CRUD ============

  static async put<T>(storeName: string, value: T, keyPath = 'id'): Promise<void> {
    await this.ensureStore(storeName, keyPath);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async bulkPut<T>(storeName: string, values: T[], keyPath = 'id'): Promise<void> {
    await this.ensureStore(storeName, keyPath);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      values.forEach((val) => store.put(val));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async get<T>(storeName: string, key: any): Promise<T | null> {
    if (!this.storeExists(storeName)) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  static async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.storeExists(storeName)) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async delete(storeName: string, key: any, keyPath = 'id'): Promise<void> {
    if (!this.storeExists(storeName)) return;
    await this.ensureStore(storeName, keyPath);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async clear(storeName: string, keyPath = 'id'): Promise<void> {
    if (!this.storeExists(storeName)) return;
    await this.ensureStore(storeName, keyPath);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

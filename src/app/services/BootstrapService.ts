import { IndexedDBClientV2 } from "../core/db/IndexedDBClientV2";
import { BaseRepositoryV2 } from "../repositories/BaseRepositoryV2";
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BootstrapService {
  async preloadAll(onStatus?: (msg: string) => void): Promise<void> {
    const tabs: string[] = [
      'Catalogo',
      'Inventario',
      'Receitas',
      'Personagem',
      'NPCs',
      'Anotacoes',
      'Metadados',
    ];

    // 🔄 loop de frases enquanto carrega do servidor
    const frasesCarregando = [
      '🔮 Invocando grimórios...',
      '🌌 Consultando os astros...',
      '📜 Decifrando runas antigas...',
      '⚡ Canalizando energia arcana...',
    ];
    let i = 0;
    const intervalId = setInterval(() => {
      onStatus?.(frasesCarregando[i % frasesCarregando.length]);
      i++;
    }, 1200);

    // 🔽 fetch multi
    const result = await BaseRepositoryV2.multiFetch(tabs);

    clearInterval(intervalId);

    // Escreve no IndexedDB
    const db = await IndexedDBClientV2.create();
    for (const tab of tabs) {
      const frases = [
        `📖 Estudando os pergaminhos de ${tab}...`,
        `⚒️ Forjando dados para ${tab}...`,
        `🧪 Misturando poções em ${tab}...`,
        `🐉 Invocando criaturas de ${tab}...`,
      ];
      onStatus?.(frases[Math.floor(Math.random() * frases.length)]);

      await db.clear(tab);
      if (result[tab]?.length) {
        await db.bulkPut(tab, result[tab]);
      }
    }

    onStatus?.('✨ Mundo preparado!');
  }
}

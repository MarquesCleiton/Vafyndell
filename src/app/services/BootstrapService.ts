import { IndexedDBClient } from "../core/db/IndexedDBClient";
import { BaseRepository } from "../repositories/BaseRepository";
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BootstrapService {
  private repo = new BaseRepository<any>('bootstrap'); // tab dummy, usamos multi

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
    }, 1300); // troca a cada 800ms

    // 🔽 essa parte demora
    const result = await this.repo.getAllMulti(tabs);

    // ✅ parar loop quando terminar
    clearInterval(intervalId);

    // Agora frases específicas por aba
    const db = await IndexedDBClient.create();
    for (const tab of tabs) {
      const frases = [
        `📖 Estudando os pergaminhos de ${tab}...`,
        `⚒️ Forjando dados para ${tab}...`,
        `🧪 Misturando poções em ${tab}...`,
        `🐉 Invocando criaturas de ${tab}...`,
      ];
      const random = frases[Math.floor(Math.random() * frases.length)];
      onStatus?.(random);

      await db.clear(tab);
      await db.bulkPut(tab, result[tab] || []);
    }

    onStatus?.('✨ Mundo preparado!');
  }
}

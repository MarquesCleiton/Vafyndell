import { Injectable } from '@angular/core';
import { BaseRepository } from '../repositories/BaseRepository';
import { IndexedDBClient } from '../core/db/IndexedDBClient';

@Injectable({ providedIn: 'root' })
export class BootstrapService {
    private repo = new BaseRepository<any>('bootstrap'); // tab dummy, usamos multi

    async preloadAll(onStatus?: (msg: string) => void): Promise<void> {
        // precisa ser string[] mutável, não readonly
        const tabs: string[] = [
            'Catalogo',
            'Inventario',
            'Receitas',
            'Personagem',
            'NPCs',
            'Anotacoes',
            'Metadados',
        ];

        onStatus?.('🔮 Invocando grimórios...');
        const result = await this.repo.getAllMulti(tabs);

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

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
      'Caminhos',
      'Arvores',
      'Habilidades',
      'Metadados',
      'Habilidades_jogadores',
      'Registro'
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

    // 🔽 multiFetch já faz clear() + bulkPut() internamente em cada tab
    await BaseRepositoryV2.multiFetch(tabs);

    clearInterval(intervalId);
    onStatus?.('✨ Mundo preparado!');
  }
}

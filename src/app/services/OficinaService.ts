import { Injectable } from '@angular/core';
import { BaseRepositoryV2 } from '../repositories/BaseRepositoryV2';
import { CatalogoDomain } from '../domain/CatalogoDomain';
import { ReceitaDomain } from '../domain/ReceitaDomain';
import { InventarioDomain } from '../domain/InventarioDomain';
import { AuthService } from '../core/auth/AuthService';
import { IdUtils } from '../core/utils/IdUtils';

export interface IngredienteDetalhado extends ReceitaDomain {
  quantidadeInventario: number;
  nome?: string;
  imagem?: string;
  raridade?: string;   // 👈 adiciona aqui
}


export type ReceitaComStatus = CatalogoDomain & {
  fabricavel: boolean;
  ingredientes: IngredienteDetalhado[];
};

@Injectable({ providedIn: 'root' })
export class OficinaService {
  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');
  private receitasRepo = new BaseRepositoryV2<ReceitaDomain>('Receitas');

  async getPossiveisReceitas(): Promise<ReceitaComStatus[]> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    // 1️⃣ pega dados locais primeiro
    const [catalogoLocal, inventarioLocal, receitasLocal] = await Promise.all([
      this.catalogoRepo.getLocal(),
      this.inventarioRepo.getLocal(),
      this.receitasRepo.getLocal(),
    ]);
    const inventarioUser = inventarioLocal.filter(i => i.jogador === user.email);
    let receitasProcessadas = this.processar(catalogoLocal, receitasLocal, inventarioUser);

    // 2️⃣ dispara sync em paralelo (não trava a tela)
    (async () => {
      const [catSync, invSync, recSync] = await Promise.all([
        this.catalogoRepo.sync(),
        this.inventarioRepo.sync(),
        this.receitasRepo.sync(),
      ]);
      if (catSync || invSync || recSync) {
        const [catAtualizado, invAtualizado, recAtualizado] = await Promise.all([
          this.catalogoRepo.getLocal(),
          this.inventarioRepo.getLocal(),
          this.receitasRepo.getLocal(),
        ]);
        const meusAtualizados = invAtualizado.filter(i => i.jogador === user.email);
        receitasProcessadas = this.processar(catAtualizado, recAtualizado, meusAtualizados);
      }
    })();

    // 3️⃣ se não tiver nada local → força fetch online
    if (!receitasProcessadas.length) {
      const [catalogoOnline, inventarioOnline, receitasOnline] = await Promise.all([
        this.catalogoRepo.forceFetch(),
        this.inventarioRepo.forceFetch(),
        this.receitasRepo.forceFetch(),
      ]);
      const meusOnline = inventarioOnline.filter(i => i.jogador === user.email);
      receitasProcessadas = this.processar(catalogoOnline, receitasOnline, meusOnline);
    }

    return receitasProcessadas;
  }


  private processar(
    catalogo: CatalogoDomain[],
    receitas: ReceitaDomain[],
    inventario: InventarioDomain[]
  ): ReceitaComStatus[] {
    const estoque = new Map<string, number>();
    inventario.forEach((i) => {
      const key = String(i.item_catalogo);
      const atual = estoque.get(key) || 0;
      estoque.set(key, atual + (i.quantidade || 0));
    });

    const fabricaveis = catalogo.filter((c) =>
      receitas.some((r) => String(r.fabricavel) === String(c.id))
    );

    return fabricaveis
      .map((item) => {
        const ingredientes: IngredienteDetalhado[] = receitas
          .filter((r) => String(r.fabricavel) === String(item.id))
          .map((ing) => {
            const qtdInventario = estoque.get(String(ing.catalogo)) || 0;
            const ref = catalogo.find((c) => String(c.id) === String(ing.catalogo));
            return {
              ...ing,
              id: ing.catalogo, // 👈 garante ID do Catálogo
              quantidadeInventario: qtdInventario,
              nome: ref?.nome,
              imagem: ref?.imagem,
              raridade: ref?.raridade || 'Comum', // 👈 adiciona raridade do catálogo
            };
          });



        const podeFabricar = ingredientes.every(
          (ing) => ing.quantidadeInventario >= ing.quantidade
        );
        const possuiAlgum = ingredientes.some((ing) => ing.quantidadeInventario > 0);
        if (!possuiAlgum) return null;

        return {
          ...item,
          fabricavel: podeFabricar,
          ingredientes,
        };
      })
      .filter((i): i is ReceitaComStatus => i !== null);
  }

  async criarItem(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    for (const ing of receita.ingredientes) {
      await this.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }

    const qtdFinal = receita.quantidade_fabricavel || 1;
    await this.adicionarOuIncrementar(user.email, receita.id, qtdFinal);

    console.log(
      `[OficinaService] Item criado: ${receita.nome} (x${qtdFinal} ${receita.unidade_medida || 'unidade(s)'})`
    );
  }

  async forcarFalha(receita: ReceitaComStatus): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    for (const ing of receita.ingredientes) {
      await this.subtrairQuantidade(user.email, ing.catalogo, ing.quantidade);
    }
    console.log(`[OficinaService] Falha forçada: ${receita.nome}`);
  }

  private async subtrairQuantidade(jogador: string, itemCatalogo: string, qtd: number) {
    const todos = (await this.inventarioRepo.getLocal()).filter((i) => i.jogador === jogador);
    const encontrado = todos.find((i) => i.item_catalogo === itemCatalogo);
    if (!encontrado) return;

    encontrado.quantidade = Math.max(0, (encontrado.quantidade || 0) - qtd);
    if (encontrado.quantidade === 0) {
      await this.inventarioRepo.delete(encontrado.id); // 🔑 agora por id
    } else {
      await this.inventarioRepo.update(encontrado);   // 🔑 update também por id
    }
  }

  private async adicionarOuIncrementar(jogador: string, itemCatalogo: string, qtd: number) {
    const todos = (await this.inventarioRepo.getLocal()).filter((i) => i.jogador === jogador);
    const existente = todos.find((i) => i.item_catalogo === itemCatalogo);

    if (existente) {
      existente.quantidade += qtd;
      await this.inventarioRepo.update(existente);
    } else {
      const novo: InventarioDomain = {
        id: IdUtils.generateULID(),
        index: Date.now(), // só para ordenação
        jogador,
        item_catalogo: itemCatalogo,
        quantidade: qtd,
      };
      await this.inventarioRepo.create(novo);
    }
  }
}

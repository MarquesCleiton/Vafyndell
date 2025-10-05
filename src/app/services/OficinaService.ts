import { Injectable } from '@angular/core';
import { BaseRepositoryV2 } from '../repositories/BaseRepositoryV2';
import { CatalogoDomain } from '../domain/CatalogoDomain';
import { ReceitaDomain } from '../domain/ReceitaDomain';
import { InventarioDomain } from '../domain/InventarioDomain';
import { RegistroDomain } from '../domain/RegistroDomain';
import { JogadorDomain } from '../domain/jogadorDomain';
import { AuthService } from '../core/auth/AuthService';
import { IdUtils } from '../core/utils/IdUtils';

export interface IngredienteDetalhado extends ReceitaDomain {
  quantidadeInventario: number;
  nome?: string;
  imagem?: string;
  raridade?: string;
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
  private registroRepo = new BaseRepositoryV2<RegistroDomain>('Registro');
  private jogadorRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  // =========================================================
  // 🔍 Carrega receitas e ingredientes disponíveis
  // =========================================================
  async getPossiveisReceitas(): Promise<ReceitaComStatus[]> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    const [catalogoLocal, inventarioLocal, receitasLocal] = await Promise.all([
      this.catalogoRepo.getLocal(),
      this.inventarioRepo.getLocal(),
      this.receitasRepo.getLocal(),
    ]);
    const inventarioUser = inventarioLocal.filter(i => i.jogador === user.email);
    let receitasProcessadas = this.processar(catalogoLocal, receitasLocal, inventarioUser);

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

  // =========================================================
  // 🔧 Processa e calcula status de fabricação
  // =========================================================
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
              id: ing.catalogo,
              quantidadeInventario: qtdInventario,
              nome: ref?.nome,
              imagem: ref?.imagem,
              raridade: ref?.raridade || 'Comum',
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

  // =========================================================
  // ⚗️ Fabricação com registro e histórico
  // =========================================================
  async registrarFabricacao(receita: ReceitaComStatus, sucesso = true): Promise<void> {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');

    const jogador = user.email;
    const personagem = await this.getPersonagemNome(jogador);
    const todos = (await this.inventarioRepo.getLocal()).filter(i => i.jogador === jogador);

    const updates: InventarioDomain[] = [];
    const creates: InventarioDomain[] = [];
    const deletes: string[] = [];
    const logItens: string[] = [];

    const qtdFinal = receita.quantidade_fabricavel || 1;
    const unidade = receita.unidade_medida || 'unidade(s)';

    // ---------------------------------------------------------
    // 🔹 Subtrai ingredientes
    // ---------------------------------------------------------
    for (const ing of receita.ingredientes) {
      const encontrado = todos.find(i => i.item_catalogo === ing.catalogo);
      if (!encontrado) continue;

      const qtdAntes = encontrado.quantidade;
      const qtdDepois = Math.max(0, qtdAntes - ing.quantidade);

      const novaDescricao = [
        `Quantidade: ${qtdAntes} → ${qtdDepois} (-${ing.quantidade} ${ing.catalogo.unidade_medida || 'unidade'})`,
        sucesso
          ? `Fabricação de sucesso: ${receita.nome}`
          : `Fabricação falhou: ${receita.nome}`,
      ].join('\n');

      const historicoConcat = encontrado.descricao
        ? `${novaDescricao}\n---\n${encontrado.descricao.trim()}`
        : novaDescricao;

      const atualizado: InventarioDomain = { ...encontrado, quantidade: qtdDepois, descricao: historicoConcat };

      if (atualizado.quantidade > 0) updates.push(atualizado);
      else deletes.push(encontrado.id);

      logItens.push(`🎒 ${ing.nome || 'Ingrediente'} : ${qtdAntes} → ${qtdDepois} (-${ing.quantidade} ${ing.catalogo.unidade_medida || 'unidade(s)'})`);
    }

    // ---------------------------------------------------------
    // 🔹 Cria ou incrementa o item fabricado
    // ---------------------------------------------------------
    const existente = todos.find(i =>
      String(i.item_catalogo).trim() === String(receita.id).trim()
    );
    let qtdAntes = existente?.quantidade || 0;
    let qtdDepois = sucesso ? qtdAntes + qtdFinal : qtdAntes;

    if (sucesso) {
      const novaDescricao = [
        `Quantidade: ${qtdAntes} → ${qtdDepois} (+${qtdFinal} ${unidade})`,
        `Fabricação de item`,
      ].join('\n');

      const historicoConcat = existente?.descricao
        ? `${novaDescricao}\n---\n${existente.descricao.trim()}`
        : novaDescricao;

      if (existente) {
        // ✅ Se já existe, apenas soma e concatena a descrição
        const atualizado: InventarioDomain = {
          ...existente,
          quantidade: qtdDepois,
          descricao: historicoConcat,
        };
        updates.push(atualizado);
      } else {
        // ✅ Se não existe, cria um novo registro
        const novo: InventarioDomain = {
          id: IdUtils.generateULID(),
          index: Date.now(),
          jogador,
          item_catalogo: receita.id,
          quantidade: qtdFinal,
          descricao: novaDescricao,
        };
        creates.push(novo);
      }

      logItens.unshift(`🎒 ${receita.nome}: ${qtdAntes} → ${qtdDepois} (+${qtdFinal} ${unidade})`);
    } else {
      logItens.unshift(`🎒 ${receita.nome} (nenhum item foi criado)`);
    }

    // ---------------------------------------------------------
    // 🧾 Registro geral
    // ---------------------------------------------------------
    const registro: RegistroDomain = {
      id: IdUtils.generateULID(),
      jogador,
      tipo: 'fabricacao',
      acao: sucesso ? 'sucesso' : 'falha',
      detalhes:
        (sucesso
          ? `⚒️ ${personagem} criou um novo item`
          : `💥 ${personagem} falhou ao criar um item`) +
        '\n' +
        logItens.join('\n'),
      data: new Date().toISOString(),
    };

    // ---------------------------------------------------------
    // 🧱 Executa tudo em batch (multioperações)
    // ---------------------------------------------------------
    await BaseRepositoryV2.batch({
      updateById: updates.length ? { Inventario: updates } : undefined,
      create: {
        ...(creates.length ? { Inventario: creates } : {}),
        Registro: [registro],
      },
      deleteById: deletes.length
        ? { Inventario: deletes.map(id => ({ id })) }
        : undefined,
    });

    console.log(`[OficinaService] Registro criado:`, registro);
  }


  // =========================================================
  // 🧩 Métodos simplificados para o componente chamar
  // =========================================================
  async criarItem(receita: ReceitaComStatus): Promise<void> {
    await this.registrarFabricacao(receita, true);
  }

  async forcarFalha(receita: ReceitaComStatus): Promise<void> {
    await this.registrarFabricacao(receita, false);
  }

  // =========================================================
  // 🧠 Utilitários
  // =========================================================
  private async getPersonagemNome(email: string): Promise<string> {
    const jogadores = await this.jogadorRepo.getLocal();
    const j = jogadores.find(j => j.email === email);
    return j?.personagem || 'Desconhecido';
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';

import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { BaseRepository } from '../../repositories/BaseRepository';
import { AuthService } from '../../core/auth/AuthService';
import { IdUtils } from '../../core/utils/IdUtils';

interface InventarioDetalhado extends InventarioDomain {
  itemDetalhe?: CatalogoDomain;
}

@Component({
  selector: 'app-troca-de-itens',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatInputModule,
    MatOptionModule,
    MatButtonModule,
  ],
  templateUrl: './troca-de-itens.html',
  styleUrls: ['./troca-de-itens.css'],
})
export class TrocaDeItens implements OnInit {
  jogadores: JogadorDomain[] = [];
  jogadoresFiltrados: JogadorDomain[] = [];
  filtroJogador = '';
  jogadorSelecionado: JogadorDomain | null = null;

  inventario: InventarioDetalhado[] = [];
  inventarioFiltrado: InventarioDetalhado[] = [];
  filtroItem = '';
  itemSelecionado: InventarioDetalhado | null = null;
  quantidade = 1;

  itensTroca: { item: InventarioDetalhado; quantidade: number }[] = [];

  processando = false;
  private emailLogado: string = '';

  private jogadoresRepo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');
  private inventarioRepo = new BaseRepository<InventarioDomain>('Inventario', 'Inventario');
  private catalogoRepo = new BaseRepository<CatalogoDomain>('Catalogo', 'Catalogo');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  async ngOnInit() {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');
    this.emailLogado = user.email;

    // Jogadores (removendo o próprio usuário)
    this.jogadores = (await this.jogadoresRepo.getLocal()).filter(
      j => j.email !== this.emailLogado
    );
    this.jogadoresFiltrados = [...this.jogadores];

    // Inventário + catálogo
    const [inventario, catalogo] = await Promise.all([
      this.inventarioRepo.getLocal(),
      this.catalogoRepo.getLocal(),
    ]);

    this.inventario = inventario
      .filter(i => i.jogador === this.emailLogado)
      .map(i => ({
        ...i,
        itemDetalhe: catalogo.find(c => String(c.id) === String(i.item_catalogo)),
      }));
    this.inventarioFiltrado = [...this.inventario];

    // Se veio com ID pré-selecionado
    const idItem = this.route.snapshot.paramMap.get('id');
    if (idItem) {
      const encontrado = this.inventario.find(i => String(i.id) === idItem);
      if (encontrado) {
        this.itemSelecionado = encontrado;
        this.filtroItem = encontrado.itemDetalhe?.nome || '';
        this.quantidade = 1;
      }
    }
  }

  // =========================================================
  // Jogadores
  // =========================================================
  filtrarJogadores() {
    const termo = this.filtroJogador.toLowerCase().trim();
    this.jogadoresFiltrados = termo
      ? this.jogadores.filter(j => j.personagem.toLowerCase().includes(termo))
      : [...this.jogadores];
  }

  selecionarJogador(j: JogadorDomain) {
    this.jogadorSelecionado = j;
    this.filtroJogador = j.personagem;
  }

  // =========================================================
  // Inventário
  // =========================================================
filtrarItensInventario() {
  const termo = this.filtroItem.toLowerCase().trim();

  this.inventarioFiltrado = this.inventario
    .map(i => {
      // calcula quanto ainda sobra considerando o que já foi escolhido
      const jaAdicionado = this.itensTroca
        .filter(t => t.item.id === i.id)
        .reduce((sum, t) => sum + t.quantidade, 0);

      const restante = i.quantidade - jaAdicionado;

      // 🔑 se já foi todo para a troca, não retorna mais
      return restante > 0 ? { ...i, quantidade: restante } : null;
    })
    .filter((i): i is InventarioDetalhado => i !== null) // remove os null
    .filter(i => (termo ? i.itemDetalhe?.nome?.toLowerCase().includes(termo) : true));
}

adicionarItem() {
  if (!this.itemSelecionado) return;

  const existente = this.itensTroca.find(t => t.item.id === this.itemSelecionado!.id);
  if (existente) {
    existente.quantidade = Math.min(
      existente.quantidade + this.quantidade,
      this.itemSelecionado.quantidade + existente.quantidade // 🔑 soma corretamente
    );
  } else {
    this.itensTroca.push({ item: this.itemSelecionado, quantidade: this.quantidade });
  }

  this.itemSelecionado = null;
  this.filtroItem = '';
  this.quantidade = 1;

  // 🔑 Recalcula a lista disponível corretamente
  this.filtrarItensInventario();
}


  selecionarItem(i: InventarioDetalhado) {
    this.itemSelecionado = i;
    this.filtroItem = i.itemDetalhe?.nome || '';
    this.quantidade = 1;
  }

  incrementar() {
    if (!this.itemSelecionado) return;
    const max = this.itemSelecionado.quantidade;
    this.quantidade = Math.min(this.quantidade + 1, max);
  }

  decrementar() {
    this.quantidade = Math.max(1, this.quantidade - 1);
  }

  validarQuantidade() {
    if (!this.itemSelecionado) return;
    const max = this.itemSelecionado.quantidade;
    if (this.quantidade > max) this.quantidade = max;
    if (this.quantidade < 1) this.quantidade = 1;
  }

  removerItem(index: number) {
    this.itensTroca.splice(index, 1);
    this.filtrarItensInventario();
  }

  // =========================================================
  // Confirmar troca
  // =========================================================
  async confirmarTroca() {
    if (!this.jogadorSelecionado) {
      alert('⚠️ Selecione um jogador destinatário!');
      return;
    }
    if (this.itensTroca.length === 0) {
      alert('⚠️ Adicione ao menos um item para trocar!');
      return;
    }

    this.processando = true;

    try {
      const destinatario = this.jogadorSelecionado.email;
      let todos = await this.inventarioRepo.getLocal();

      const updates: InventarioDomain[] = [];
      const creates: InventarioDomain[] = [];
      const deletes: number[] = [];

      for (const troca of this.itensTroca) {
        const remetente = troca.item;
        let quantidade = troca.quantidade;

        if (quantidade > remetente.quantidade) {
          quantidade = remetente.quantidade;
        }

        // 🔽 Subtrai do remetente
        const atualizadoRem = { ...remetente, quantidade: remetente.quantidade - quantidade };
        if (atualizadoRem.quantidade > 0) {
          updates.push(atualizadoRem);
        } else {
          deletes.push(remetente.index);
        }

        // 🔼 Adiciona ao destinatário
        const existenteDest = todos.find(
          i => i.jogador === destinatario && i.item_catalogo === remetente.item_catalogo
        );

        if (existenteDest) {
          updates.push({
            ...existenteDest,
            quantidade: existenteDest.quantidade + quantidade,
          });
        } else {
          const maxIndex = todos.length > 0 ? Math.max(...todos.map(i => i.index || 0)) : 0;
          creates.push({
            id: IdUtils.generateULID(),      // ✅ agora gera o ID
            index: maxIndex + 1,             // ✅ garante index único
            jogador: destinatario,
            item_catalogo: remetente.item_catalogo,
            quantidade,
          });
        }
      }

      if (updates.length) {
        const updated = await this.inventarioRepo.updateBatch(updates);
        todos = [
          ...todos.filter(i => !updates.some(u => u.index === i.index)),
          ...updated,
        ];
      }

      if (creates.length) {
        const created = await this.inventarioRepo.createBatch(
          creates.map(c => ({
            jogador: c.jogador,
            item_catalogo: c.item_catalogo,
            quantidade: c.quantidade,
            id: c.id,
            index: c.index,
          }))
        );
        todos = [...todos, ...created];
      }

      if (deletes.length) {
        await this.inventarioRepo.deleteBatch(deletes);
        todos = todos.filter(i => !deletes.includes(i.index));
      }

      alert('✅ Troca realizada com sucesso!');
      this.cancelar();
    } catch (err) {
      console.error('[TrocaDeItens] Erro na troca:', err);
      alert('❌ Erro ao processar a troca');
    } finally {
      this.processando = false;
    }
  }

  cancelar() {
    this.location.back();
  }
}

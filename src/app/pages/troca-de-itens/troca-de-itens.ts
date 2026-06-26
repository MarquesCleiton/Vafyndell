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
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORTAR AQUI

import { CatalogoDomain } from '../../domain/CatalogoDomain';
import { InventarioDomain } from '../../domain/InventarioDomain';
import { JogadorDomain } from '../../domain/jogadorDomain';
import { RegistroDomain } from '../../domain/RegistroDomain';
import { AuthService } from '../../core/auth/AuthService';
import { IdUtils } from '../../core/utils/IdUtils';
import { BaseRepositoryV2 } from '../../repositories/BaseRepositoryV2';

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
    MatIconModule, // ✅ ADICIONAR AQUI
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

  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');
  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  descricaoTransferencia: string = '';
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) { }

  async ngOnInit() {
    const user = AuthService.getUser();
    if (!user?.email) throw new Error('Usuário não autenticado');
    this.emailLogado = user.email;

    // 🔹 Apenas jogadores reais (exclui NPCs e o próprio)
    this.jogadores = (await this.jogadoresRepo.getLocal())
      .filter(j => j.email !== this.emailLogado)
      .filter(j => j.nome_do_jogador !== 'NPC');

    this.jogadoresFiltrados = [...this.jogadores];

    // BUG-09 fix: sincronizar Inventario e Catalogo antes de montar a lista
    // (evita transferir mais itens do que realmente possui em sessão multi-dispositivo)
    await BaseRepositoryV2.multiSync(['Inventario', 'Catalogo']);

    // 🔹 Carrega inventário e catálogo (agora sincronizados)
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

    // 🔹 Item pré-selecionado
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

  filtrarItensInventario() {
    const termo = this.filtroItem.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    this.inventarioFiltrado = this.inventario
      .map(i => {
        const jaAdicionado = this.itensTroca.some(t => t.item.id === i.id);
        return !jaAdicionado ? i : null;
      })
      .filter((i): i is InventarioDetalhado => i !== null)
      .filter(i =>
        termo
          ? (i.itemDetalhe?.nome || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(termo)
          : true
      );
  }

  adicionarItem() {
    if (!this.itemSelecionado) return;
    this.itensTroca.push({ item: this.itemSelecionado, quantidade: 1 });
    this.itemSelecionado = null;
    this.filtroItem = '';
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
  // Confirmar troca (alerta com unidade e registro padrão)
  // =========================================================
  // 🔹 Dentro do método confirmarTroca()
  async confirmarTroca() {
    if (!this.jogadorSelecionado) {
      alert('⚠️ Selecione um jogador destinatário!');
      return;
    }
    if (this.itensTroca.length === 0) {
      alert('⚠️ Adicione ao menos um item para trocar!');
      return;
    }

    // 🔹 Novo trecho: montar resumo para confirmação
    const descricaoExtra = (this.descricaoTransferencia || '').trim();
    const destinatarioPersonagem = this.jogadorSelecionado.personagem;

    let resumo = `🎁 Confirme a transferência para ${destinatarioPersonagem}\n\n`;
    for (const troca of this.itensTroca) {
      const item = troca.item.itemDetalhe;
      const nome = item?.nome || 'Item desconhecido';
      const unidade = item?.unidade_medida || 'un.';
      const antes = troca.item.quantidade;
      const depois = antes - troca.quantidade;
      resumo += `📦 ${nome}: ${antes} → ${depois} (-${troca.quantidade} ${unidade})\n`;
    }
    if (descricaoExtra) resumo += `\n📝 ${descricaoExtra}\n`;
    resumo += `\nDeseja realmente confirmar a transferência?`;

    // 🔹 Confirmação
    const confirmado = confirm(resumo);
    if (!confirmado) return;

    // 🔹 Continua o código original (sem modificações abaixo)
    this.processando = true;

    try {
      const destinatario = this.jogadorSelecionado.email;

      const remetenteJogador =
        (await this.jogadoresRepo.getLocal()).find(j => j.email === this.emailLogado);
      const remetentePersonagem = remetenteJogador?.personagem || 'Desconhecido';

      const todos = await this.inventarioRepo.getLocal();
      const updates: InventarioDomain[] = [];
      const creates: InventarioDomain[] = [];
      const deletes: string[] = [];
      const logEnvio: string[] = [];
      const logRecebimento: string[] = [];

      for (const troca of this.itensTroca) {
        const remetente = troca.item;
        const itemNome = remetente.itemDetalhe?.nome || 'Item desconhecido';
        const unidade = remetente.itemDetalhe?.unidade_medida || 'unidade';
        let quantidade = troca.quantidade;
        if (quantidade > remetente.quantidade) quantidade = remetente.quantidade;

        const qtdAntesRem = remetente.quantidade;
        const qtdDepoisRem = qtdAntesRem - quantidade;

        // 🔹 Histórico remetente
        const novaLinhaRem =
          `Quantidade: ${qtdAntesRem} → ${qtdDepoisRem} (-${quantidade} ${unidade})\n` +
          `Transferido para ${destinatarioPersonagem}` +
          (descricaoExtra ? `\n${descricaoExtra}` : '');

        const historicoRem = remetente.descricao
          ? `${novaLinhaRem}\n---\n${remetente.descricao.trim()}`
          : novaLinhaRem;

        const atualizadoRem: InventarioDomain = {
          ...remetente,
          quantidade: qtdDepoisRem,
          descricao: historicoRem,
        };

        if (atualizadoRem.quantidade > 0) updates.push(atualizadoRem);
        else deletes.push(remetente.id);

        // 🔹 Destinatário
        const existenteDest = todos.find(
          i => i.jogador === destinatario && i.item_catalogo === remetente.item_catalogo
        );

        let qtdAntesDest = 0;
        let qtdDepoisDest = 0;

        if (existenteDest) {
          qtdAntesDest = existenteDest.quantidade;
          qtdDepoisDest = existenteDest.quantidade + quantidade;
          const novaLinhaDest =
            `Quantidade: ${qtdAntesDest} → ${qtdDepoisDest} (+${quantidade} ${unidade})\n` +
            `Recebido de ${remetentePersonagem}` +
            (descricaoExtra ? `\n${descricaoExtra}` : '');
          const historicoDest = existenteDest.descricao
            ? `${novaLinhaDest}\n---\n${existenteDest.descricao.trim()}`
            : novaLinhaDest;

          updates.push({
            ...existenteDest,
            quantidade: qtdDepoisDest,
            descricao: historicoDest,
          });
        } else {
          qtdDepoisDest = quantidade;
          const novaDescricao =
            `Quantidade: 0 → ${qtdDepoisDest} (+${quantidade} ${unidade})\n` +
            `Recebido de ${remetentePersonagem}` +
            (descricaoExtra ? `\n${descricaoExtra}` : '');
          creates.push({
            id: IdUtils.generateULID(),
            index: Date.now(),
            jogador: destinatario,
            item_catalogo: remetente.item_catalogo,
            quantidade: qtdDepoisDest,
            descricao: novaDescricao,
          });
        }

        logEnvio.push(`🎒 ${itemNome}: ${qtdAntesRem} → ${qtdDepoisRem} (-${quantidade} ${unidade})`);
        logRecebimento.push(`🎒 ${itemNome}: ${qtdAntesDest} → ${qtdDepoisDest} (+${quantidade} ${unidade})`);
      }

      // 🧾 Registros com descrição extra
      const registroEnvio: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: this.emailLogado,
        alvo: destinatario,
        tipo: 'transferencia',
        acao: 'envio',
        detalhes:
          `📦 ${remetentePersonagem} transferiu itens para ${destinatarioPersonagem}\n` +
          logEnvio.join('\n') +
          (descricaoExtra ? `\n📝 ${descricaoExtra}` : ''),
        data: new Date().toISOString(),
      };

      const registroReceb: RegistroDomain = {
        id: IdUtils.generateULID(),
        jogador: destinatario,
        alvo: this.emailLogado,
        tipo: 'transferencia',
        acao: 'recebimento',
        detalhes:
          `🎁 ${destinatarioPersonagem} recebeu itens de ${remetentePersonagem}\n` +
          logRecebimento.join('\n') +
          (descricaoExtra ? `\n📝 ${descricaoExtra}` : ''),
        data: new Date().toISOString(),
      };

      await BaseRepositoryV2.batch({
        updateById: { Inventario: updates },
        create: {
          Inventario: creates,
          Registro: [registroEnvio, registroReceb],
        },
        deleteById: { Inventario: deletes.map(id => ({ id })) },
      });

      const mensagemAlerta =
        `🎁 Você transferiu itens para ${destinatarioPersonagem}\n` +
        logEnvio.join('\n') +
        (descricaoExtra ? `\n📝 ${descricaoExtra}` : '');

      alert(mensagemAlerta);
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

  ajustarQuantidade(index: number, delta: number) {
    const item = this.itensTroca[index];
    const max = item.item.quantidade;
    const novaQtd = Math.min(Math.max(1, item.quantidade + delta), max);
    this.itensTroca[index].quantidade = novaQtd;
  }

  validarQuantidadeTroca(index: number) {
    const item = this.itensTroca[index];
    const max = item.item.quantidade;
    if (item.quantidade > max) item.quantidade = max;
    if (item.quantidade < 1) item.quantidade = 1;
  }

  atualizarDisponiveis() {
    this.filtrarItensInventario();
  }

  ajustarQuantidadeMin(valor: number, minimo: number): number {
    return Math.max(valor, minimo);
  }

  ajustarQuantidadeMax(valor: number, maximo?: number): number {
    return Math.min(valor, maximo ?? valor);
  }

  atualizarQuantidade(it: { item: InventarioDetalhado; quantidade: number }) {
    // 🔹 Garante que a quantidade nunca passe do limite
    const max = it.item.quantidade;
    if (it.quantidade > max) {
      it.quantidade = max;
    }
    if (it.quantidade < 1) {
      it.quantidade = 1;
    }

    // 🔹 Atualiza imediatamente o inventário filtrado
    this.filtrarItensInventario();
  }

  getRestante(it: { item: InventarioDetalhado; quantidade: number }): number {
    return Math.max(0, it.item.quantidade - it.quantidade);
  }

}

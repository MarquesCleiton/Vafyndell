import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { CatalogoDomain } from '../../../domain/CatalogoDomain';
import { InventarioDomain } from '../../../domain/InventarioDomain';
import { RegistroDomain } from '../../../domain/RegistroDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { AuthService } from '../../../core/auth/AuthService';
import { IdUtils } from '../../../core/utils/IdUtils';
import { Location } from '@angular/common';
import { JogadorDomain } from '../../../domain/jogadorDomain';

@Component({
  selector: 'app-cadastro-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatInputModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './cadastro-inventario.html',
  styleUrls: ['./cadastro-inventario.css'],
})
export class CadastroInventario implements OnInit {
  catalogoItens: CatalogoDomain[] = [];
  catalogoFiltrado: CatalogoDomain[] = [];
  selecionado: CatalogoDomain | null = null;
  filtro = '';
  quantidade = 1;
  descricao = '';
  salvando = false;
  editando = false;
  inventarioAtual: InventarioDomain | null = null;

  private catalogoRepo = new BaseRepositoryV2<CatalogoDomain>('Catalogo');
  private inventarioRepo = new BaseRepositoryV2<InventarioDomain>('Inventario');
  private registroRepo = new BaseRepositoryV2<RegistroDomain>('Registro');
  private jogadoresRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) { }

  async ngOnInit() {
    try {
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;

      this.catalogoRepo.sync().then(async (updated) => {
        if (updated) {
          this.catalogoItens = await this.catalogoRepo.getLocal();
          this.catalogoFiltrado = this.catalogoItens;
        }
      });

      const idParam = this.route.snapshot.paramMap.get('id');
      if (idParam) {
        this.editando = true;
        const user = AuthService.getUser();
        if (!user?.email) throw new Error('Usuário não autenticado.');

        const locais = await this.inventarioRepo.getLocal();
        this.inventarioAtual =
          locais.find(
            (i) => String(i.id) === String(idParam) && i.jogador === user.email
          ) || null;

        if (this.inventarioAtual) {
          await this.carregarItemSelecionado(this.inventarioAtual);
          this.descricao = ''; // 🧹 limpa o campo no modo edição
        }
      }
    } catch (err) {
      console.error('[CadastroInventario] ❌ Erro ao carregar:', err);
    }
  }

  private async carregarItemSelecionado(inventario: InventarioDomain) {
    if (!this.catalogoItens.length) {
      this.catalogoItens = await this.catalogoRepo.getLocal();
      this.catalogoFiltrado = this.catalogoItens;
    }

    this.selecionado =
      this.catalogoItens.find(
        (c) => String(c.id) === String(inventario.item_catalogo)
      ) || null;

    this.quantidade = inventario.quantidade;
    this.filtro = this.selecionado?.nome || '';
  }

  filtrarItens() {
    const normalizar = (t: string) =>
      (t || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const termo = normalizar(this.filtro || '');
    this.catalogoFiltrado = termo
      ? this.catalogoItens.filter((c) => normalizar(c.nome).includes(termo))
      : [...this.catalogoItens];
  }

  selecionarItem(item: CatalogoDomain) {
    this.selecionado = item;
    this.filtro = item.nome;
  }

  incrementar() {
    this.quantidade++;
  }

  decrementar() {
    // BUG-12 fix: quantidade mínima é 1 (0 não tem semântica válida para adicionar item)
    this.quantidade = Math.max(1, this.quantidade - 1);
  }

  cancelar() {
    this.location.back();
  }

  novoItem() {
    this.router.navigate(['/cadastro-item-catalogo']);
  }

  async salvar(form: NgForm) {
    if (form.invalid || !this.selecionado) return;

    try {
      this.salvando = true;

      const user = AuthService.getUser();
      if (!user?.email) throw new Error('Usuário não autenticado');
      const jogadorEmail = user.email;

      const jogador =
        (await this.jogadoresRepo.getLocal()).find(
          (j) => j.email === jogadorEmail
        ) || null;
      const personagem = jogador?.personagem || 'Você';

      const unidade = this.selecionado?.unidade_medida || 'unidade(s)';
      const itemNome = `${this.selecionado?.nome || 'Item desconhecido'}`;
      const todos = await this.inventarioRepo.getLocal();

      const existente = todos.find(
        (i) =>
          i.jogador === jogadorEmail &&
          String(i.item_catalogo) === String(this.selecionado!.id)
      );

      const descricaoTrim = this.descricao.trim();

      let inventarioFinal: InventarioDomain;
      let registro: RegistroDomain;
      let resumoUsuario = '';
      let acaoRegistro = '';
      let acaoUsuario = '';

      // 🧾 Monta linha de descrição
      const qtdAntes = existente ? existente.quantidade : 0;
      const qtdDepois = this.editando
        ? this.quantidade
        : qtdAntes + this.quantidade;
      const delta = qtdDepois - qtdAntes;

      const novaLinhaDescricao =
        `Quantidade: ${qtdAntes} → ${qtdDepois} (${delta >= 0 ? '+' : ''}${delta} ${unidade})` +
        (descricaoTrim ? `\n${descricaoTrim}` : '');

      // 📊 Define ação e mensagens
      if (delta > 0 && !this.editando)
        acaoUsuario = 'adicionará um item ao inventário';
      else if (delta > 0 && this.editando)
        acaoUsuario = 'editará um item ao inventário';
      else if (delta < 0)
        acaoUsuario = 'consumirá um item do inventário';
      else if (qtdDepois === 0)
        acaoUsuario = 'removerá o item do inventário';
      else
        acaoUsuario = 'atualizará o inventário';

      resumoUsuario =
        `🧍‍♂️ Você ${acaoUsuario}\n` +
        `🎒 ${itemNome}: ${qtdAntes} → ${qtdDepois} (${delta >= 0 ? '+' : ''}${delta} ${unidade})\n` +
        (descricaoTrim ? `📝 ${descricaoTrim}` : '');

      // 🧾 Registro formal
      if (delta > 0 && !this.editando)
        acaoRegistro = 'adicionou um item ao inventário';
      else if (delta > 0 && this.editando)
        acaoRegistro = 'editou um item do inventário';
      else if (delta < 0)
        acaoRegistro = 'consumiu um item do inventário';
      else if (qtdDepois === 0)
        acaoRegistro = 'removeu o item do inventário';
      else
        acaoRegistro = 'atualizou o inventário';

      // 🧠 Confirmação antes de salvar
      const confirmar = confirm(
        `${resumoUsuario}\n\nDeseja confirmar a operação?`
      );
      if (!confirmar) {
        this.salvando = false;
        return;
      }

      // 🔧 Montagem do inventário final
      const historicoAnterior = existente?.descricao?.trim() || '';
      const novaDescricao = this.editando
        ? novaLinhaDescricao +
        (historicoAnterior ? `\n---\n${historicoAnterior}` : '')
        : novaLinhaDescricao +
        (historicoAnterior ? `\n---\n${historicoAnterior}` : '');

      inventarioFinal = existente
        ? {
          ...existente,
          quantidade: qtdDepois,
          descricao: novaDescricao,
        }
        : {
          id: IdUtils.generateULID(),
          index: Date.now(),
          jogador: jogadorEmail,
          item_catalogo: this.selecionado.id,
          quantidade: qtdDepois,
          descricao: novaDescricao,
        };

      registro = {
        id: IdUtils.generateULID(),
        jogador: jogadorEmail,
        alvo: jogadorEmail,
        tipo: 'inventario',
        acao: acaoRegistro,
        detalhes:
          `📦 ${personagem} ${acaoRegistro}\n` +
          `🎒 ${itemNome}: ${qtdAntes} → ${qtdDepois} (${delta >= 0 ? '+' : ''}${delta} ${unidade})\n` +
          (descricaoTrim ? `📝 Descrição: ${descricaoTrim}` : ''),
        data: new Date().toISOString(),
      };

      // ⚡ Executa tudo em uma única operação otimizada
      const payload: any = {
        create: { Registro: [registro] },
      };

      if (existente) {
        // Atualiza o inventário existente
        payload.updateById = { Inventario: [inventarioFinal] };
      } else {
        // Cria novo inventário e registro juntos
        payload.create.Inventario = [inventarioFinal];
      }

      await BaseRepositoryV2.batch(payload);

      alert(
        `✅ Operação concluída!\n\n${personagem} ${acaoRegistro}\n🎒 ${itemNome}: ${qtdAntes} → ${qtdDepois} (${delta >= 0 ? '+' : ''}${delta} ${unidade})`
      );

      this.router.navigate(['/inventario-jogador']);

    } catch (err) {
      console.error('[CadastroInventario] ❌ Erro ao salvar:', err);
      alert('❌ Erro ao salvar item.');
    } finally {
      this.salvando = false;
    }
  }

  displayFn(item?: CatalogoDomain): string {
    return item ? item.nome : '';
  }
}

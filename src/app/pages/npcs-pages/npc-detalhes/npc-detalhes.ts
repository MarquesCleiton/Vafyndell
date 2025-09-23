import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';

import { NpcDomain } from '../../../domain/NpcDomain';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { BaseRepositoryV2 } from '../../../repositories/BaseRepositoryV2';
import { IdUtils } from '../../../core/utils/IdUtils';
import { ImageModal } from '../../image-modal/image-modal';

@Component({
  selector: 'app-npc-detalhes',
  standalone: true,
  imports: [CommonModule, ImageModal],
  templateUrl: './npc-detalhes.html',
  styleUrls: ['./npc-detalhes.css'],
})
export class NpcDetalhes implements OnInit {
  npc: NpcDomain | null = null;
  carregando = true;

  processandoEditar = false;
  processandoExcluir = false;
  processandoAdicionar = false;

  // controle do modal
  imagemSelecionada: string | null = null;
  modalAberto = false;

  private npcRepo = new BaseRepositoryV2<NpcDomain>('NPCs');
  private jogadorRepo = new BaseRepositoryV2<JogadorDomain>('Personagem');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) { }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/npcs']);
      return;
    }

    try {
      this.carregando = true;

      // 1️⃣ cache first
      const locais = await this.npcRepo.getLocal();
      this.npc = locais.find(n => String(n.id) === id) || null;

      if (this.npc) {
        // 2️⃣ sync paralelo
        this.npcRepo.sync().then(async updated => {
          if (updated) {
            const atualizados = await this.npcRepo.getLocal();
            const atualizado = atualizados.find(n => String(n.id) === id);
            if (atualizado) this.npc = { ...atualizado };
          }
        });
      } else {
        // 3️⃣ fallback online
        const online = await this.npcRepo.forceFetch();
        this.npc = online.find(n => String(n.id) === id) || null;
      }
    } catch (err) {
      console.error('[NpcDetalhes] Erro ao carregar NPC:', err);
    } finally {
      this.carregando = false;
    }
  }

  cancelar() {
    this.location.back();
  }

  editarNpc() {
    if (!this.npc) return;
    this.processandoEditar = true;

    setTimeout(() => {
      this.router.navigate(['/cadastro-npc', this.npc!.id]); // 🚀 sem returnUrl
      this.processandoEditar = false;
    }, 300);
  }

  async excluirNpc() {
    if (!this.npc) return;
    const confirmacao = confirm(`🗑️ Deseja realmente excluir "${this.npc.nome}"?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;
    try {
      // ✅ agora deleta por id
      await this.npcRepo.delete(this.npc.id);
      alert('✅ NPC excluído com sucesso!');
      this.router.navigate(['/npcs']);
    } catch (err) {
      console.error('[NpcDetalhes] Erro ao excluir NPC:', err);
      alert('❌ Erro ao excluir NPC. Veja o console.');
    } finally {
      this.processandoExcluir = false;
    }
  }

  async adicionarAoCampo() {
    if (!this.npc) return;
    this.processandoAdicionar = true;

    try {
      let jogadores = await this.jogadorRepo.getLocal();

      // 🔄 sync em paralelo
      this.jogadorRepo.sync().then(async updated => {
        if (updated) jogadores = await this.jogadorRepo.getLocal();
      });

      // gera nome incremental: "1 - Goblin", "2 - Goblin", etc
      const baseName = this.npc.nome.trim();
      const existentes = jogadores
        .map(j => {
          const nome = String(j.personagem || '').trim();
          const match = nome.match(/^(\d+) - (.+)$/);
          return match && match[2] === baseName ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);

      const proximoNumero = existentes.length > 0 ? Math.max(...existentes) + 1 : 1;

      const novoNpcJogador: JogadorDomain = {
        id: IdUtils.generateULID(),
        email: '',
        imagem: this.npc.imagem || '',
        nome_do_jogador: 'NPC',
        personagem: `${proximoNumero} - ${baseName}`,
        alinhamento: this.npc.alinhamento || '',
        pontos_de_vida: this.npc.pontos_de_vida,
        classe_de_armadura: this.npc.classe_armadura,
        forca: this.npc.forca,
        destreza: this.npc.destreza,
        constituicao: this.npc.constituicao,
        inteligencia: this.npc.inteligencia,
        sabedoria: this.npc.sabedoria,
        carisma: 0,
        energia: this.npc.energia,
        nivel: 1,
        xp: this.npc.xp,
        dano_tomado: 0,
        tipo_jogador: 'NPC',
        efeitos_temporarios: '',
        registo_de_jogo: '',

        classificacao: this.npc.classificacao,
        tipo: this.npc.tipo,
        descricao: this.npc.descricao,
        ataques: this.npc.ataques,
      };

      await this.jogadorRepo.create(novoNpcJogador);
      alert(`✅ ${novoNpcJogador.personagem} adicionado ao campo de batalha!`);
    } catch (err) {
      console.error('[NpcDetalhes] Erro ao adicionar NPC no campo de batalha:', err);
      alert('❌ Erro ao adicionar NPC. Veja o console.');
    } finally {
      this.processandoAdicionar = false;
    }
  }

  abrirImagem(src: string) {
    this.imagemSelecionada = src;
    this.modalAberto = true;
  }
}

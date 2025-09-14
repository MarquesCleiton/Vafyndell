import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { NpcDomain } from '../../../domain/NpcDomain';
import { BaseRepository } from '../../../repositories/BaseRepository';
import { JogadorDomain } from '../../../domain/jogadorDomain';
import { IdUtils } from '../../../core/utils/IdUtils';


@Component({
  selector: 'app-npc-detalhes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './npc-detalhes.html',
  styleUrls: ['./npc-detalhes.css'],
})
export class NpcDetalhes implements OnInit {
  npc: NpcDomain | null = null;
  carregando = true;
  processandoEditar = false;
  processandoExcluir = false;
  processandoAdicionar = false;

  // ✅ Reuso do BaseRepository
  private npcRepo = new BaseRepository<NpcDomain>('NPCs', 'NPCs');
  private jogadorRepo = new BaseRepository<JogadorDomain>('Personagem', 'Personagem');

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

      // 1. Busca local
      const locais = await this.npcRepo.getLocal();
      let encontrado = locais.find(n => String(n.id) === String(id)) || null;
      if (encontrado) this.npc = { ...encontrado };

      // 2. Sync em paralelo
      this.npcRepo.sync().then(async updated => {
        if (updated) {
          const atualizados = await this.npcRepo.getLocal();
          const atualizado = atualizados.find(n => String(n.id) === String(id));
          if (atualizado) {
            if (this.npc) Object.assign(this.npc, atualizado);
            else this.npc = { ...atualizado };
          }
        }
      });

      // 3. Se não achou local, força fetch
      if (!encontrado) {
        const online = await this.npcRepo.forceFetch();
        encontrado = online.find(n => String(n.id) === String(id)) || null;
        if (encontrado) this.npc = { ...encontrado };
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
      this.router.navigate(['/cadastro-npc', this.npc!.id], {
        queryParams: { returnUrl: this.router.url },
      });
      this.processandoEditar = false;
    }, 300);
  }

  async excluirNpc() {
    if (!this.npc) return;
    const confirmacao = confirm(`🗑️ Deseja realmente excluir "${this.npc.nome}"?`);
    if (!confirmacao) return;

    this.processandoExcluir = true;
    try {
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

  /** ➕ Adicionar NPC como "jogador" no campo de batalha */
  /** ➕ Adicionar NPC como "jogador" no campo de batalha */
  async adicionarAoCampo() {
    if (!this.npc) return;
    this.processandoAdicionar = true;

    try {
      // 1. Carrega jogadores do cache (cache first)
      let jogadores = await this.jogadorRepo.getLocal();

      // 2. Sincroniza em paralelo → se atualizar, substitui
      this.jogadorRepo.sync().then(async updated => {
        if (updated) {
          jogadores = await this.jogadorRepo.getLocal();
        }
      });

      // 3. Calcula próximo número baseado no cache atual (rápido)
      const baseName = this.npc.nome.trim();
      const existentes = jogadores
        .map(j => j.personagem.match(/^(\d+) - (.+)$/))
        .filter(m => m && m[2] === baseName)
        .map(m => parseInt(m![1], 10));

      const proximoNumero = existentes.length > 0 ? Math.max(...existentes) + 1 : 1;

      // 4. Cria registro de jogador NPC
      const novoNpcJogador: JogadorDomain = {
        index: 0, // servidor define
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

}

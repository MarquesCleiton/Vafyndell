import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { NpcRepository } from '../../repositories/NpcRepository';
import { NpcDomain } from '../../domain/NpcDomain';
import { JogadorRepository } from '../../repositories/JogadorRepository';
import { JogadorDomain } from '../../domain/jogadorDomain';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/npcs']);
      return;
    }

    try {
      this.carregando = true;

      // 1. Busca local
      const locais = await NpcRepository.getLocalNpcs();
      let encontrado = locais.find(n => String(n.id) === String(id)) || null;
      if (encontrado) this.npc = { ...encontrado };

      // 2. Sync em paralelo
      NpcRepository.syncNpcs().then(async updated => {
        if (updated) {
          const atualizados = await NpcRepository.getLocalNpcs();
          const atualizado = atualizados.find(n => String(n.id) === String(id));
          if (atualizado) this.npc = { ...atualizado };
        }
      });

      // 3. Se não achou local, força fetch
      if (!encontrado) {
        const online = await NpcRepository.forceFetchNpcs();
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
      await NpcRepository.deleteNpc(this.npc.id);
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
  async adicionarAoCampo() {
    if (!this.npc) return;
    this.processandoAdicionar = true;

    try {
      // 1. Carrega jogadores existentes
      const jogadores = await JogadorRepository.getAllJogadores();

      // 2. Pega base do nome e procura quantos já existem
      const baseName = this.npc.nome.trim();
      const regex = new RegExp(`^(\\d+) - ${baseName}$`, 'i');
      const existentes = jogadores.filter(j => regex.test(j.personagem));

      // 3. Calcula próximo número
      let proximoNumero = 1;
      if (existentes.length > 0) {
        const numeros = existentes
          .map(j => {
            const match = j.personagem.match(/^(\d+) -/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(n => !isNaN(n));
        proximoNumero = Math.max(...numeros) + 1;
      }

      // 4. Calcula novo ID
      const maxId = jogadores.length > 0 ? Math.max(...jogadores.map(j => j.id || 0)) : 0;
      const novoId = maxId + 1;

      // 5. Cria registro de jogador NPC com atributos herdados
      const novoNpcJogador: JogadorDomain = {
        index: novoId,
        id: novoId,
        email: '', // NPC não tem email
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

        // 🔑 novos campos herdados do NPC
        classificacao: this.npc.classificacao,
        tipo: this.npc.tipo,
        descricao: this.npc.descricao,
        ataques: this.npc.ataques,
      };

      await JogadorRepository.createJogador(novoNpcJogador);
      alert(`✅ ${novoNpcJogador.personagem} adicionado ao campo de batalha!`);

    } catch (err) {
      console.error('[NpcDetalhes] Erro ao adicionar NPC no campo de batalha:', err);
      alert('❌ Erro ao adicionar NPC. Veja o console.');
    } finally {
      this.processandoAdicionar = false;
    }
  }
}

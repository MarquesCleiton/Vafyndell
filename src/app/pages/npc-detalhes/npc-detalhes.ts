import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { NpcRepository } from '../../repositories/NpcRepository';
import { NpcDomain } from '../../domain/NpcDomain';

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
}

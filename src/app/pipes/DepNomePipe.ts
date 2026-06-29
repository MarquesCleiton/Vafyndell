import { Pipe, PipeTransform } from '@angular/core';
import { HabilidadeDomain } from '../domain/skilltreeDomains/HabilidadeDomain';

@Pipe({ name: 'depNome', standalone: true })
export class DepNomePipe implements PipeTransform {
  transform(habilidades: HabilidadeDomain[], depId: string | null): string {
    if (!depId) return 'Nenhuma';
    return habilidades.find(h => h.id === depId)?.habilidade ?? '?';
  }
}

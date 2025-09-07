import { Pipe, PipeTransform } from '@angular/core';
import { CatalogoDomain } from '../domain/CatalogoDomain';

@Pipe({ name: 'filtroCatalogo', standalone: true })
export class FiltroCatalogoPipe implements PipeTransform {
  transform(itens: CatalogoDomain[], filtro: string): CatalogoDomain[] {
    if (!filtro) return itens;
    const termo = filtro.toLowerCase();
    return itens.filter(i =>
      (i.nome || '').toLowerCase().includes(termo) ||
      (i.categoria || '').toLowerCase().includes(termo)
    );
  }
}

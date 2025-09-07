import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventarioJogador } from './inventario-jogador';

describe('InventarioJogador', () => {
  let component: InventarioJogador;
  let fixture: ComponentFixture<InventarioJogador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioJogador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InventarioJogador);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EdicaoJogador } from './edicao-jogador';

describe('EdicaoJogador', () => {
  let component: EdicaoJogador;
  let fixture: ComponentFixture<EdicaoJogador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EdicaoJogador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EdicaoJogador);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

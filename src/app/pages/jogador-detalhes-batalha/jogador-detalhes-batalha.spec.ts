import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JogadorDetalhesBatalha } from './jogador-detalhes-batalha';

describe('JogadorDetalhesBatalha', () => {
  let component: JogadorDetalhesBatalha;
  let fixture: ComponentFixture<JogadorDetalhesBatalha>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JogadorDetalhesBatalha]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JogadorDetalhesBatalha);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Jogador } from './jogador';

describe('Jogador', () => {
  let component: Jogador;
  let fixture: ComponentFixture<Jogador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Jogador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Jogador);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

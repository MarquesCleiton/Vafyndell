import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisaoJogadores } from './visao-jogadores';

describe('VisaoJogadores', () => {
  let component: VisaoJogadores;
  let fixture: ComponentFixture<VisaoJogadores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisaoJogadores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisaoJogadores);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

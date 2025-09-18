import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrocaDeItens } from './troca-de-itens';

describe('TrocaDeItens', () => {
  let component: TrocaDeItens;
  let fixture: ComponentFixture<TrocaDeItens>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrocaDeItens]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrocaDeItens);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

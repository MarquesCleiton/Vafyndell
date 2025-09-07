import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CadastroInventario } from './cadastro-inventario';

describe('CadastroInventario', () => {
  let component: CadastroInventario;
  let fixture: ComponentFixture<CadastroInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadastroInventario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CadastroInventario);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

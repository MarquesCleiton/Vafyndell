import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CadastroItemCatalogo } from './cadastro-item-catalogo';

describe('CadastroItemCatalogo', () => {
  let component: CadastroItemCatalogo;
  let fixture: ComponentFixture<CadastroItemCatalogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadastroItemCatalogo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CadastroItemCatalogo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

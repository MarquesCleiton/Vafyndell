import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CadastroNpc } from './cadastro-npc';

describe('CadastroNpc', () => {
  let component: CadastroNpc;
  let fixture: ComponentFixture<CadastroNpc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CadastroNpc]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CadastroNpc);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

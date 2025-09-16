import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CriarAnotacao } from './criar-anotacao';

describe('CriarAnotacao', () => {
  let component: CriarAnotacao;
  let fixture: ComponentFixture<CriarAnotacao>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriarAnotacao]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CriarAnotacao);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

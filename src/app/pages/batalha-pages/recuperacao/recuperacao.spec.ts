import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recuperacao } from './recuperacao';

describe('Recuperacao', () => {
  let component: Recuperacao;
  let fixture: ComponentFixture<Recuperacao>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recuperacao]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recuperacao);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

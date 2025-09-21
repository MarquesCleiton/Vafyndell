import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EdicaoSkilltree } from './edicao-skilltree';

describe('EdicaoSkilltree', () => {
  let component: EdicaoSkilltree;
  let fixture: ComponentFixture<EdicaoSkilltree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EdicaoSkilltree]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EdicaoSkilltree);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

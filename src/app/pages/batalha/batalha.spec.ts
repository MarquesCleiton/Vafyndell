import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Batalha } from './batalha';

describe('Batalha', () => {
  let component: Batalha;
  let fixture: ComponentFixture<Batalha>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Batalha]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Batalha);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

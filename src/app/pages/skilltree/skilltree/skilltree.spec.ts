import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Skilltree } from './skilltree';

describe('Skilltree', () => {
  let component: Skilltree;
  let fixture: ComponentFixture<Skilltree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Skilltree]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Skilltree);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

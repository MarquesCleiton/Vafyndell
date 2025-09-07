import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NpcDetalhes } from './npc-detalhes';

describe('NpcDetalhes', () => {
  let component: NpcDetalhes;
  let fixture: ComponentFixture<NpcDetalhes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NpcDetalhes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NpcDetalhes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

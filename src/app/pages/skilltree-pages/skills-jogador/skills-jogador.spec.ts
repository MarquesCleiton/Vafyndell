import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsJogador } from './skills-jogador';

describe('SkillsJogador', () => {
  let component: SkillsJogador;
  let fixture: ComponentFixture<SkillsJogador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkillsJogador]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SkillsJogador);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

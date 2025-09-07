import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NPCs } from './npcs';

describe('NPCs', () => {
  let component: NPCs;
  let fixture: ComponentFixture<NPCs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NPCs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NPCs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

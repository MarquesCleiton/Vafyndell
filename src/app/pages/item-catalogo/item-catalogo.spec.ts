import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemCatalogo } from './item-catalogo';

describe('ItemCatalogo', () => {
  let component: ItemCatalogo;
  let fixture: ComponentFixture<ItemCatalogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCatalogo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemCatalogo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemInventario } from './item-inventario';

describe('ItemInventario', () => {
  let component: ItemInventario;
  let fixture: ComponentFixture<ItemInventario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemInventario]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemInventario);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

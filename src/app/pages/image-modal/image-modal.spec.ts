import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageModal } from './image-modal';

describe('ImageModal', () => {
  let component: ImageModal;
  let fixture: ComponentFixture<ImageModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

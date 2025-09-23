import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

@Component({
  selector: 'app-image-modal',
  standalone: true,
  templateUrl: './image-modal.html',
  styleUrls: ['./image-modal.css']
})
export class ImageModal {
  @Input() imagem: string | null = null;
  @Input() aberto = false;
  @Output() fecharModal = new EventEmitter<void>();

  zoom = 1;
  posX = 0;
  posY = 0;
  dragging = false;
  startX = 0;
  startY = 0;

  // pinch
  pinchStartDist = 0;
  pinchActive = false;

  fechar() {
    this.fecharModal.emit();
    this.reset();
  }

  reset() {
    this.zoom = 1;
    this.posX = 0;
    this.posY = 0;
  }


  ajustarZoom(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.zoom = Math.min(Math.max(this.zoom + delta, 0.5), 3);
  }

  // ===== MOUSE =====
  onMouseDown(event: MouseEvent) {
    if (this.zoom <= 1) return;
    this.dragging = true;
    this.startX = event.clientX - this.posX;
    this.startY = event.clientY - this.posY;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.dragging) return;
    this.posX = event.clientX - this.startX;
    this.posY = event.clientY - this.startY;
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.dragging = false;
  }

  // ===== TOUCH =====
  onTouchStart(event: TouchEvent) {
    if (event.touches.length === 1 && this.zoom > 1) {
      // arrastar
      this.dragging = true;
      this.startX = event.touches[0].clientX - this.posX;
      this.startY = event.touches[0].clientY - this.posY;
    } else if (event.touches.length === 2) {
      // pinch
      this.pinchActive = true;
      this.pinchStartDist = this.getDistance(event.touches);
    }
  }

  onTouchMove(event: TouchEvent) {
    if (this.dragging && event.touches.length === 1) {
      this.posX = event.touches[0].clientX - this.startX;
      this.posY = event.touches[0].clientY - this.startY;
    } else if (this.pinchActive && event.touches.length === 2) {
      const newDist = this.getDistance(event.touches);
      const scaleChange = newDist / this.pinchStartDist;
      this.zoom = Math.min(Math.max(this.zoom * scaleChange, 0.5), 3);
      this.pinchStartDist = newDist;
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (event.touches.length === 0) {
      this.dragging = false;
      this.pinchActive = false;
    }
  }

  private getDistance(touches: TouchList): number {
    const [t1, t2] = [touches[0], touches[1]];
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

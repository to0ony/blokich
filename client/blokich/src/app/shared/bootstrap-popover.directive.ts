import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';

declare var bootstrap: any;

@Directive({
  selector: '[appPopover]',
  standalone: true,
})
export class BootstrapPopoverDirective implements OnInit, OnDestroy {
  @Input('appPopover') content!: string;
  @Input() popoverTitle: string = '';
  @Input() popoverTrigger: string = 'focus';
  @Input() popoverHtml: boolean = true;

  private popoverInstance: any;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    const nativeEl = this.el.nativeElement;

    this.renderer.setAttribute(nativeEl, 'data-bs-toggle', 'popover');
    this.renderer.setAttribute(nativeEl, 'data-bs-content', this.content);
    this.renderer.setAttribute(
      nativeEl,
      'data-bs-trigger',
      this.popoverTrigger,
    );
    this.renderer.setAttribute(
      nativeEl,
      'data-bs-html',
      this.popoverHtml.toString(),
    );

    if (this.popoverTitle) {
      this.renderer.setAttribute(nativeEl, 'title', this.popoverTitle);
    }

    this.popoverInstance = new bootstrap.Popover(nativeEl);
  }

  ngOnDestroy(): void {
    if (this.popoverInstance) {
      this.popoverInstance.dispose();
    }
  }
}

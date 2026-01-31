import { App, setIcon, setTooltip, Platform } from 'obsidian';
import type I18nPlusPlugin from '../main';
import { t } from '../lang';

export class I18nFloatingWidget {
    private app: App;
    private plugin: I18nPlusPlugin;
    private containerEl: HTMLElement | null = null;
    private bubbleEl: HTMLElement;
    private panelEl: HTMLElement;
    private contentContainer: HTMLElement;
    private headerTitle: HTMLElement;

    private isExpanded: boolean = false;

    // Drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private initialLeft = 0;
    private initialTop = 0;
    private hasMoved = false;

    // Current View Renderer
    private currentRenderer: ((container: HTMLElement) => void) | null = null;

    constructor(app: App, plugin: I18nPlusPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    onload() {
        this.createWidget();
    }

    onunload() {
        if (this.containerEl) {
            this.containerEl.remove();
            this.containerEl = null;
        }
    }

    private createWidget() {
        // Main container (fixed position)
        this.containerEl = document.body.createDiv({ cls: 'i18n-plus-floating-widget' });

        // Initial state: hidden (opened via command/ribbon)
        this.containerEl.style.display = 'none';

        // Calculate center position (assuming default panel size approx 800x600)
        // We set styles directly, assuming panel mode is default target size
        const defaultWidth = 800;
        const defaultHeight = 600;
        const initLeft = Math.max(0, (window.innerWidth - defaultWidth) / 2);
        const initTop = Math.max(0, (window.innerHeight - defaultHeight) / 2);

        this.containerEl.style.left = `${initLeft}px`;
        this.containerEl.style.top = `${initTop}px`;

        // === Bubble Mode ===
        this.bubbleEl = this.containerEl.createDiv({ cls: 'i18n-plus-fw-bubble' });
        setIcon(this.bubbleEl, 'globe');
        setTooltip(this.bubbleEl, 'i18n+');

        // Bubble Events
        this.enableDrag(this.bubbleEl);
        this.bubbleEl.addEventListener('click', (e) => {
            if (!this.hasMoved) {
                this.expand();
            }
        });

        // === Panel Mode ===
        this.panelEl = this.containerEl.createDiv({ cls: 'i18n-plus-fw-panel' });
        this.panelEl.style.display = 'none';

        // Header
        const header = this.panelEl.createDiv({ cls: 'i18n-plus-fw-header' });

        // Drag Handle (Title)
        this.headerTitle = header.createEl('span', { text: 'i18n+', cls: 'i18n-plus-fw-title' });
        this.enableDrag(header); // Allow dragging by header

        // Controls
        const controls = header.createDiv({ cls: 'i18n-plus-fw-controls' });

        // Minimize Button
        const minBtn = controls.createEl('div', { cls: 'clickable-icon i18n-plus-fw-btn' });
        setIcon(minBtn, 'minimize-2');
        setTooltip(minBtn, t('action.cancel')); // Use generic "Cancel" or "Minimize" if available, logic implies shrinking
        minBtn.onclick = (e) => {
            e.stopPropagation();
            this.collapse();
        };

        // Close Button
        const closeBtn = controls.createEl('div', { cls: 'clickable-icon i18n-plus-fw-btn' });
        setIcon(closeBtn, 'x');
        setTooltip(closeBtn, t('editor.close'));
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.hide();
        };

        // Content Area
        this.contentContainer = this.panelEl.createDiv({ cls: 'i18n-plus-fw-content' });
    }

    /**
     * Set the content renderer and automatically expand the widget
     * @param renderFn Function that populates the container
     * @param title Optional title to show in header
     */
    showView(renderFn: (container: HTMLElement) => void, title?: string) {
        this.currentRenderer = renderFn;
        if (title) this.headerTitle.innerText = title;

        this.renderContent();

        // Ensure widget is visible and expanded
        this.show();
        if (!this.isExpanded) {
            this.expand();
        }
    }

    /**
     * Refresh the current view
     */
    refresh() {
        if (this.currentRenderer) {
            this.renderContent();
        }
    }

    /** Ensure widget is visible in DOM */
    show() {
        if (this.containerEl) {
            this.containerEl.style.display = 'flex';
        }
    }

    /** Hide widget completely */
    hide() {
        if (this.containerEl) {
            this.containerEl.style.display = 'none';
        }
        // Reset to collapsed state internally so next open expands properly if needed
        this.isExpanded = false;
        if (this.panelEl) this.panelEl.style.display = 'none';
        if (this.bubbleEl) this.bubbleEl.style.display = 'flex';
    }

    private renderContent() {
        this.contentContainer.empty();
        if (this.currentRenderer) {
            this.currentRenderer(this.contentContainer);
        }
    }

    expand() {
        this.isExpanded = true;
        this.bubbleEl.style.display = 'none';
        this.panelEl.style.display = 'flex';

        // Re-clamp position if off-screen upon expansion (safety check)
        this.ensureOnScreen();
    }

    collapse() {
        this.isExpanded = false;
        this.panelEl.style.display = 'none';
        this.bubbleEl.style.display = 'flex';
    }

    private ensureOnScreen() {
        if (!this.containerEl) return;
        const rect = this.containerEl.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let newLeft = rect.left;
        let newTop = rect.top;

        if (newLeft + rect.width > winW) newLeft = Math.max(0, winW - rect.width);
        if (newTop + rect.height > winH) newTop = Math.max(0, winH - rect.height);

        this.containerEl.style.left = `${newLeft}px`;
        this.containerEl.style.top = `${newTop}px`;
    }

    // ========================================================================
    // Drag & Drop Logic
    // ========================================================================

    private enableDrag(element: HTMLElement) {
        element.addEventListener('mousedown', this.onDragStart.bind(this));
    }

    private onDragStart(e: MouseEvent) {
        // Only left click
        if (e.button !== 0) return;

        // Don't drag if clicking buttons
        if ((e.target as HTMLElement).closest('.clickable-icon')) return;

        this.isDragging = true;
        this.hasMoved = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        const rect = this.containerEl!.getBoundingClientRect();
        this.initialLeft = rect.left;
        this.initialTop = rect.top;

        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);

        e.preventDefault();
        e.stopPropagation();
    }

    private onDragMove = (e: MouseEvent) => {
        if (!this.isDragging) return;

        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            this.hasMoved = true;
        }

        let newLeft = this.initialLeft + dx;
        let newTop = this.initialTop + dy;

        // Constraint logic: Keep completely within window
        const rect = this.containerEl!.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        this.containerEl!.style.left = `${newLeft}px`;
        this.containerEl!.style.top = `${newTop}px`;
    };

    private onDragEnd = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
    };
}

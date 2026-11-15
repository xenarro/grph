// Small helpers for building DOM and SVG elements. Text goes through textContent, so names are never parsed as HTML.

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | number | null | undefined | false;

const SVG_NS = "http://www.w3.org/2000/svg";

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    setAttributes(element, attrs);
    append(element, children);
    return element;
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
    setAttributes(element, attrs);
    append(element, children);
    return element;
}

function setAttributes(element: Element, attrs: Attrs): void {
    for (const [name, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) {
            continue;
        }
        element.setAttribute(name, value === true ? "" : String(value));
    }
}

function append(element: Element, children: Child[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        element.append(typeof child === "number" ? String(child) : child);
    }
}

// class names from a map of conditions
export function classes(map: Record<string, boolean | undefined>): string {
    return Object.entries(map).filter(([, on]) => on).map(([name]) => name).join(" ");
}

// true while the user is typing in a form field, so keyboard shortcuts stay out of the way
export function isTyping(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

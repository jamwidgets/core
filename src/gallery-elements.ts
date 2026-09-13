import {
  fetchGalleries,
  fetchGallery,
  fetchRandomPhoto,
  fetchSiteConfig,
  POWERED_BY_LABEL,
  POWERED_BY_URL,
  type GalleryPhoto,
  type GallerySummary,
  type JamwidgetsGallery,
} from "./index.js";

const styles = `
  :host{display:block;color:inherit;font:inherit;--jw-gap:clamp(.55rem,1.5vw,1rem)}
  *{box-sizing:border-box}.state{padding:2rem;text-align:center;color:color-mix(in srgb,currentColor 60%,transparent)}
  .error{color:#b42318}.head{margin-bottom:1rem}.head h2{margin:0;font:700 clamp(1.4rem,3vw,2rem)/1.15 inherit}
  .head p{margin:.4rem 0 0;color:color-mix(in srgb,currentColor 66%,transparent)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:var(--jw-gap)}
  figure{margin:0}.photo{position:relative;overflow:hidden;border:0;border-radius:.8rem;background:#eee;cursor:zoom-in;padding:0;width:100%}
  .photo img,.cover img,.random img{display:block;width:100%;height:auto;aspect-ratio:var(--ratio,4/3);object-fit:var(--fit,cover)}
  figcaption{padding:.45rem .15rem 0;font-size:.875rem;color:color-mix(in srgb,currentColor 72%,transparent)}
  .tags{display:flex;gap:.4rem;overflow:auto;margin:0 0 1rem;padding:.1rem}.tag,.back{border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:999px;background:transparent;color:inherit;padding:.4rem .75rem;cursor:pointer}
  .tag[aria-pressed=true]{background:currentColor;color:Canvas}.index{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:var(--jw-gap)}
  .card{border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:1rem;overflow:hidden;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer}
  .card-copy{display:block;padding:.85rem}.card strong{display:block;font-size:1.05rem}.card small{display:block;margin-top:.2rem;color:color-mix(in srgb,currentColor 60%,transparent)}
  dialog{border:0;border-radius:1rem;padding:0;max-width:min(94vw,72rem);max-height:92vh;background:#111;color:#fff}dialog::backdrop{background:#000b}
  dialog img{display:block;max-width:92vw;max-height:84vh;width:auto;height:auto}.close{position:absolute;right:.6rem;top:.6rem;width:2.4rem;height:2.4rem;border:0;border-radius:50%;background:#000a;color:#fff;font-size:1.5rem;cursor:pointer}
  .viewer-caption{padding:.7rem 1rem}.powered{margin-top:.8rem;text-align:center;font-size:.75rem}.powered a{color:color-mix(in srgb,currentColor 55%,transparent);text-decoration:none}
`;

const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

function image(photo: GalleryPhoto, className?: string): HTMLImageElement {
  const img = document.createElement("img");
  const variants = [...photo.variants].sort((a, b) => a.width - b.width);
  const fallback = variants.at(-1);
  img.src = fallback?.url ?? "";
  img.srcset = variants.map((variant) => `${variant.url} ${variant.width}w`).join(", ");
  img.sizes = "(min-width: 72rem) 25vw, (min-width: 40rem) 50vw, 100vw";
  img.alt = photo.decorative ? "" : (photo.altText ?? "");
  img.loading = "lazy";
  img.decoding = "async";
  if (photo.width) img.width = photo.width;
  if (photo.height) img.height = photo.height;
  if (className) img.className = className;
  return img;
}

abstract class GalleryElement extends HTMLElementBase {
  protected root?: ShadowRoot;
  private generation = 0;

  static get observedAttributes() {
    return ["site-key", "endpoint", "slug", "tag", "seed", "deep-link"];
  }

  connectedCallback() {
    this.root ??= this.attachShadow({ mode: "open" });
    this.reload();
  }
  disconnectedCallback() {
    this.generation += 1;
  }
  attributeChangedCallback(name: string, previous: string | null, value: string | null) {
    if (previous !== value && this.isConnected && this.root) this.reload();
  }
  protected reload() {
    const generation = this.advanceGeneration();
    this.loading();
    void this.load(generation);
  }
  protected advanceGeneration() { return ++this.generation; }
  protected get currentGeneration() { return this.generation; }
  protected isCurrent(generation: number) { return this.isConnected && generation === this.generation; }

  protected get siteKey() { return this.getAttribute("site-key") ?? ""; }
  protected get endpoint() { return this.getAttribute("endpoint") ?? undefined; }
  protected abstract load(generation: number): Promise<void>;
  frame(): HTMLElement {
    const frame = document.createElement("section");
    const style = document.createElement("style");
    style.textContent = styles;
    this.root?.replaceChildren(style, frame);
    return frame;
  }
  protected loading() { const frame = this.frame(); frame.className = "state"; frame.textContent = "Loading gallery…"; }
  protected fail(error: unknown) { const frame = this.frame(); frame.className = "state error"; frame.textContent = error instanceof Error ? error.message : "Gallery unavailable"; }
  async brand(frame: HTMLElement) {
    try {
      const config = await fetchSiteConfig({ siteKey: this.siteKey, endpoint: this.endpoint });
      if (!config?.showPoweredBy || !frame.isConnected) return;
      const footer = document.createElement("footer"); footer.className = "powered";
      const link = document.createElement("a"); link.href = POWERED_BY_URL; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = POWERED_BY_LABEL;
      footer.append(link); frame.append(footer);
    } catch { /* Paid sites must never be branded on an uncertain response. */ }
  }
}

async function fetchAllGalleries(
  siteKey: string,
  endpoint?: string,
): Promise<GallerySummary[]> {
  const galleries: GallerySummary[] = [];
  let after: string | undefined;
  do {
    const page = await fetchGalleries({ siteKey, endpoint, limit: 100, after });
    galleries.push(...page.galleries);
    after = page.nextCursor;
  } while (after);
  return galleries;
}

function renderGallery(host: GalleryElement, gallery: JamwidgetsGallery, initialTag?: string): HTMLElement {
  const frame = host.frame();
  const head = document.createElement("header"); head.className = "head";
  const title = document.createElement("h2"); title.textContent = gallery.title; head.append(title);
  if (gallery.description) { const description = document.createElement("p"); description.textContent = gallery.description; head.append(description); }
  frame.append(head);
  const allTags = [...new Set(gallery.photos.flatMap((photo) => photo.tags))].sort();
  const grid = document.createElement("div"); grid.className = "grid";
  let active = initialTag ?? "";
  const draw = () => {
    grid.replaceChildren();
    for (const photo of gallery.photos.filter((item) => !active || item.tags.includes(active))) {
      const figure = document.createElement("figure");
      const button = document.createElement("button"); button.type = "button"; button.className = "photo"; button.append(image(photo));
      button.addEventListener("click", () => openViewer(frame, photo)); figure.append(button);
      if (photo.caption) { const caption = document.createElement("figcaption"); caption.textContent = photo.caption; figure.append(caption); }
      grid.append(figure);
    }
  };
  if (allTags.length) {
    const tags = document.createElement("nav"); tags.className = "tags"; tags.setAttribute("aria-label", "Filter photos");
    for (const value of ["", ...allTags]) {
      const button = document.createElement("button"); button.type = "button"; button.className = "tag"; button.textContent = value || "All";
      button.setAttribute("aria-pressed", String(active === value));
      button.addEventListener("click", () => { active = value; for (const item of tags.querySelectorAll("button")) item.setAttribute("aria-pressed", String(item === button)); draw(); });
      tags.append(button);
    }
    frame.append(tags);
  }
  frame.append(grid); draw(); return frame;
}

function openViewer(frame: HTMLElement, photo: GalleryPhoto) {
  const dialog = document.createElement("dialog");
  const close = document.createElement("button"); close.type = "button"; close.className = "close"; close.ariaLabel = "Close photo"; close.textContent = "×"; close.addEventListener("click", () => dialog.close());
  const full = image(photo); full.loading = "eager"; full.sizes = "100vw"; dialog.append(close, full);
  if (photo.caption) { const caption = document.createElement("div"); caption.className = "viewer-caption"; caption.textContent = photo.caption; dialog.append(caption); }
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove()); frame.append(dialog); dialog.showModal();
}

export class JamwidgetsGalleryElement extends GalleryElement {
  protected async load(generation: number) {
    try {
      const slug = this.getAttribute("slug"); if (!slug || !this.siteKey) throw new Error("site-key and slug are required");
      const tag = this.getAttribute("tag") ?? undefined;
      const gallery = await fetchGallery({ siteKey: this.siteKey, endpoint: this.endpoint, slug, tag });
      if (!this.isCurrent(generation)) return;
      if (!gallery) throw new Error("Gallery not found");
      const frame = renderGallery(this, gallery, tag); await this.brand(frame);
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
  }
}

export class JamwidgetsGalleryIndexElement extends GalleryElement {
  private galleries: GallerySummary[] = [];
  private loaded = false;
  private readonly navigate = () => {
    if (!this.hasAttribute("deep-link")) return;
    if (!this.loaded) {
      this.reload();
      return;
    }
    const slug = new URL(location.href).searchParams.get("gallery");
    const generation = this.advanceGeneration();
    if (slug) void this.showGallery(slug, this.galleries, false, generation);
    else void this.showIndex(this.galleries, generation);
  };

  connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener?.("popstate", this.navigate);
  }
  disconnectedCallback() {
    globalThis.removeEventListener?.("popstate", this.navigate);
    super.disconnectedCallback();
  }

  protected async load(generation: number) {
    try {
      this.loaded = false;
      if (!this.siteKey) throw new Error("site-key is required");
      const galleries = await fetchAllGalleries(this.siteKey, this.endpoint);
      if (!this.isCurrent(generation)) return;
      this.galleries = galleries;
      this.loaded = true;
      const linked = this.hasAttribute("deep-link") ? new URL(location.href).searchParams.get("gallery") : null;
      if (linked) await this.showGallery(linked, galleries, false, generation);
      else await this.showIndex(galleries, generation);
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
  }
  private async showIndex(galleries: GallerySummary[], expectedGeneration = this.currentGeneration) {
    if (!this.isCurrent(expectedGeneration)) return;
    const frame = this.frame(); const index = document.createElement("div"); index.className = "index";
    for (const gallery of galleries) {
      const card = document.createElement("button"); card.type = "button"; card.className = "card";
      if (gallery.cover) { const cover = document.createElement("span"); cover.className = "cover"; cover.append(image(gallery.cover)); card.append(cover); }
      const copy = document.createElement("span"); copy.className = "card-copy"; const title = document.createElement("strong"); title.textContent = gallery.title;
      const count = document.createElement("small"); count.textContent = `${gallery.photoCount} photo${gallery.photoCount === 1 ? "" : "s"}`; copy.append(title, count); card.append(copy);
      card.addEventListener("click", () => void this.showGallery(gallery.slug, galleries, true, this.advanceGeneration())); index.append(card);
    }
    frame.append(index); await this.brand(frame);
  }
  private async showGallery(
    slug: string,
    galleries: GallerySummary[],
    updateHistory: boolean,
    expectedGeneration?: number,
  ) {
    try {
      const gallery = await fetchGallery({ siteKey: this.siteKey, endpoint: this.endpoint, slug });
      if (expectedGeneration !== undefined && !this.isCurrent(expectedGeneration)) return;
      if (!gallery) {
        if (this.hasAttribute("deep-link")) { const url = new URL(location.href); url.searchParams.delete("gallery"); history.replaceState({}, "", url); }
        await this.showIndex(galleries, expectedGeneration);
        return;
      }
      const frame = renderGallery(this, gallery); const back = document.createElement("button"); back.type = "button"; back.className = "back"; back.textContent = "← All galleries";
      back.addEventListener("click", () => { if (this.hasAttribute("deep-link")) { const url = new URL(location.href); url.searchParams.delete("gallery"); history.pushState({}, "", url); } void this.showIndex(galleries, this.advanceGeneration()); }); frame.prepend(back);
      if (updateHistory && this.hasAttribute("deep-link")) { const url = new URL(location.href); url.searchParams.set("gallery", slug); history.pushState({}, "", url); }
      await this.brand(frame);
    } catch (error) {
      if (expectedGeneration === undefined || this.isCurrent(expectedGeneration)) this.fail(error);
    }
  }
}

export class JamwidgetsRandomPhotoElement extends GalleryElement {
  protected async load(generation: number) {
    try {
      const slug = this.getAttribute("slug"); if (!slug || !this.siteKey) throw new Error("site-key and slug are required");
      const seed = this.getAttribute("seed") ?? globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      const photo = await fetchRandomPhoto({ siteKey: this.siteKey, endpoint: this.endpoint, slug, tag: this.getAttribute("tag") ?? undefined, seed });
      if (!this.isCurrent(generation)) return;
      if (!photo) throw new Error("No matching photo"); const frame = this.frame(); const figure = document.createElement("figure"); figure.className = "random"; figure.append(image(photo));
      if (photo.caption) { const caption = document.createElement("figcaption"); caption.textContent = photo.caption; figure.append(caption); } frame.append(figure); await this.brand(frame);
    } catch (error) { if (this.isCurrent(generation)) this.fail(error); }
  }
}

if (globalThis.customElements) {
  if (!customElements.get("jamwidgets-gallery")) customElements.define("jamwidgets-gallery", JamwidgetsGalleryElement);
  if (!customElements.get("jamwidgets-gallery-index")) customElements.define("jamwidgets-gallery-index", JamwidgetsGalleryIndexElement);
  if (!customElements.get("jamwidgets-random-photo")) customElements.define("jamwidgets-random-photo", JamwidgetsRandomPhotoElement);
}

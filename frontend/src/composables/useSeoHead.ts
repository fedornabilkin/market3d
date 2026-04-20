import { onBeforeUnmount, onMounted, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

export interface SeoHeadInput {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  siteName?: string;
  noIndex?: boolean;
}

type SeoProvider = SeoHeadInput | (() => SeoHeadInput);

const SITE_NAME = 'vsqr';
const DEFAULT_IMAGE = 'https://vsqr.ru/android-chrome-192x192.png';

function upsertMeta(attr: 'name' | 'property', key: string, content: string, tracker: HTMLMetaElement[]): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (el) {
    el.setAttribute('content', content);
    return;
  }
  el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  document.head.appendChild(el);
  tracker.push(el);
}

function upsertLink(rel: string, href: string, tracker: HTMLLinkElement[]): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (el) {
    el.setAttribute('href', href);
    return;
  }
  el = document.createElement('link');
  el.setAttribute('rel', rel);
  el.setAttribute('href', href);
  document.head.appendChild(el);
  tracker.push(el);
}

/**
 * Per-page SEO composable.
 *
 * Updates document.title and syncs description / keywords / OpenGraph / Twitter
 * tags plus (optionally) canonical link and robots noindex. The `provider` can
 * be an object or a function returning an object — function form is reactive
 * through watchEffect so i18n changes re-render meta without a reload.
 *
 * Tags created here are tracked and removed on unmount; tags that already
 * exist in index.html are updated in-place and restored on unmount.
 */
export function useSeoHead(provider: SeoProvider): void {
  const createdMetas: HTMLMetaElement[] = [];
  const createdLinks: HTMLLinkElement[] = [];
  const originalValues = new Map<string, string | null>();
  let originalTitle = '';
  let first = true;

  const captureOriginal = (selector: string, attr: string) => {
    if (originalValues.has(selector)) return;
    const el = document.head.querySelector(selector);
    originalValues.set(selector, el ? el.getAttribute(attr) : null);
  };

  const apply = () => {
    const input = typeof provider === 'function' ? provider() : provider;
    const title = input.title;
    const description = input.description;
    const keywords = input.keywords;
    const image = input.image ?? DEFAULT_IMAGE;
    const siteName = input.siteName ?? SITE_NAME;
    const url = input.url ?? (typeof window !== 'undefined' ? window.location.href : undefined);

    if (first) originalTitle = document.title;
    if (title) document.title = title;

    if (description) {
      captureOriginal('meta[name="description"]', 'content');
      upsertMeta('name', 'description', description, createdMetas);
      captureOriginal('meta[itemprop="description"]', 'content');
      upsertMeta('name', 'twitter:description', description, createdMetas);
      captureOriginal('meta[property="og:description"]', 'content');
      upsertMeta('property', 'og:description', description, createdMetas);
    }

    if (keywords) {
      captureOriginal('meta[name="keywords"]', 'content');
      upsertMeta('name', 'keywords', keywords, createdMetas);
    }

    if (title) {
      captureOriginal('meta[property="og:title"]', 'content');
      upsertMeta('property', 'og:title', title, createdMetas);
      captureOriginal('meta[name="twitter:title"]', 'content');
      upsertMeta('name', 'twitter:title', title, createdMetas);
      captureOriginal('meta[itemprop="name"]', 'content');
    }

    upsertMeta('property', 'og:site_name', siteName, createdMetas);
    upsertMeta('property', 'og:type', 'website', createdMetas);
    if (url) upsertMeta('property', 'og:url', url, createdMetas);
    if (image) {
      upsertMeta('property', 'og:image', image, createdMetas);
      upsertMeta('name', 'twitter:image:src', image, createdMetas);
    }

    if (url) upsertLink('canonical', url, createdLinks);

    if (input.noIndex) {
      upsertMeta('name', 'robots', 'noindex,nofollow', createdMetas);
    } else {
      const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (robots) robots.remove();
    }

    first = false;
  };

  onMounted(() => {
    watchEffect(apply);
  });

  onBeforeUnmount(() => {
    if (originalTitle) document.title = originalTitle;
    for (const meta of createdMetas) meta.remove();
    for (const link of createdLinks) link.remove();
    createdMetas.length = 0;
    createdLinks.length = 0;
  });
}

/**
 * Convenience wrapper: pulls `{title, description, keywords}` from i18n under
 * the given prefix (e.g. `seo.generatorGrz` reads `seo.generatorGrz.title`
 * etc.). Reactive — re-applies when locale switches. Pass `options` to layer
 * extra fields (image, url, noIndex) on top of the i18n values.
 */
export function useSeoHeadI18n(prefix: string, options: Omit<SeoHeadInput, 'title' | 'description' | 'keywords'> = {}): void {
  const { t, te } = useI18n();
  const read = (suffix: string): string | undefined => {
    const key = `${prefix}.${suffix}`;
    return te(key) ? t(key) : undefined;
  };
  useSeoHead(() => ({
    title: read('title'),
    description: read('description'),
    keywords: read('keywords'),
    ...options,
  }));
}

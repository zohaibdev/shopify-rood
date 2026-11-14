import { Component } from '@theme/component';

/**
 * Swaps an image for a muted, looping video once the video is actually playing.
 * Sources load when the component nears the viewport. The image stays as the fallback
 * when the video can't load or play, and when reduced motion is preferred.
 *
 * @typedef {object} Refs
 * @property {HTMLVideoElement} video - The video element.
 * @property {HTMLSourceElement[]} [sources] - Sources holding their URL in `data-video-source`.
 *
 * @extends Component<Refs>
 */
export class VideoFallbackComponent extends Component {
  requiredRefs = ['video'];

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();
    this.#start();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#teardown();
    this.#start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#teardown();
  }

  #start() {
    delete this.dataset.state;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.#showFallback();
      return;
    }

    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    const { video } = this.refs;

    // `error` doesn't bubble, so capture it from the video and its sources.
    this.addEventListener('error', this.#handleError, { capture: true, signal });
    video.addEventListener(
      'playing',
      () => {
        this.dataset.state = 'playing';
      },
      { signal }
    );

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        this.#observer?.disconnect();
        this.#load();
      },
      { rootMargin: '200px 0px' }
    );
    this.#observer.observe(this);
  }

  async #load() {
    const { video, sources = [] } = this.refs;

    for (const source of sources) {
      const { videoSource } = source.dataset;

      if (videoSource && !source.getAttribute('src')) source.setAttribute('src', videoSource);
    }

    video.load();

    try {
      await video.play();
    } catch (error) {
      // AbortError means a newer load() superseded this play() call, not a failure.
      if (!(error instanceof DOMException) || error.name !== 'AbortError') this.#showFallback();
    }
  }

  /**
   * A failing source only matters when no later source remains to try.
   * @param {Event} event
   */
  #handleError = (event) => {
    const { video, sources = [] } = this.refs;

    if (event.target === video || event.target === sources.at(-1)) this.#showFallback();
  };

  #showFallback() {
    this.dataset.state = 'fallback';
    this.refs.video?.pause();
  }

  #teardown() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#observer?.disconnect();
    this.#observer = null;
  }
}

if (!customElements.get('video-fallback-component')) {
  customElements.define('video-fallback-component', VideoFallbackComponent);
}

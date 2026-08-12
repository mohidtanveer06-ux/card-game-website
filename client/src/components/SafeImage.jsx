import { useState } from 'react';

const SUPPORTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'];
const FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#1a1a2e" rx="8"/>
    <text x="50" y="55" font-family="sans-serif" font-size="24" fill="#c9a227" text-anchor="middle" dominant-baseline="middle">?</text>
  </svg>`
)}`;

function getExtension(url) {
  if (!url) return null;
  const clean = url.split('?')[0].split('#')[0];
  const match = clean.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : null;
}

function isSupportedFormat(url) {
  const ext = getExtension(url);
  return ext ? SUPPORTED_FORMATS.includes(ext) : true;
}

export default function SafeImage({
  src,
  alt = '',
  fallbackSrc = FALLBACK_SVG,
  className = '',
  style,
  onLoad,
  onError,
  ...rest
}) {
  const [state, setState] = useState({ status: 'loading', currentSrc: src, attempts: 0 });
  const [errored, setErrored] = useState(false);

  if (state.currentSrc !== src) {
    setState({ status: 'loading', currentSrc: src, attempts: 0 });
    setErrored(false);
  }

  if (!src) {
    if (onError && !errored) {
      onError?.(new Error('Missing src'));
      console.warn('[SafeImage] Image src is missing');
      setErrored(true);
    }
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        className={`safe-image fallback ${className}`}
        style={{ ...style, opacity: 0.7 }}
        aria-hidden={!alt}
        {...rest}
      />
    );
  }

  if (!isSupportedFormat(src)) {
    console.warn(`[SafeImage] Unsupported format for: ${src}`);
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`safe-image ${className}`}
      style={style}
      onError={(e) => {
        setErrored(true);
        console.error(`[SafeImage] Failed to load: ${src}`);
        e.target.onerror = null;
        e.target.src = fallbackSrc;
        e.target.style.opacity = '0.7';
        onError?.(e);
      }}
      onLoad={(e) => {
        setState((s) => ({ ...s, status: 'loaded' }));
        onLoad?.(e);
      }}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}

export { FALLBACK_SVG, SUPPORTED_FORMATS, getExtension, isSupportedFormat };

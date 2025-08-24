import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DomPdfOptions {
  element: HTMLElement;
  fileName: string;
  // width in pixels for rendering canvas; height will auto scale (single long page)
  targetWidth?: number; // default decides based on screen width
  darkBackground?: string; // fallback fill
}

export async function exportElementToSinglePagePdf({
  element,
  fileName,
  targetWidth,
  darkBackground = '#0d0d0d',
}: DomPdfOptions) {
  const originalWidth = element.offsetWidth;
  const narrow = originalWidth < 640;
  // Allow caller override, else scale up only on narrow screens to preserve "zoomed" feel.
  // Unified scaling regardless of image count so exported image sizes are consistent.
  const imageCount = element.querySelectorAll('.page-images img').length;
  const baseScale = narrow ? 1.35 : 1;
  const uniformExtraScale = 1.1; // previously only applied when imageCount > 1
  const scaleFactor = targetWidth
    ? targetWidth / originalWidth
    : baseScale * uniformExtraScale;

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = originalWidth + 'px';
  clone.style.maxWidth = 'none';
  clone.style.background = darkBackground;
  clone.style.color = 'inherit';
  clone.style.padding = '16px';
  clone.style.borderRadius = '0';
  clone.style.transform = `scale(${scaleFactor})`;
  clone.style.transformOrigin = 'top left';

  // --- Inject export header (SVG logo from /images + timestamp) ---
  let headerLogoLoaded: Promise<void> | null = null;
  try {
    const header = document.createElement('div');
    header.style.marginBottom = '24px';
    header.style.display = 'flex';
    header.style.flexDirection = 'column';
    header.style.alignItems = 'stretch';
    header.style.gap = '8px';

    const logoWrapper = document.createElement('div');
    logoWrapper.style.width = '100%';
    logoWrapper.style.display = 'block';
    logoWrapper.style.lineHeight = '0';

    const logoImg = document.createElement('img');
    logoImg.src = '/images/ascii-logo-single.svg';
    logoImg.alt = 'Plant Debugger Logo';
    logoImg.style.width = '100%';
    logoImg.style.height = 'auto';
    logoImg.style.display = 'block';
    logoImg.style.objectFit = 'contain';
    logoImg.style.filter = 'none'; // ensure original green shows
    logoWrapper.appendChild(logoImg);

    // Ensure logo loads before snapshot for best quality
    if (!logoImg.complete || logoImg.naturalWidth === 0) {
      headerLogoLoaded = new Promise<void>((res) => {
        logoImg.addEventListener('load', () => res(), { once: true });
        logoImg.addEventListener('error', () => res(), { once: true }); // continue even if error
      });
    }

    const ts = document.createElement('div');
    ts.style.fontSize = '12px';
    ts.style.fontFamily = 'monospace';
    ts.style.color = '#6dcf43'; // match brand green
    ts.style.textAlign = 'left';
    ts.style.opacity = '0.9';
    const now = new Date();
    ts.textContent = now.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    header.appendChild(logoWrapper);
    header.appendChild(ts);
    clone.insertBefore(header, clone.firstChild);
  } catch (e) {
    console.warn('Failed to inject PDF header', e);
  }

  // --- Export-only image enlargement & frame adjustments ---
  try {
    const grid = clone.querySelector(
      '.page-images .image-preview-grid'
    ) as HTMLElement | null;
    if (grid) {
      const count = grid.getAttribute('data-image-count')
        ? parseInt(grid.getAttribute('data-image-count') as string, 10)
        : imageCount;
      grid.style.display = 'flex';
      grid.style.flexWrap = 'nowrap';
      grid.style.gap = '16px';
      grid.style.width = 'max-content';
      grid.style.maxWidth = 'none';
      grid.classList.remove('ascii-frame');
      grid.style.border = 'none';
      grid.style.padding = '0';
      grid.style.background = 'transparent';
      // Target each item
      const items = Array.from(
        grid.querySelectorAll('.image-preview-grid__item')
      ) as HTMLElement[];
      const perWidth =
        count === 1 ? 520 : count === 2 ? 180 : count === 3 ? 100 : 100; // larger than UI
      items.forEach((item) => {
        item.style.flex = `0 0 ${perWidth}px`;
        item.style.width = perWidth + 'px';
        item.style.height = 'auto';
        const img = item.querySelector('img');
        if (img) {
          const htmlImg = img as HTMLImageElement;
          htmlImg.style.width = '100%';
          htmlImg.style.height = 'auto';
          htmlImg.style.maxHeight = (count <= 2 ? 220 : 160) + 'px';
          htmlImg.style.objectFit = 'cover';
          htmlImg.style.background = '#000';
          htmlImg.style.border = '1px solid #30363d';
          htmlImg.style.padding = '2px';
        }
        // Remove interactive overlay for export clarity
        const overlay = item.querySelector('.image-preview-grid__overlay');
        if (overlay) {
          (overlay as HTMLElement).style.display = 'none';
        }
      });
    }
  } catch (e) {
    // Non-fatal; continue with export even if adjustments fail.
    console.warn('Image enlargement adjustments failed (PDF export)', e);
  }

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.zIndex = '-1';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const effectiveWidth = originalWidth * scaleFactor;

  // Adaptive DPR: very tall documents on high-DPR mobile browsers (iOS/Android)
  // can exceed the maximum canvas dimension (often 16384 or 32767 px) causing
  // the rendered canvas to be silently truncated after the first portion.
  // We estimate the transformed height (layout height * scaleFactor) and then
  // cap the effective devicePixelRatio so the final canvas height stays safely
  // below a MAX dimension. This preserves full content while keeping quality
  // acceptable.
  const MAX_CANVAS_DIMENSION = 16000; // conservative to support mobile Safari
  const baseDeviceScale = Math.min(3, window.devicePixelRatio || 1); // avoid huge DPRs
  // Because we apply a CSS transform scale, the layout height doesn't reflect
  // the visual height; multiply by scaleFactor to approximate final rendered height.
  const estimatedScaledHeight = clone.scrollHeight * scaleFactor;
  let dpr = baseDeviceScale;
  if (estimatedScaledHeight * dpr > MAX_CANVAS_DIMENSION) {
    dpr = Math.max(1, MAX_CANVAS_DIMENSION / estimatedScaledHeight);
  }

  if (headerLogoLoaded) {
    try {
      await headerLogoLoaded;
    } catch {}
  }

  const canvas = await html2canvas(clone, {
    backgroundColor: darkBackground,
    scale: dpr,
    useCORS: true,
    logging: false,
    windowWidth: effectiveWidth,
    width: effectiveWidth,
  });

  document.body.removeChild(wrapper);

  const imgData = canvas.toDataURL('image/png');

  // Use canvas dimensions directly; create custom size PDF in pixels (pt) converting 1 px = 0.75 pt approx
  const pxWidth = canvas.width;
  const pxHeight = canvas.height;
  const ptWidth = pxWidth * 0.75;
  const ptHeight = pxHeight * 0.75;
  const pdf = new jsPDF({
    unit: 'pt',
    format: [ptWidth, ptHeight],
    orientation: 'p',
  });

  pdf.addImage(imgData, 'PNG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
  pdf.save(fileName);
}

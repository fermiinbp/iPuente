/*
 * capturar-pagina.js
 * Pégalo en la consola de Chrome (F12 > Console) con la página de localhost abierta.
 * Descarga un HTML autocontenido con TODOS los estilos ya calculados (colores, fuentes,
 * variables CSS resueltas), el canvas 3D como imagen y las imágenes en base64.
 * Ese HTML es el que se envía a Figma con enviar-a-figma.sh.
 *
 * Uso:  window.capturarPagina('landing')   -> descarga landing.html
 * (el script se auto-ejecuta con el nombre de la ruta actual si no lo llamas tú)
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'Este script solo funciona en la consola de Chrome con localhost abierto (F12 > Console, ' +
        'contexto "top"). No lo pegues en Figma, en un plugin ni en Node.',
    );
  }
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    throw new Error('Abre primero la página de localhost (ahora estás en ' + location.host + ').');
  }
  const ANCHO = 1440;

  // 1) Captura del canvas WebGL: el buffer se borra tras pintar, así que lo copiamos
  //    justo después de cada frame del requestAnimationFrame.
  const canvasPng = new WeakMap();
  const rafOriginal = window.__rafOriginal || window.requestAnimationFrame.bind(window);
  window.__rafOriginal = rafOriginal;
  window.requestAnimationFrame = (cb) =>
    rafOriginal((t) => {
      cb(t);
      document.querySelectorAll('canvas').forEach((c) => {
        try {
          const d = c.toDataURL('image/png');
          if (d.length > 30000) canvasPng.set(c, d);
        } catch {
          /* canvas protegido: se ignora */
        }
      });
    });

  const aDataUri = async (url) => {
    const b = await (await fetch(url)).blob();
    return new Promise((ok) => {
      const f = new FileReader();
      f.onload = () => ok(f.result);
      f.readAsDataURL(b);
    });
  };

  // Propiedades que Figma necesita para reproducir el diseño (valores ya resueltos).
  const PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
    'justify-content', 'align-items', 'align-self', 'gap', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'overflow', 'overflow-x', 'overflow-y', 'opacity', 'transform', 'transform-origin',
    'color', 'background-color', 'background-image', 'background-size',
    'background-position', 'background-repeat',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'filter', 'backdrop-filter', 'object-fit',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
    'white-space', 'fill', 'stroke', 'stroke-width',
  ];

  async function capturarPagina(nombre) {
    nombre = nombre || location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'landing';
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 2500)); // deja renderizar el 3D

    const vivos = [...document.body.querySelectorAll('*')];
    const raiz = document.body.cloneNode(true);
    const clones = [...raiz.querySelectorAll('*')];
    raiz.querySelectorAll('script,noscript,style').forEach((e) => e.remove());

    // 2) Estilos calculados en línea (resuelve var(), color-mix, etc.)
    vivos.forEach((el, i) => {
      const c = clones[i];
      if (!c || !c.isConnected && !raiz.contains(c)) return;
      const cs = getComputedStyle(el);
      let css = '';
      for (const p of PROPS) css += `${p}:${cs.getPropertyValue(p)};`;
      c.setAttribute('style', css);
      c.removeAttribute('class');
    });

    // 3) Pseudo-elementos ::before / ::after con contenido o fondo -> span real
    vivos.forEach((el, i) => {
      ['before', 'after'].forEach((lado) => {
        const ps = getComputedStyle(el, '::' + lado);
        const contenido = ps.getPropertyValue('content');
        const tieneFondo =
          ps.backgroundColor !== 'rgba(0, 0, 0, 0)' || ps.backgroundImage !== 'none';
        if ((contenido === 'none' || contenido === 'normal') && !tieneFondo) return;
        if (ps.display === 'none') return;
        const s = document.createElement('span');
        let css = '';
        for (const p of PROPS) css += `${p}:${ps.getPropertyValue(p)};`;
        s.setAttribute('style', css);
        if (contenido && contenido !== 'none' && contenido !== 'normal')
          s.textContent = contenido.replace(/^["']|["']$/g, '');
        const c = clones[i];
        if (lado === 'before') c.prepend(s);
        else c.append(s);
      });
    });

    // 4) Canvas -> <img>
    const canvasVivos = [...document.querySelectorAll('canvas')];
    const canvasClon = [...raiz.querySelectorAll('canvas')];
    canvasVivos.forEach((c, i) => {
      const png = canvasPng.get(c) || c.toDataURL('image/png');
      const im = document.createElement('img');
      im.src = png;
      im.setAttribute('style', canvasClon[i].getAttribute('style') || '');
      canvasClon[i].replaceWith(im);
    });

    // 5) Imágenes (incluidas las del <img> del logo, svg externos) -> base64
    for (const im of raiz.querySelectorAll('img')) {
      if (im.src.startsWith('http') || im.src.startsWith('blob:')) {
        try {
          im.src = await aDataUri(im.src);
        } catch {
          /* se deja tal cual */
        }
      }
    }

    // 6) Fondo de la página (el body/html puede tener el color de fondo)
    const bg = getComputedStyle(document.body).backgroundColor;
    const bgHtml = getComputedStyle(document.documentElement).backgroundColor;
    const fondo = bg !== 'rgba(0, 0, 0, 0)' ? bg : bgHtml;

    const html =
      '<!doctype html><html><head><meta charset="utf-8">' +
      `<style>html,body{margin:0;width:${ANCHO}px;background:${fondo}}</style></head>` +
      `<body style="margin:0;width:${ANCHO}px;background:${fondo}">${raiz.innerHTML}</body></html>`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `${nombre}.html`;
    a.click();
    return `${nombre}.html · ${(html.length / 1e6).toFixed(1)} MB`;
  }

  window.capturarPagina = capturarPagina;
  console.log('Listo. Ejecuta: await capturarPagina("landing")');
})();

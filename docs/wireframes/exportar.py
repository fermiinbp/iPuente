"""Exporta los wireframes HTML de esta carpeta a PNG con Chrome en modo headless.

Uso (desde la raíz del repo):
    python docs/wireframes/exportar.py                # todos
    python docs/wireframes/exportar.py 01-landing     # los que empiecen por ese texto

Cada pantalla se exporta dos veces, en escritorio (1440 px) y en móvil (390 px), a
docs/images/wireframes-v2/NN-nombre-escritorio.png y NN-nombre-movil.png.
El alto se mide antes con el propio Chrome, así que no queda blanco de sobra.

Chrome no deja ventanas de menos de unos 500 px, así que el móvil se dibuja dentro de un iframe de 390 px:
así las reglas @media de la página se evalúan con el ancho real de un teléfono.
"""

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI.parent / 'images' / 'wireframes-v2'
ANCHO_ESCRITORIO = 1440
ANCHO_MOVIL = 390
CHROME = next(
    (
        p
        for p in (
            r'C:\Program Files\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            '/usr/bin/google-chrome',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        )
        if os.path.exists(p)
    ),
    None,
)

# La página mide su alto y lo escribe en <title> (escritorio) o se lo manda al marco que la contiene (móvil).
MEDIDOR = (
    '<script>addEventListener("load",()=>{const h=Math.ceil(document.body.getBoundingClientRect().height);'
    'document.title="ALTO="+h;if(parent!==window)parent.postMessage({alto:h},"*")})</script>'
)


def chrome(*args):
    return subprocess.run(
        [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', *args],
        capture_output=True,
        text=True,
        timeout=120,
    )


def temporal(texto):
    with tempfile.NamedTemporaryFile('w', suffix='.html', dir=AQUI, delete=False, encoding='utf-8') as tmp:
        tmp.write(texto)
    return Path(tmp.name)


def leer_alto(url, ancho):
    dom = chrome(f'--window-size={ancho},900', '--virtual-time-budget=3000', '--dump-dom', url).stdout
    m = re.search(r'ALTO=(\d+)', dom)
    return int(m.group(1)) if m else 1200


def exportar(html: Path):
    SALIDA.mkdir(parents=True, exist_ok=True)
    medida = temporal(html.read_text(encoding='utf-8').replace('</body>', MEDIDOR + '</body>'))
    creados = [medida]
    try:
        # Escritorio: la propia página.
        alto = leer_alto(medida.as_uri(), ANCHO_ESCRITORIO)
        destino = SALIDA / f'{html.stem}-escritorio.png'
        chrome(f'--window-size={ANCHO_ESCRITORIO},{alto}', f'--screenshot={destino}', medida.as_uri())
        print(f'{destino.name}  {ANCHO_ESCRITORIO}x{alto}')

        # Móvil: la página dentro de un iframe de 390 px. Primero se mide el alto y luego se captura.
        def marco(alto_marco, con_escucha):
            escucha = (
                '<script>addEventListener("message",e=>{document.title="ALTO="+e.data.alto})</script>'
                if con_escucha
                else ''
            )
            return temporal(
                '<!doctype html><html><head><meta charset="utf-8"><title>marco</title></head>'
                '<body style="margin:0;background:#fff">'
                f'<iframe src="{medida.as_uri()}" style="display:block;border:0;width:{ANCHO_MOVIL}px;height:{alto_marco}px"></iframe>'
                f'{escucha}</body></html>'
            )

        primero = marco(900, True)
        creados.append(primero)
        alto = leer_alto(primero.as_uri(), ANCHO_MOVIL)
        segundo = marco(alto, False)
        creados.append(segundo)
        destino = SALIDA / f'{html.stem}-movil.png'
        chrome(f'--window-size={ANCHO_MOVIL},{alto}', f'--screenshot={destino}', segundo.as_uri())
        print(f'{destino.name}  {ANCHO_MOVIL}x{alto}')
    finally:
        for archivo in creados:
            archivo.unlink(missing_ok=True)


if __name__ == '__main__':
    if not CHROME:
        sys.exit('No encuentro Chrome. Instálalo o ajusta la ruta CHROME en este archivo.')
    filtro = sys.argv[1] if len(sys.argv) > 1 else ''
    paginas = sorted(p for p in AQUI.glob('*.html') if p.stem.startswith(filtro))
    if not paginas:
        sys.exit('No hay wireframes que coincidan.')
    for pagina in paginas:
        exportar(pagina)

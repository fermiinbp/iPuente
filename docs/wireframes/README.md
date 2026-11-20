# Wireframes de cliente (versión 2)

Reflejan **lo que está implementado** en la web, no el diseño previo. Los wireframes originales siguen en
`docs/images/wireframes/` y no se han tocado. Las notas azules de cada pantalla explican qué hace y qué queda
pendiente (casi siempre por falta de endpoint en la API).

| Pantalla | Archivo | Equivale a (original) |
| --- | --- | --- |
| Landing | `01-landing.html` | 01 |
| Edificio | `02-edificio.html` | 02 |
| Planta | `03-planta.html` | 03 |
| Ficha de sala y reserva | `04-sala.html` | 04 |
| Iniciar sesión | `05-login.html` | 05 |
| Recuperar contraseña (y enlace enviado) | `05b-recuperar-contrasena.html` | 05b |
| Nueva contraseña (y enlace caducado) | `05c-recuperar-contrasena-nueva.html` | 05c |
| Crear cuenta | `06-registro.html` | 06 |
| Revisa tu reserva (y tiempo agotado) | `07-resumen-pago.html` | 07 y 07c |
| Resultado del pago | `08-resultado-pago.html` | 08 |
| Mis reservas (vacío y modal de cancelar) | `09-mis-reservas.html` | 09 y 09c |
| Detalle de reserva | `09b-detalle-reserva.html` | 09b |
| Mi cuenta | `10-mi-cuenta.html` | nueva |
| 404 | `21-404.html` | 21 |
| Error del servidor y sin conexión | `21b-error-servidor.html` | 21b |
| Búsqueda (con mapa y sin resultados) | `22-busqueda.html` | 22 |

Cada archivo se ve en escritorio y en móvil con la misma página (el estilo común está en `wireframe.css`).

## Generar los PNG

```
python docs/wireframes/exportar.py                # todos
python docs/wireframes/exportar.py 04-sala        # solo los que empiecen por ese texto
```

Necesita Google Chrome instalado. Deja los PNG en `docs/images/wireframes-v2/` como
`NN-nombre-escritorio.png` y `NN-nombre-movil.png`.

## Cuando cambie una pantalla

Edita su `.html`, actualiza las notas azules y vuelve a exportar. El panel de empresa y el de admin no están en esta versión.

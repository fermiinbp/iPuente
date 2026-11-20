# Páginas a pasar a Figma (localhost:5173)

| Nombre del archivo | Ruta |
| --- | --- |
| landing | `/` |
| edificio | `/buildings/<id>` |
| planta | `/buildings/<id>/floors/<id>` |
| sala | `/rooms/<id>` |
| login | `/login` |
| registro | `/register` |
| mis-reservas | `/my-bookings` (con sesión) |
| empresa-panel | `/company` (rol empresa) |
| admin-panel | `/admin` (rol admin) |

Pasos por página:
1. Abre la ruta en Chrome a pantalla completa (1440 px de ancho).
2. F12 > Console, pega `capturar-pagina.js` y ejecuta `await capturarPagina('landing')`.
3. Se descarga `landing.html`.
4. Pide a Claude una `submitUrl` nueva y ejecuta `./enviar-a-figma.sh "<submitUrl>" landing.html`.

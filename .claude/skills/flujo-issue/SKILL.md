---
name: flujo-issue
description: Coge una issue del tablero de GitHub Projects y la lleva hasta una PR siguiendo la convención del equipo (rama ID-slug, commits "ID:", PR "[ID] ..." con Closes #N). Úsala cuando se pida trabajar, coger o hacer una issue o una tarea del tablero.
---

# Flujo de una issue

Los datos del tablero y del repo están en AGENTS.md, en "Flujo de trabajo".

## 1. Encontrar la issue
- Si el usuario da un ID (PRU001) o un número (#24), usa esa.
- Si no, busca en el tablero las tarjetas en Ready asignadas al usuario:
  `gh project item-list <PROYECTO> --owner TheBridge-FullStackDeveloper --format json --limit 200`
  Si hay varias, pregunta cuál. Si no hay ninguna, dilo y para.
- Lee la issue: `gh issue view <N>`. Saca el ID (lo que va antes de " · " en el título), la descripción y el "Hecha cuando".
- Asígnatela al usuario si no lo está: `gh issue edit <N> --add-assignee @me`.

## 2. Crear la rama
- Slug: la descripción del título en minúsculas, sin tildes ni eñes, palabras separadas por guiones, sin signos, máximo 6 palabras.
- `git switch main && git pull`
- `git switch -c <ID>-<slug>`
- Di al usuario el nombre de la rama.

## 3. Hacer el trabajo
- Tarea de código: analista (plan) → front o back → qa. Pasa a cada uno la issue y lo que necesite del anterior.
- Tarea sin código (un archivo de texto, un cambio de configuración): hazla tú directamente.
- Commit con la convención: `git add <archivos>` y `git commit -m "<ID>: <qué hace>"`.

## 4. Revisión y PR
- Delega en el subagente revisor, pasándole el número de la issue (#N).
- Si el revisor rechaza, vuelve al paso 3 con lo que dijo. Máximo dos vueltas; después, para y explica.

## 5. Informar
Termina con: issue, rama, archivos tocados, resultado del revisor y URL de la PR.
Recuerda al usuario que la PR la revisa y la fusiona él en GitHub.

## Nunca
- Fusionar la PR ni hacer push a main.
- Trabajar en main: siempre en la rama de la issue.
- Inventar el ID: sale siempre del título de la issue.
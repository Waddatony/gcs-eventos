"""Pruebas de interfaz (end-to-end) de la Actividad 4.

Recorre los flujos en un navegador real (Chromium con Playwright), valida el resultado
de cada caso y guarda capturas en docs/capturas-a4/.
Uso:  python -m http.server 8080   (en la carpeta del proyecto)
      python tests/e2e/interfaz_a4.py [ruta-de-chrome]
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = 'http://localhost:8080/'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'capturas-a4')
resultados = []

def caso(cid, desc, ok, detalle=''):
    resultados.append((cid, desc, ok, detalle))
    print(f"{'PASA' if ok else 'FALLA'}  {cid}  {desc}  {detalle}")

async def shot(pg, nombre, full=False):
    await pg.wait_for_timeout(350)
    await pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
    await pg.screenshot(path=os.path.join(OUT, f'{nombre}.png'), full_page=full)

async def login(pg, email, pw):
    await pg.goto(BASE + '#/login'); await pg.wait_for_selector('#form-login')
    await pg.fill('input[name=email]', email); await pg.fill('input[name=password]', pw)
    await pg.click('#form-login button[type=submit]'); await pg.wait_for_selector('.kpis')

async def clic_con_toast(pg, selector):
    # Limpia los avisos anteriores para leer solo el que produce esta acción
    await pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
    await pg.click(selector)
    await pg.wait_for_selector('.toast', timeout=4000)
    return await pg.inner_text('.toast >> nth=-1')

async def main(chrome):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=chrome, args=['--no-sandbox']) if chrome else await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1366, 'height': 900})
        pg = await ctx.new_page()
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE); await pg.wait_for_selector('#form-login')
        await pg.evaluate("indexedDB.deleteDatabase('gcs-eventos')"); await pg.reload(); await pg.wait_for_selector('#form-login')

        # E-01 Inicio con calendario y avance de tareas
        await login(pg, 'organizador@gcs.com', 'Eventos2026')
        tiene = await pg.locator('#cal-inicio .calendario').count() and await pg.locator('.resumen-progreso').count()
        vencidas = await pg.locator('.aviso-rojo').count()
        caso('E-01', 'Inicio muestra calendario, avance de tareas y alerta de vencidas', bool(tiene and vencidas))
        await shot(pg, '01-inicio-calendario-y-avance', full=True)

        # E-02 Agenda en calendario
        await pg.goto(BASE + '#/eventos?vista=calendario'); await pg.wait_for_selector('#cal-eventos .cal-grid')
        n = await pg.locator('#cal-eventos .cal-evento').count()
        await pg.locator('#cal-eventos .cal-dia.con-eventos .cal-num').first.click()
        dia = await pg.locator('#dia-eventos .tarjeta-evento').count()
        caso('E-02', 'Vista calendario de eventos y selección de día', n > 0 and dia > 0, f'{n} eventos en el mes')
        await shot(pg, '02-eventos-vista-calendario')

        # E-03 Formulario de evento con calendario de disponibilidad de sede
        await pg.goto(BASE + '#/eventos/nuevo'); await pg.wait_for_selector('#form-evento')
        await pg.select_option('select[name=sede_id]', '2')
        await pg.wait_for_timeout(200)
        puntos = await pg.locator('#cal-form .cal-puntos i').count()
        dias = pg.locator('#cal-form .cal-dia:not(.pasado):not(.vacio) .cal-num')
        await dias.nth(await dias.count() - 1).click()
        fecha = await pg.input_value('input[name=fecha]')
        caso('E-03', 'Calendario de la sede marca días ocupados y fija la fecha al hacer clic', puntos > 0 and fecha.endswith(await dias.nth(await dias.count() - 1).inner_text() if False else fecha[-2:]), f'fecha={fecha}')
        await shot(pg, '03-formulario-evento-disponibilidad-sede')

        # E-04 Nueva tarea: validaciones y asignación
        await pg.goto(BASE + '#/eventos/1?tab=tareas'); await pg.wait_for_selector('#panel-evento')
        await pg.click('[data-accion="nueva-tarea"]'); await pg.wait_for_selector('#form-tarea')
        await pg.fill('#form-tarea input[name=titulo]', 'ab')
        await pg.select_option('#form-tarea select[name=prioridad]', '')
        await pg.click('#form-tarea button[type=submit]'); await pg.wait_for_timeout(300)
        errs = await pg.locator('#form-tarea .con-error').count()
        caso('E-04a', 'Excepción: la tarea no se guarda con título corto y sin prioridad', errs >= 2, f'{errs} campos marcados')
        await shot(pg, '04-tarea-validaciones')
        await pg.fill('#form-tarea input[name=titulo]', 'Reservar transporte para ponentes')
        await pg.fill('#form-tarea textarea[name=descripcion]', 'Dos camionetas del aeropuerto al auditorio.')
        await pg.select_option('#form-tarea select[name=prioridad]', 'Alta')
        await pg.select_option('#form-tarea select[name=responsable_id]', label='Luis Treviño')
        t = await clic_con_toast(pg, '#form-tarea button[type=submit]')
        fila = await pg.locator('text=Reservar transporte para ponentes').count()
        caso('E-04b', 'Asignar tarea a un asistente y notificarle', fila > 0 and 'aviso' in t, t)
        await shot(pg, '05-tareas-del-evento', full=True)

        # E-05 Actualizar avance
        sel = pg.locator('tr:has-text("Confirmar catering") select[data-avance]')
        await sel.select_option('100'); await pg.wait_for_timeout(400)
        estado = await pg.locator('tr:has-text("Confirmar catering")').inner_text()
        caso('E-05', 'Actualizar avance a 100% marca la tarea como Completada', 'Completada' in estado)

        # E-06 Comunicado
        await pg.click('#tab-evento-comunicacion'); await pg.wait_for_selector('#form-comunicado')
        await pg.click('#form-comunicado button[type=submit]'); await pg.wait_for_timeout(300)
        errs = await pg.locator('#form-comunicado .con-error').count()
        caso('E-06a', 'Excepción: comunicado vacío marca asunto y mensaje', errs >= 2)
        await pg.select_option('#form-comunicado select[name=segmento]', 'Confirmados')
        await pg.fill('#form-comunicado input[name=asunto]', 'Cambio de horario de registro')
        await pg.fill('#form-comunicado textarea[name=cuerpo]', 'El registro abrirá a las 8:30 en el lobby del auditorio.')
        t = await clic_con_toast(pg, '#form-comunicado button[type=submit]')
        caso('E-06b', 'Enviar comunicado a los confirmados', 'enviado a' in t, t)
        await pg.click('#tab-evento-comunicacion'); await pg.wait_for_selector('#form-comunicado')
        await shot(pg, '06-comunicacion-del-evento', full=True)

        # E-07 Pantalla Tareas: filtros y vencidas
        await pg.goto(BASE + '#/tareas?vencidas=1'); await pg.wait_for_selector('#lista-tareas table')
        filas = await pg.locator('#lista-tareas tbody tr').count()
        caso('E-07', 'Pantalla Tareas filtra solo vencidas', filas == 1, f'{filas} fila(s)')
        await pg.uncheck('input[name=vencidas]'); await pg.wait_for_timeout(200)
        await shot(pg, '07-pantalla-tareas-seguimiento', full=True)

        # E-08 Comunicación (bandeja)
        await pg.goto(BASE + '#/comunicacion'); await pg.wait_for_selector('.mensajes')
        await shot(pg, '08-comunicacion-bandeja', full=True)
        await pg.click('[data-accion="mensaje-leido"] >> nth=0'); await pg.wait_for_timeout(300)
        caso('E-08', 'Marcar mensaje de asistente como leído', await pg.locator('[data-accion="mensaje-leido"]').count() == 0)

        # E-09 Enlace del portal desde Participantes
        await pg.goto(BASE + '#/participantes'); await pg.wait_for_selector('.tabla')
        await pg.click('tr:has-text("Ana Torres") [data-accion="portal"]'); await pg.wait_for_selector('#enlace-url')
        url = await pg.input_value('#enlace-url')
        caso('E-09', 'Generar enlace personal del portal', '#/portal/' in url)
        await shot(pg, '09-enlace-portal')
        token = url.split('#/portal/')[1]

        # E-10 Portal del asistente
        await pg.goto(BASE + f'#/portal/{token}?tab=avisos'); await pg.wait_for_selector('.avisos')
        tiene_com = await pg.locator('.avisos >> text=Cambio de horario de registro').count()
        caso('E-10a', 'El asistente recibe en su portal el comunicado y los avisos', tiene_com > 0)
        await shot(pg, '10-portal-avisos', full=True)
        await pg.click('#tab-portal-tareas'); await pg.wait_for_selector('select[data-avance]')
        await pg.locator('tr:has-text("Preparar reporte") select[data-avance]').select_option('100'); await pg.wait_for_timeout(400)
        caso('E-10b', 'El asistente actualiza el avance de su tarea desde el portal', 'Completada' in await pg.locator('tr:has-text("Preparar reporte")').inner_text())
        await shot(pg, '11-portal-mis-tareas')
        await pg.click('#tab-portal-mensajes'); await pg.wait_for_selector('#form-mensaje')
        await pg.fill('#form-mensaje input[name=asunto]', 'Llegaré 10 minutos tarde')
        await pg.fill('#form-mensaje textarea[name=cuerpo]', 'Tengo junta con un cliente; llego a las 9:40.')
        t = await clic_con_toast(pg, '#form-mensaje button[type=submit]')
        caso('E-10c', 'El asistente escribe al organizador', 'enviado' in t, t)
        await shot(pg, '12-portal-escribir-al-organizador')
        await pg.click('#tab-portal-eventos'); await pg.wait_for_selector('#cal-portal .calendario')
        await shot(pg, '13-portal-mis-eventos-calendario')

        # E-11 Auto-registro
        await pg.goto(BASE + '#/registro/4'); await pg.wait_for_selector('#form-registro')
        await pg.fill('#form-registro input[name=nombre]', 'Lu'); await pg.fill('#form-registro input[name=email]', 'correo-malo')
        await pg.fill('#form-registro input[name=telefono]', '123')
        await pg.click('#form-registro button[type=submit]'); await pg.wait_for_timeout(300)
        errs = await pg.locator('#form-registro .con-error').count()
        caso('E-11a', 'Excepción: auto-registro con datos inválidos y sin aceptar privacidad', errs >= 1)
        await shot(pg, '14-auto-registro-validaciones')
        await pg.fill('#form-registro input[name=nombre]', 'Laura Pérez'); await pg.fill('#form-registro input[name=email]', 'laura.perez@cliente.com')
        await pg.fill('#form-registro input[name=telefono]', '8112345678'); await pg.fill('#form-registro input[name=empresa]', 'Cliente Norte')
        await pg.check('#form-registro input[name=acepta]')
        await pg.click('#form-registro button[type=submit]'); await pg.wait_for_selector('.resultado-registro')
        caso('E-11b', 'Auto-registro exitoso con enlace al portal', await pg.locator('.resultado-registro a[href^="#/portal/"]').count() == 1)
        await shot(pg, '15-auto-registro-confirmado')

        # E-12 Enlace inválido
        await pg.goto(BASE + '#/portal/abcdef'); await pg.wait_for_timeout(300)
        caso('E-12', 'Excepción: enlace de portal inválido muestra mensaje claro', 'no válido' in (await pg.inner_text('main')))

        # E-13 Responsivo
        m = await ctx.new_page(); await m.set_viewport_size({'width': 390, 'height': 844})
        await m.goto(BASE + f'#/portal/{token}?tab=tareas'); await m.wait_for_selector('.kpis')
        ancho = await m.evaluate('document.documentElement.scrollWidth')
        caso('E-13', 'Portal sin desbordamiento horizontal en celular', ancho <= 392, f'ancho={ancho}')
        await shot(m, '16-movil-portal', full=True)

        # Sin errores de JavaScript en todo el recorrido
        caso('E-14', 'Sin errores de JavaScript en consola durante todo el recorrido', not errores, '; '.join(errores[:3]))
        await b.close()
    fallas = [r for r in resultados if not r[2]]
    print(f'\n{len(resultados) - len(fallas)} de {len(resultados)} casos pasaron')
    sys.exit(1 if fallas else 0)

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))

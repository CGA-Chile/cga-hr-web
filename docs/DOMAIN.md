# Dominio — App de Asignación de Puestos y Bono de Línea

Reglas de negocio, modelo de datos y decisiones de producto. Es la versión **versionada y
pública** del documento de producto interno.

> **Sobre los montos de este documento.** Este repositorio es público. Las tarifas que
> aparecen acá son **valores de ejemplo**, no los de producción. Preservan la estructura de
> cada regla y de cada caso de prueba —las proporciones, los empates, los truncamientos— pero
> no las cifras reales.
>
> Esto no debilita nada: los montos reales **nunca** viven en el código. Están en las tablas
> `bonus_settings` y `bonus_position_rates`, versionados por vigencia, y se cargan con un
> script de seed que no se versiona. Los tests del módulo de cálculo construyen sus propias
> tarifas de fixture, exactamente como se documentan acá.
>
> El documento interno con las cifras reales es `BRIEF-app-bonos-carda.md`, está en
> `.gitignore` y vive fuera del repositorio.

---

## 1. Contexto

Planta manufacturera de productos de algodón. Todos los días el supervisor de producción
asigna a cada trabajador a un puesto: una máquina, bodega, aseo, mantención. La asignación
cambia día a día y hoy vive en una planilla de Google Sheets con forma de matriz — una fila
por persona, una columna por día, el nombre del puesto escrito en la celda.

Los trabajadores de la línea de cardas (Rieter + ACM) reciben un **bono diario** que se paga a
fin de mes. RRHH consolida ese bono en una planilla mensual que envía al family office para
que gestione los pagos.

Hasta hace poco el bono tenía tarifa fija por puesto y calcularlo era contar apariciones en la
planilla. Se agregó un segundo esquema —cuando hay packing en línea de la ACM— que cambia los
montos de todos los puestos de la línea, y eso volvió el cálculo en planilla frágil y propenso
a errores que hay que corregirle a los usuarios.

**Esta app reemplaza la planilla de asignación diaria y automatiza el cálculo del bono.**

## 2. Objetivo

1. Que el supervisor registre la asignación diaria de todo el personal desde el computador o
   el celular.
2. Que el bono se calcule solo.
3. Que RRHH exporte, para el cierre del mes, el total de bono por persona.

## 3. Fuera de alcance

Explícito para evitar deriva: el dominio invita a construir un módulo de RRHH completo, y no
es lo que se está pidiendo.

- Cualquier otro bono: producción, cumplimiento, sábado, camión, limpieza, turno noche.
- Horas extras, atrasos, salidas anticipadas.
- Integración con software de remuneraciones, ERP o cualquier sistema externo.
- Migración de datos históricos. **La app parte de cero.** Si se necesita un día anterior, se
  ingresa a mano por la app.
- Funcionamiento offline con réplica local de la base.

## 4. Usuarios

Cuatro usuarios nominados. No hay registro público ni acceso anónimo. Los nombres de usuario
reales están en el documento interno y en el seed; acá se describen por rol.

| Perfil | Rol | Qué hace |
|---|---|---|
| Supervisor de producción | `editor` | Registra la asignación diaria. Uso principal. |
| Supervisor de respaldo | `editor` | Registra la asignación diaria cuando el titular no está. |
| RRHH | `editor` | Consulta, corrige y exporta el reporte del cierre. |
| Administrador | `admin` | Todo lo anterior + personas, puestos, tarifas y cierres. |

**Restricción de diseño:** varios usuarios tienen alfabetización digital limitada. Interfaz
simple y tolerante al error, aunque la lógica interna sea compleja. Pocos elementos por
pantalla, texto legible, ninguna acción destructiva a un clic de distancia.

---

## 5. Reglas de cálculo del bono

Es el corazón de la app. Va en `src/domain/bonus/` como módulo puro: sin acceso a datos, sin
red, sin leer la fecha del reloj del sistema. Entrada: las asignaciones del día más los
parámetros vigentes. Salida: el monto por trabajador.

### Puestos bonificables

`RIETER`, `ACM`, `ENCAJADOR_ACM`, `ALIMENTADOR_RIETER`, `PACKING_ACM`. Ningún otro, incluido
`PACKING` genérico y la carda antigua.

**Esta lista es dato, no código.** Vive en la columna `positions.bonus_eligible`. El módulo de
cálculo nunca compara contra una lista literal de códigos: recibe los puestos con su bandera y
la respeta. Agregar un puesto bonificable en el futuro debe ser una fila, no un deploy.

### Esquema del día

```
hasInlinePacking = existe al menos una asignación con puesto PACKING_ACM en esa fecha
scheme = hasInlinePacking ? EQUAL_SHARE : POSITION_RATE
```

No hay marca manual. El esquema se deriva de los datos.

### POSITION_RATE — sin packing en línea

Tarifa fija por puesto. **Valores de ejemplo:**

| Puesto | Monto de ejemplo |
|---|---|
| RIETER | 4.000 |
| ACM | 4.000 |
| ENCAJADOR_ACM | 4.000 |
| ALIMENTADOR_RIETER | 3.000 |

Solo cobra quien está asignado. **Si un puesto queda vacío, su monto no se reparte entre los
demás**: el total del día baja y ya.

`PACKING_ACM` es bonificable pero **no tiene fila en `bonus_position_rates`**, y eso es
correcto, no un dato faltante: su sola presencia fuerza `EQUAL_SHARE`, así que nunca se evalúa
bajo `POSITION_RATE`. El módulo de cálculo no debe tratar la ausencia de esa tarifa como
error.

### EQUAL_SHARE — con packing en línea

Todos los asignados a puestos bonificables ganan lo mismo, sin distinción de puesto:

```
n = cantidad de asignaciones a puestos bonificables ese día
amountPerPerson = floor( min( maxAmountPerPerson , dailyCap / n ) )
```

Valores de ejemplo: `maxAmountPerPerson = 2.500`, `dailyCap = 15.000`.

La fórmula codifica dos reglas del negocio a la vez: la empresa no reparte más que el tope en
un día por este bono, y nadie recibe más del máximo individual aunque el grupo sea chico —
esto último existe para no premiar a quien haga el trabajo de dos.

Truncamiento hacia abajo, al peso, para no pasarse del tope por redondeo. El truncamiento
puede dejar el total apenas bajo el tope; es correcto y esperado.

### El tope diario **no** se aplica a POSITION_RATE

Regla explícita, porque es la pregunta que todos hacen:

`dailyCap` es un parámetro **de la fórmula de `EQUAL_SHARE`**. Bajo `POSITION_RATE` el total
del día es la suma simple de las tarifas de los puestos efectivamente ocupados, sin recorte.

Con datos correctos eso no puede exceder el tope: las cuatro tarifas suman exactamente el tope
(4.000 × 3 + 3.000 = 15.000). Solo lo excede si un puesto de línea quedó con **más de un
ocupante**, que es un error de asignación.

Y cuando eso pasa, **la app no lo bloquea ni lo corrige**: calcula el monto real, lo muestra y
marca visualmente el día. La responsabilidad de no equivocarse es del usuario; el rol de la app
es hacer visible lo que pasó. Un total sobre el tope es exactamente el tipo de error que salta
solo si se muestra, y que se vuelve invisible si la app lo recorta en silencio.

### Ocupación duplicada de un puesto

El índice único es `(date, employee_id)`: garantiza que **nadie cobre dos bonos el mismo día**,
pero no impide que dos personas queden asignadas al mismo puesto.

- **No se bloquea.** Es un estado posible del sistema y hay que calcularlo, no rechazarlo.
- Bajo `POSITION_RATE`: cada asignación cobra la tarifa de su puesto. Dos personas en RIETER
  cobran 4.000 cada una. El total del día sube por encima del tope y se marca.
- Bajo `EQUAL_SHARE`: no tiene efecto especial, solo aumenta `n`.
- `PACKING_ACM` admite varios ocupantes **legítimamente** y no se marca nunca. La marca aplica
  solo a los cuatro puestos de tarifa.

### Casos de prueba obligatorios

Con los valores de ejemplo de arriba. Los tests construyen estas tarifas como fixture; no leen
la configuración de producción.

| # | Escenario | Esperado |
|---|---|---|
| 1 | 4 puestos POSITION_RATE completos | 4.000 / 4.000 / 4.000 / 3.000 · total 15.000 |
| 2 | POSITION_RATE sin operario ACM | 4.000 / 4.000 / 3.000 · total 11.000, sin redistribuir |
| 3 | POSITION_RATE solo con operario Rieter | 4.000 · total 4.000 |
| 4 | 4 puestos + 2 PACKING_ACM (n=6) | 2.500 c/u · total 15.000 |
| 5 | 4 puestos + 1 PACKING_ACM (n=5) | 2.500 c/u · total 12.500 |
| 6 | 4 puestos + 3 PACKING_ACM (n=7) | 2.142 c/u · total 14.994 |
| 7 | 30 personas en puestos bonificables | 500 c/u · total 15.000 |
| 8 | 3 puestos + 1 PACKING_ACM (n=4) | 2.500 c/u · total 10.000 |
| 9 | Día sin asignaciones bonificables | nadie cobra · total 0 |
| 10 | Persona con puesto de tipo ausencia | no cobra, no cuenta para n |
| 11 | Sábado con asignaciones bonificables | cobra igual, el bono no distingue día |
| 12 | Cambio de tarifas a mitad de cierre | cada día usa los parámetros vigentes en esa fecha |
| 13 | 2 personas en RIETER + los otros 3 puestos | 4.000 / 4.000 / 4.000 / 4.000 / 3.000 · total 19.000, **sobre el tope, marcado, no recortado** |
| 14 | 2 personas en RIETER + 1 PACKING_ACM (n=6) | 2.500 c/u · total 15.000, sin marca de tope |

Los casos 13 y 14 son la contraparte de la regla anterior y no pueden faltar: el 13 prueba que
`POSITION_RATE` no recorta, el 14 que la duplicación es inocua bajo `EQUAL_SHARE`.

### Reglas transversales

- El bono es **por día completo**. No hay medios bonos ni prorrateo por horas.
- Estar asignado a un puesto equivale a haber trabajado el día completo. Si alguien llegó tarde
  o se fue antes y no corresponde pagarle, el supervisor no lo asigna a ese puesto. La app no
  lleva control de asistencia.
- Aplica todos los días trabajados, incluidos sábados.
- Nadie cobra dos bonos el mismo día. Está garantizado por el índice único de la sección 6.
- Una persona con `active = false` que tiene asignaciones dentro del rango consultado **sí
  aparece** en ese rango (caso: desvinculado a mitad de mes). En rangos posteriores a su última
  asignación deja de aparecer.

### `PACKING` vs `PACKING_ACM`

`Packing` genérico se usa para packing de cualquier producto —absorbentes, copos, prensado—
con hasta 6 personas el mismo día, y **no genera bono**. `PACKING_ACM` es un puesto distinto y
nuevo, y es el único que cambia el esquema del día. En el selector de puestos tienen que estar
visualmente separados: confundirlos cambia el bono de todo el equipo de la línea.

---

## 6. Modelo de datos

PostgreSQL sobre Supabase. Nombres en inglés (ver `CLAUDE.md`). El proceso para introducir
cambios de schema está en `CONTRIBUTING.md` §6 y es más restrictivo de lo habitual: hay un solo
proyecto Supabase y es producción.

### Base para todas las entidades

```
id           uuid pk default gen_random_uuid()
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()   -- vía trigger, no desde el código
deleted_at   timestamptz null                     -- soft delete
```

**Detalle crítico con soft delete:** los índices únicos deben ser parciales
(`WHERE deleted_at IS NULL`). Sin eso, borrar y volver a crear una asignación del mismo día
choca contra la constraint.

### profiles

Extiende `auth.users` de Supabase. **Es la fuente del rol** y por lo tanto de todas las
policies de RLS. Sin esta tabla no hay forma de expresar "solo admin puede editar una
asignación liquidada" dentro de la base.

```
id    uuid pk references auth.users(id)
role  text not null    -- 'admin' | 'editor'
```

Se puebla con un trigger sobre `auth.users`, no desde el código de aplicación. El rol nunca se
lee desde el cliente para tomar decisiones de seguridad: la policy de RLS lo consulta en el
servidor. Ocultar un botón en la UI es cortesía, no control de acceso.

### employees

```
first_name, last_name  text not null
national_id            text unique          -- RUT, sin puntos, con guión
active                 boolean not null default true
```

Sin `display_order`: se ordena por nombre.

### positions

```
code           text unique not null    -- 'RIETER', 'PACKING_ACM', ...
name           text not null           -- etiqueta visible, en español
type           text not null           -- 'WORK' | 'ABSENCE'
bonus_eligible boolean not null default false
display_order  int not null
active         boolean not null default true
```

`display_order` existe por una razón concreta: alfabéticamente `Packing` y `Packing ACM` quedan
pegados en el selector, que es el error más caro posible. El orden manual permite separarlos y
poner arriba los cinco puestos de la línea.

`type = 'ABSENCE'` cubre `Licencia` y `Falta`. La celda en blanco sigue significando ausente,
como en la planilla actual; los puestos de ausencia son opcionales y solo para cuando se quiera
dejar constancia del motivo.

### assignments

```
date                   date not null
employee_id            uuid fk employees
position_id            uuid fk positions
note                   text
settled_in_period_id   uuid fk periods null    -- ver sección 7
settled_amount         int null                -- monto liquidado, congelado al cierre
created_by             uuid fk auth.users
updated_by             uuid fk auth.users

unique (date, employee_id) where deleted_at is null
```

El índice único es estructural y **no debe relajarse**: una persona ocupa un solo puesto por
día. Eso hace imposible por construcción que alguien cobre dos bonos el mismo día. Nótese que
**no** impide dos personas en el mismo puesto — eso es deliberado, ver sección 5.

### bonus_settings

Parámetros versionados por vigencia. **Nunca hardcodear montos.** Al cambiar una tarifa se crea
una vigencia nueva; los cierres ya calculados no se recalculan.

```
effective_from          date not null
effective_to            date null           -- null = vigente
daily_cap               int not null
max_amount_per_person   int not null
```

### bonus_position_rates

```
bonus_settings_id  uuid fk
position_id        uuid fk
amount             int not null
unique (bonus_settings_id, position_id)
```

Un puesto bonificable puede no tener fila acá: ver `PACKING_ACM` en la sección 5.

### periods

```
name          text not null        -- 'Julio 2026'
start_date    date not null
end_date      date not null
status        text not null        -- 'OPEN' | 'CLOSED'
closed_at     timestamptz
closed_by     uuid fk auth.users
```

Períodos contiguos, sin huecos ni traslapes. Al crear uno, `start_date` se precarga con
`end_date` del anterior + 1 día y no es editable; `end_date` sí.

La contigüidad se valida con una **constraint de exclusión** sobre `daterange(start_date,
end_date, '[]')`, lo que requiere habilitar la extensión `btree_gist` en la primera migración:

```sql
create extension if not exists btree_gist;

alter table periods add constraint periods_no_overlap
  exclude using gist (daterange(start_date, end_date, '[]') with &&)
  where (deleted_at is null);
```

### assignment_history

Append-only, poblada por trigger sobre `assignments` —no desde el código de aplicación, así no
depende de que alguien se acuerde de registrarlo.

```
assignment_id, date, employee_id
previous_position_id, new_position_id
changed_by, changed_at
```

### applied_operations

Soporta la idempotencia de la cola de escrituras (sección 10). Sin esta tabla, `opId` es una
promesa que no se puede cumplir.

```
op_id       uuid pk        -- generado en el cliente
applied_at  timestamptz not null default now()
applied_by  uuid fk auth.users
```

La escritura y la inserción del `op_id` ocurren en la **misma transacción**. Si el `op_id` ya
existe, la operación es un no-op y devuelve éxito. Un reenvío no produce efecto ni error.

Se puede purgar por antigüedad (por ejemplo, más de 90 días) sin afectar la corrección: una
operación tan vieja ya no está en la cola de ningún dispositivo.

---

## 7. Cierres y pagos pendientes

El período de bonos **no es el mes calendario**: corre aproximadamente del 25 de un mes al 24
del siguiente, y RRHH define la fecha exacta cada mes. En la práctica el 99% de los cierres son
el mes en curso, así que la interfaz debe proponer eso por defecto y dejar el rango libre como
excepción, no al revés.

**No se bloquea la edición de días ya cerrados.** La regla del negocio es que a nadie se le
niega un pago porque a la empresa se le olvidó registrarlo; lo que no se pagó un mes se paga al
siguiente. Eso se modela con liquidación diferida:

- Cerrar el período P estampa `settled_in_period_id = P` y `settled_amount` en **todas** las
  asignaciones bonificables no liquidadas con fecha `<= P.end_date`, sin importar si caen antes
  de `P.start_date`.
- Una asignación de un mes ya cerrado que se ingresa tarde queda sin estampar, y el cierre
  siguiente la recoge sola.
- El reporte del cierre separa dos subtotales: **días del período** y **arrastre de períodos
  anteriores**, para que RRHH pueda explicarle a un operario por qué le llegó distinto.
- `settled_amount` queda congelado. Si después cambian las tarifas o se corrige el día, lo ya
  pagado no se reescribe.

Editar una asignación ya liquidada queda restringido al rol `admin` vía RLS, y el cambio
aparece en una lista de revisión para RRHH.

### La lista de revisión

No es una tabla nueva. Es una **vista** sobre `assignment_history`: los cambios cuya asignación
tiene `settled_in_period_id` no nulo y cuyo `changed_at` es posterior al `closed_at` de ese
período.

```
Cambios sobre días ya liquidados, no reconocidos aún por RRHH.
```

Se agrega una columna `acknowledged_at timestamptz null` en `assignment_history` para que RRHH
pueda marcarlos como revisados y sacarlos de la bandeja. No hay descuentos automáticos ni
recálculo: la lista existe para que una persona decida qué hacer.

---

## 8. Pantallas

Diseño **web first**, adaptable a celular. El uso principal es desde el computador; el celular
tiene que funcionar bien, pero no manda el diseño.

### 8.1 Vista del día

- Selector de fecha con acceso rápido a hoy y ayer, y navegación libre a cualquier fecha pasada
  para completar registros olvidados.
- Grilla de personas activas con su puesto del día. En celular colapsa a lista vertical.
- **Abre en modo lectura.** Hay que apretar "Editar" para modificar algo. Aplica a todos los
  usuarios sin excepción, incluido el admin. Un misclic acá significa plata mal calculada.
- **El modo lectura no es una versión recortada.** Permite navegar meses anteriores, ver el
  resumen del día, abrir el detalle de cada persona y consultar el historial de cambios:
  exactamente lo mismo que el modo edición, menos escribir.
- Las celdas modificadas quedan marcadas. Al abrir una se ve su historial: quién, cuándo, de
  qué a qué.

### 8.2 Resumen del día

Visible al guardar y en cualquier momento desde la vista del día. **Sin alertas ni advertencias
bloqueantes.** La responsabilidad de no equivocarse es del usuario; el rol de la app es hacer
visible lo que pasó, no retar.

Muestra:

- Qué esquema quedó activo y **por qué**: "Reparto igualitario — hay 2 personas en Packing ACM.
  Todos los puestos de la línea ganan $2.500."
- Quiénes cobran y cuánto cada uno.
- El total del día.

Y marca dos situaciones, de forma pasiva y sin impedir nada:

- **Total sobre el tope diario.** "Total del día: $19.000 — sobre el tope de $15.000."
- **Puesto de línea con más de un ocupante.** "Rieter tiene 2 personas asignadas."

Ambas son casi siempre errores de tipeo, y ambas se corrigen cambiando la asignación. La app no
adivina cuál de las dos personas sobra.

### 8.3 Reporte del cierre

- Por defecto propone el cierre del mes en curso; el rango se puede ajustar.
- Tabla: persona, RUT, días con bono, monto del período, arrastre, total.
- Detalle expandible por persona: días, puesto, esquema y monto.
- Exportación a XLSX y CSV con las mismas columnas, para pegar en la planilla mensual.

### 8.4 Administración

Solo `admin`: personas, catálogo de puestos, tarifas (nueva vigencia), períodos, historial
completo y bandeja de revisión.

---

## 9. Autenticación

- **Nombre de usuario + PIN numérico.** Nada de correo como identificador visible. El usuario
  es el primer nombre en minúscula. Internamente se mapea a un correo sintético
  `usuario@cga.local` para trabajar con Supabase Auth.
- **Sin OTP.** Requiere mail o señal disponible justo al entrar, que es lo que no se puede
  asumir en planta.
- Sesión persistente larga con refresh automático. En el uso diario nadie debería tener que
  autenticarse.
- **RLS activo en todas las tablas, sin excepción.** Los cuatro usuarios leen todo; la
  diferencia de permisos está en escritura y en administración, y se expresa consultando
  `profiles.role`.

Esto último no es opcional. La `anon key` de Supabase es pública por diseño y este repositorio
también lo es: RLS es el único control de acceso real. Una tabla sin policy es una tabla que
cualquiera puede leer desde internet.

---

## 10. Conexión intermitente

Sin réplica local de la base. La app trabaja online contra Supabase y lo único que persiste
localmente es la cola de escrituras pendientes.

- Cada edición genera una operación con `opId` propio (uuid generado en el cliente), guardada
  en IndexedDB.
- Se envía de inmediato si hay conexión; si no, queda en cola y se reintenta al recuperarla.
- `opId` es clave de idempotencia en el servidor, respaldada por la tabla `applied_operations`:
  reenviar la misma operación no produce efecto ni error.
- Estado visible en lenguaje simple: "Sin conexión — 12 cambios guardados en este dispositivo",
  "Enviando cambios…", "Todo guardado".
- Si dos dispositivos mandan **el mismo valor** para la misma celda, es un no-op silencioso: no
  se registra cambio ni se muestra advertencia. Es el caso común y esperado.
- Si mandan valores **distintos**, gana el último y queda constancia en el historial. Nunca
  sobreescribir sin dejar rastro.

---

## 11. Datos iniciales

Sin migración. Se siembra el catálogo y se registra desde el día uno.

**Puestos bonificables:** Rieter, ACM, Encajador ACM, Alimentador Rieter, Packing ACM.

**Puestos de trabajo no bonificables:** Absorbente, Aseo, Bodega, Carda Coil, Carda Vieja,
Copos, Encajador Falus, Falu A1 Maxi, Falu A2 Maxi, Falu N1, Falu N2, Mantención, Packing,
Prensado, Supervisor.

**Puestos de ausencia:** Licencia, Falta.

**Se descartan del catálogo actual:** `bodega` en minúscula (duplicado de `Bodega`) y
`eliminado` (para eso está `active = false` en la persona).

**Personas y tarifas.** El seed lee un archivo local que **no se versiona** (`seed/*.local.*`,
ver `.gitignore`). Contiene los nombres, los RUT y los montos reales. El repositorio incluye
solo un archivo de ejemplo con datos ficticios para que cualquiera pueda levantar el proyecto.

---

## 12. Decisiones abiertas

Cosas que este documento **no** resuelve y que hay que decidir antes de implementarlas. Están
acá en vez de resueltas por defecto porque una suposición razonable en un cálculo de sueldos es
peor que una pregunta.

| # | Pregunta |
|---|---|
| 1 | ¿La marca de "puesto de línea con más de un ocupante" aplica también a días bajo `EQUAL_SHARE`, donde es inocua para el monto? El caso 14 asume que no. |
| 2 | ¿Qué pasa si se cierra un período y después se corrige una asignación **hacia abajo** (la persona no debía cobrar)? Hoy no hay descuento automático y queda en la bandeja de revisión, pero no está definido qué hace RRHH con eso. |
| 3 | ¿El PIN tiene largo fijo? ¿Hay bloqueo tras N intentos fallidos? Supabase Auth trata el PIN como password; conviene definir el largo mínimo antes de crear los usuarios. |
| 4 | ¿La bandeja de revisión notifica a alguien, o se consulta a demanda? |
| 5 | ¿Se purgan las operaciones de `applied_operations`? Se propone 90 días; falta confirmarlo. |

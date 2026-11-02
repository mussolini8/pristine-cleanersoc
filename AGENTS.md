<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas de Negocio: Steripax
- **Facturación al Cliente**: Para la cuenta comercial **Steripax**, la facturación se calcula a **$35 por hora × horas trabajadas** (ej. Octubre 2026: 150 horas = **$5,250.00**).
- **Jornada Nominal de Lucia Portillo**: A partir de ahora para Lucía Portillo se calcula la jornada nominal completa:
  - **Lunes, Martes y Viernes**: **6.00 horas exactas** (6h × $18.00/hr = **$108.00** por turno).
  - **Miércoles y Jueves**: **8.00 horas exactas** (8h × $18.00/hr = **$144.00** por turno).
- **Cálculo del Costo Total**: El costo total se calcula en base a esas horas trabajadas calculadas nominalmente (horas nominales × $18.00/hr, ej. Octubre 2026: 150 horas = **$2,700.00**).
- **Prohibición de Sobreescritura Automática**: NUNCA sobreescribir las horas ni el costo total de Steripax con fórmulas genéricas automatizadas (como 8h × $18 × 21.67 visitas = $3,386.06).
- **Nómina y Operaciones**: En nómina (Payroll) y aprobaciones, Steripax / Lucia Portillo siempre requiere revisión manual obligatoria (`requires_manual_review: true`).

# Reglas Salariales de Cleaners Comerciales
- **Emmi Guerra**: Gana **$18.15 por hora** (NO $18 como los demás). Cualquier cuenta comercial asignada a ella (ej. *ILG Westlake*, *ILG Valencia Office*) calcula su tarifa por servicio y costo de nómina en base a **$18.15/hr**. En actualizaciones masivas de tarifas a $18/hr, su tarifa de $18.15 debe preservarse.
- **Maria Lopez**: Gana **$22.00 por hora** (NO $18). Cualquier cuenta comercial asignada a ella (ej. *ILG Irvine Office*) calcula su tarifa por servicio y costo de nómina en base a **$22.00/hr**. En actualizaciones masivas de tarifas a $18/hr, su tarifa de $22.00 debe preservarse.
- **José Vazquez**: Limpiador comercial nuevo. Tel: **(714) 381-7555**, Email: **mikyvaz@gmail.com**. Gana **$18.00 por hora**. Realiza los días martes, viernes y sábado el turno adicional de 4 horas diarias en LSG Sky Chefs a $18.00/hr. Inició a trabajar el sábado 10 de octubre de 2026.
- **Ivanda Mejia**: Limpiadora comercial. Tel: **(760) 847-1052**, Email: **Ivandamejia4.1@gmail.com**. Gana **$18.00 por hora**. Trabajó en **ILG Corporate Headquarters** (antes conocida como *ILG Rancho Bernardo*) ÚNICAMENTE 3 días: viernes 16 de octubre (8h), lunes 19 de octubre (4h) y miércoles 21 de octubre (4h) a $18.00/hr (total 16 horas = $288.00). No tiene más turnos programados.
- **Martha Garcia**: Limpiadora comercial nueva. Tel: **(619) 289-1728**, Email: **m.garciasantiago2332@gmail.com**. Gana **$18.00 por hora**. Asignada a **ILG Corporate Headquarters** (San Diego / Rancho Bernardo, $2,420 rev / $826 costo). Tomó la cuenta desde el 25 de octubre de 2026. Turnos de octubre: domingo 25 (8h), lunes 26 (4h), miércoles 28 (4h) y viernes 30 (8h) (total 24 horas = $432.00). Horario regular sucesivo en nómina y próximos meses: Lunes (4h), Miércoles (4h), Viernes (8h) a **$18.00/hr**.
- **Tarifa Base General**: El resto de limpiadoras comerciales por hora tienen una tarifa estándar de **$18.00 por hora** (salvo cuentas de tarifa fija como Mama's a $200 y Green Leaf a $119).

# Reglas de Negocio: LSG Sky Chefs y Add-on
- **Precio Add-on**: LSG Sky Chefs tiene un add-on de **$5,359 al mes** (Precio total mensual: $16,109.00 / mes, sumando base $10,750 + add-on $5,359).
- **Tarifa y Horas del Add-on**:
  - **Luz Uribe**: 4 horas diarias a **$18.00 por hora** ($72.00 por turno) los días Monday, Wednesday, Thursday, Sunday.
  - **José Vazquez**: 4 horas diarias a **$18.00 por hora** ($72.00 por turno) los días Tuesday, Friday, Saturday.
  - **María Mejía (Excepción SOLO semana 19 al 25 de octubre de 2026)**: Acompañó a José en el add-on de 4 horas los días martes 20, viernes 23 y sábado 24 de octubre a $18.00/hr ($72/turno, 12 horas en total = $216.00). Aplicado estrictamente SOLO esa semana pasada en nómina.
- **Duración**: Duración de **un año calendario: hasta 31-12-2026**.

# Reglas de Perfil de Cuentas: Sistema de Complaints y Strikes
- **Notas de Complaints y 5 Checkmarks**: Cada perfil de cuenta comercial incluye una sección para registrar notas de complaints y hasta 5 checkmarks con fecha para control de SLA y calidad.
- **Vigencia de Año Calendario**: Duración de un año calendario (vigencia y límite hasta **31-12-2026**). Al llegar el 31-12-2026 se reinicia el período para el nuevo año calendario.

# Reglas de Pagos: Ana y Maria Lopez
- **Ana Morales**: Tiene asignada una regla de **80 horas cada quincena** ($1,440.00 por quincena a su tarifa de $18.00/hr). **SE MUESTRA ESTRICTAMENTE CADA QUINCENA (para el 15 y el último de mes), NO CADA SEMANA**. No tiene equivalente semanal de 40h ni $720/sem. En períodos semanales, NO se muestra salvo que la semana contenga el corte de quincena (el día 15 o el último día del mes), en cuyo caso se muestra con su pago quincenal completo de 80h ($1,440.00). En períodos quincenales ("Every 15 days"), se muestra siempre en cada quincena con 80 horas ($1,440.00).
- **Maria Lopez**: Tiene un **pago flat garantizado de $1,000 CADA QUINCE DÍAS** (para el 15 y el último de mes). **NO TIENE EQUIVALENTE SEMANAL DE $500/SEM**. En períodos quincenales ("Every 15 days"), su base flat es siempre de **$1,000** + casas de la quincena. En períodos semanales, su base flat de **$1,000** se aplica únicamente en la semana que contenga el corte de quincena (el día 15 o el último día del mes) + las casas de esa semana; en semanas regulares intermedias sin corte de quincena su base flat es **$0**, cobrando únicamente las casas realizadas en esa semana (+ Row). En períodos mensuales ("This month"), su base flat son **$2,000** ($1,000 × 2 quincenas) + casas del mes.

# Cuentas Comerciales Canceladas / Inactivas (A partir de Octubre 2026)
- **Mama's Restaurant Huntington Beach** y **Mama's Restaurant Los Alamitos**: Terminaron contrato el **30 de septiembre de 2026**. A partir del **1 de octubre de 2026** quedan **INACTIVAS** (`contract_end: "2026-09-30"`, `effective_until: "2026-09-30"`). NO deben programarse en el schedule semanal ni aparecer como cuentas comerciales activas comenzando octubre de 2026.
- **Field AI**: Terminó contrato el **31 de agosto de 2026**. Inactiva a partir de septiembre de 2026.

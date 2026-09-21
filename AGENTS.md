<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas de Negocio: Steripax
- **Cálculo Manual de Horas y Costo**: Para la cuenta comercial **Steripax** (cleaner: Lucia Portillo), las horas trabajadas **SE CALCULAN MANUALMENTE** (varían según el turno, ej. 6h lunes/martes/viernes y 8h miércoles/jueves, o reporte real de horas trabajadas).
- **Cálculo del Costo Total**: El costo total se calcula estrictamente **en base a esas horas trabajadas calculadas manualmente** (horas manuales × tarifa).
- **Prohibición de Sobreescritura Automática**: NUNCA sobreescribir las horas ni el costo total de Steripax con fórmulas genéricas automatizadas (como 8h × $18 × 21.67 visitas). En actualizaciones masivas de tarifas o sincronizaciones, Steripax debe mantenerse protegida como excepción con su cálculo manual y costo preservado ($3,386.06 o según horas manuales).
- **Nómina y Operaciones**: En nómina (Payroll) y aprobaciones, Steripax / Lucia Portillo siempre requiere revisión manual obligatoria (`requires_manual_review: true`).

# Reglas Salariales de Cleaners Comerciales
- **Emmi Guerra**: Gana **$18.15 por hora** (NO $18 como los demás). Cualquier cuenta comercial asignada a ella (ej. *ILG Westlake*, *ILG Valencia Office*) calcula su tarifa por servicio y costo de nómina en base a **$18.15/hr**. En actualizaciones masivas de tarifas a $18/hr, su tarifa de $18.15 debe preservarse.
- **Maria Lopez**: Gana **$22.00 por hora** (NO $18). Cualquier cuenta comercial asignada a ella (ej. *ILG Irvine Office*) calcula su tarifa por servicio y costo de nómina en base a **$22.00/hr**. En actualizaciones masivas de tarifas a $18/hr, su tarifa de $22.00 debe preservarse.
- **Tarifa Base General**: El resto de limpiadoras comerciales por hora tienen una tarifa estándar de **$18.00 por hora** (salvo cuentas de tarifa fija como Mama's a $200 y Green Leaf a $119).

# Reglas de Pagos: Ana y Maria Lopez
- **Ana Morales**: Tiene asignada una regla de **80 horas cada quincena** (equivalente a 40 horas por semana en períodos semanales). En pagos y nómina quincenales, sus horas asignadas son 80 horas (a su tarifa estándar de $18.00/hr = $1,440.00 por quincena).
- **Maria Lopez**: Tiene un **pago flat garantizado de $1,000 cada quincena** (equivalente a $500 por semana en pagos semanales). **Las casas son estrictamente semanales** (como se ha venido haciendo siempre): cada semana se le suman a su base flat las casas que haya hecho o se le agreguen en esa semana. En pagos semanales su total es: **$500 base semanal ($1,000 quincenal) + casas de la semana**. En pagos quincenales su total es: **$1,000 base quincenal + casas de la quincena**.



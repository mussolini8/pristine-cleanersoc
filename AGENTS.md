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
- **Ana Morales**: Tiene asignada una regla de **80 horas cada quincena** ($1,440.00 por quincena a su tarifa de $18.00/hr). **SE MUESTRA ESTRICTAMENTE CADA QUINCENA (para el 15 y el último de mes), NO CADA SEMANA**. No tiene equivalente semanal de 40h ni $720/sem. En períodos semanales, NO se muestra salvo que la semana contenga el corte de quincena (el día 15 o el último día del mes), en cuyo caso se muestra con su pago quincenal completo de 80h ($1,440.00). En períodos quincenales ("Every 15 days"), se muestra siempre en cada quincena con 80 horas ($1,440.00).
- **Maria Lopez**: Tiene un **pago flat garantizado de $1,000 CADA QUINCE DÍAS** (para el 15 y el último de mes). **NO TIENE EQUIVALENTE SEMANAL DE $500/SEM**. En períodos quincenales ("Every 15 days"), su base flat es siempre de **$1,000** + casas de la quincena. En períodos semanales, su base flat de **$1,000** se aplica únicamente en la semana que contenga el corte de quincena (el día 15 o el último día del mes) + las casas de esa semana; en semanas regulares intermedias sin corte de quincena su base flat es **$0**, cobrando únicamente las casas realizadas en esa semana (+ Row). En períodos mensuales ("This month"), su base flat son **$2,000** ($1,000 × 2 quincenas) + casas del mes.



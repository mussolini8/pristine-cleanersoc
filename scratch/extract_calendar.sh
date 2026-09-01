#!/bin/bash
cat src/components/operations/unified-operations-client.tsx | awk '/type CalendarView =/,/type NormalizedCalendarEvent =/{print}' > src/components/operations/shared-calendar.tsx
echo "" >> src/components/operations/shared-calendar.tsx
cat src/components/operations/unified-operations-client.tsx | awk '/function OperationsCalendar/,/^}$/{print}' >> src/components/operations/shared-calendar.tsx

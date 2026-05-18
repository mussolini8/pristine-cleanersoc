#!/usr/bin/env bash

set -e

echo ""
echo "============================================================"
echo "PRISTINE CLEANERS OC — FINAL CHECK PARA RENDER"
echo "============================================================"

echo ""
echo "1. Repo actual:"
pwd

echo ""
echo "2. Traer último estado de GitHub:"
git fetch origin --prune

echo ""
echo "3. Cambiar a main:"
git checkout main

echo ""
echo "4. Actualizar main:"
git pull origin main

echo ""
echo "5. Estado del repo:"
git status

echo ""
echo "6. Rama actual:"
CURRENT_BRANCH=$(git branch --show-current)
echo "$CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: No estás en main."
  exit 1
fi

echo ""
echo "7. Últimos commits locales:"
git log --oneline -10

echo ""
echo "8. Últimos commits en origin/main:"
git log origin/main --oneline -10

echo ""
echo "9. Confirmar que 5fb68cc está dentro de origin/main:"
if git branch -r --contains 5fb68cc | grep -q "origin/main"; then
  echo "OK: 5fb68cc está en origin/main."
else
  echo "ERROR: 5fb68cc NO está en origin/main."
  exit 1
fi

echo ""
echo "10. Confirmar commit actual:"
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Commit actual: $CURRENT_COMMIT"

echo ""
echo "11. Confirmar que el commit actual está en origin/main:"
if git branch -r --contains "$CURRENT_COMMIT" | grep -q "origin/main"; then
  echo "OK: commit actual está en origin/main."
else
  echo "ERROR: commit actual NO está en origin/main."
  exit 1
fi

echo ""
echo "12. Validar proyecto:"
npm run typecheck
npm run lint
npm run build
git diff --check

echo ""
echo "13. Confirmar que main está subido a GitHub:"
git push origin main

echo ""
echo "14. Revisar archivos de variables ejemplo sin secretos:"
echo ""
echo ".env.example:"
cat .env.example || true

echo ""
echo ".env.local.example:"
cat .env.local.example || true

echo ""
echo "15. Variables que deben existir en Render Environment:"
echo ""
echo "APP_BASE_URL"
echo "GMAIL_USER"
echo "GMAIL_APP_PASSWORD"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "OPERATIONS_MANAGER_EMAIL"
echo "OWNER_EMAIL"

echo ""
echo "============================================================"
echo "DEPLOY EN RENDER"
echo "============================================================"
echo ""
echo "Si Render está conectado a GitHub con Auto Deploy ON,"
echo "el push a origin/main debe disparar el deploy automáticamente."
echo ""
echo "Commit que Render debe desplegar:"
git log --oneline -1

echo ""
echo "Si tienes un Deploy Hook de Render, puedes ponerlo en una variable local:"
echo ""
echo "export RENDER_DEPLOY_HOOK_URL='https://api.render.com/deploy/....'"
echo ""
echo "y luego este script lo ejecutará automáticamente."
echo ""

if [ -n "$RENDER_DEPLOY_HOOK_URL" ]; then
  echo "Deploy Hook detectado. Disparando deploy manual en Render..."
  curl -X POST "$RENDER_DEPLOY_HOOK_URL"
  echo ""
  echo "OK: Deploy manual solicitado a Render."
else
  echo "No hay RENDER_DEPLOY_HOOK_URL configurado."
  echo "Render debe desplegar por Auto Deploy desde GitHub/main."
fi

echo ""
echo "============================================================"
echo "HEALTH CHECK OPCIONAL"
echo "============================================================"
echo ""
echo "Si tienes APP_BASE_URL en .env.local, intentaré probar la web."
echo ""

if [ -f ".env.local" ]; then
  APP_BASE_URL_VALUE=$(grep '^APP_BASE_URL=' .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
else
  APP_BASE_URL_VALUE=""
fi

if [ -n "$APP_BASE_URL_VALUE" ]; then
  echo "Probando APP_BASE_URL:"
  echo "$APP_BASE_URL_VALUE"
  echo ""
  curl -I "$APP_BASE_URL_VALUE" || true
  echo ""
  echo "Probando /login:"
  curl -I "$APP_BASE_URL_VALUE/login" || true
else
  echo "No encontré APP_BASE_URL en .env.local."
  echo "Puedes probar manualmente con:"
  echo "curl -I https://TU-APP.onrender.com/login"
fi

echo ""
echo "============================================================"
echo "RELEASE CHECK COMPLETO"
echo "============================================================"
echo ""
echo "Git está bien si viste:"
echo "- Rama actual: main"
echo "- origin/main contiene 5fb68cc"
echo "- commit actual está en origin/main"
echo "- typecheck/lint/build pasaron"
echo ""
echo "Ahora revisa Render:"
echo "1. Render Dashboard"
echo "2. Tu servicio"
echo "3. Events o Deploys"
echo "4. Debe aparecer deploy del commit actual de main"
echo ""
echo "QA en producción:"
echo "1. Cierra sesión."
echo "2. Login con pristinecleaners."
echo "3. Debe ver Residential / Pristine Cleaners."
echo "4. /commercial debe bloquear."
echo ""
echo "5. Cierra sesión."
echo "6. Login con pristinejanitorial."
echo "7. Debe ver Commercial / Pristine Janitorial."
echo "8. /residential debe bloquear."
echo ""
echo "Si el panel comercial todavía muestra residential,"
echo "entonces ya NO es Git ni branch."
echo "Sería Render env, Supabase Auth, schema, sesión/cache o lógica del panel."
echo "============================================================"


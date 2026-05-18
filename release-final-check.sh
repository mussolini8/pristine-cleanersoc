#!/usr/bin/env bash

set -e

echo ""
echo "============================================================"
echo "PRISTINE CLEANERS OC — FINAL RELEASE + VERCEL DEPLOY"
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
git branch --show-current

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
echo "13. Verificar Vercel CLI:"
if command -v vercel >/dev/null 2>&1; then
  echo "OK: Vercel CLI instalado."
else
  echo "Vercel CLI no está instalado. Instalando..."
  npm i -g vercel
fi

echo ""
echo "14. Verificar login en Vercel:"
if vercel whoami >/dev/null 2>&1; then
  echo "OK: sesión activa en Vercel."
else
  echo "No estás logueado en Vercel."
  echo "Ejecuta: vercel login"
  echo "Luego vuelve a correr: ./release-final-check.sh"
  exit 1
fi

echo ""
echo "15. Verificar link con proyecto Vercel:"
if [ -d ".vercel" ]; then
  echo "OK: proyecto linkeado con Vercel."
else
  echo "Proyecto no linkeado. Iniciando vercel link..."
  vercel link
fi

echo ""
echo "16. Variables de Vercel Production:"
vercel env ls production || true

echo ""
echo "============================================================"
echo "VARIABLES QUE DEBEN EXISTIR EN VERCEL PRODUCTION"
echo "============================================================"
echo "APP_BASE_URL"
echo "GMAIL_USER"
echo "GMAIL_APP_PASSWORD"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "OPERATIONS_MANAGER_EMAIL"
echo "OWNER_EMAIL"

echo ""
echo "17. Deploy a producción:"
vercel --prod

echo ""
echo "18. Deploys recientes:"
vercel ls || true

echo ""
echo "============================================================"
echo "RELEASE COMPLETO"
echo "============================================================"
echo ""
echo "Git ya está bien si viste:"
echo "- origin/main contiene 5fb68cc"
echo "- main está en caf4a4e o superior"
echo "- typecheck/lint/build pasaron"
echo ""
echo "Ahora prueba en producción:"
echo "1. Login con pristinecleaners"
echo "2. Debe ver Residential / Pristine Cleaners"
echo "3. /commercial debe bloquear"
echo ""
echo "4. Login con pristinejanitorial"
echo "5. Debe ver Commercial / Pristine Janitorial"
echo "6. /residential debe bloquear"
echo ""
echo "Si algo falla después de esto, ya NO es Git."
echo "Sería Vercel env, Supabase Auth, schema o lógica del panel."
echo "============================================================"


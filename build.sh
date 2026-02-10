#!/bin/bash

# Construcción de BlockGuard
# Este script construye y empaqueta la aplicación

echo "=============================================="
echo "BlockGuard - Build Script"
echo "=============================================="
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado"
    exit 1
fi
echo "✓ Node.js encontrado: $(node --version)"
echo ""

# Paso 1: Limpiar
echo "[1/3] Limpiando directorios anteriores..."
rm -rf dist
echo "   ✓ Directorio dist limpiado"
echo ""

# Paso 2: Instalar dependencias
echo "[2/3] Instalando dependencias..."
npm install
if [ $? -ne 0 ]; then
    echo "✗ Error: npm install falló"
    exit 1
fi
echo ""

# Paso 3: Ejecutar build personalizado
echo "[3/3] Compilando la aplicación..."
node build-app.js
if [ $? -ne 0 ]; then
    echo "✗ Error: build-app.js falló"
    exit 1
fi

echo ""
echo "=============================================="
echo "✓ ¡Construcción completada exitosamente!"
echo "📁 El instalador está en: dist/"
echo "=============================================="

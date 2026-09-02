'use client';

import { useEffect } from 'react';

const INPUT_TYPES_PERMITIDOS = new Set(['text', 'search', 'tel', 'url', 'email']);

function transformarAMayusculas(element: HTMLInputElement | HTMLTextAreaElement) {
  if (element.disabled || element.readOnly) return;
  if ('dataset' in element && element.dataset.noUppercase === 'true') return;

  const valorActual = element.value;
  const valorMayuscula = valorActual.normalize('NFC').toLocaleUpperCase('es-AR');
  if (valorActual === valorMayuscula) return;

  const inicio = element.selectionStart;
  const fin = element.selectionEnd;
  element.value = valorMayuscula;

  if (typeof inicio === 'number' && typeof fin === 'number') {
    element.setSelectionRange(inicio, fin);
  }
}

export function UppercaseInputGuard() {
  useEffect(() => {
    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) {
        transformarAMayusculas(target);
        return;
      }
      if (target instanceof HTMLInputElement) {
        const tipo = (target.type || 'text').toLowerCase();
        if (INPUT_TYPES_PERMITIDOS.has(tipo)) {
          transformarAMayusculas(target);
        }
      }
    };

    document.addEventListener('input', onInput, true);
    return () => {
      document.removeEventListener('input', onInput, true);
    };
  }, []);

  return null;
}


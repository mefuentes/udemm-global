export function normalizarMayusculas(valor: string): string {
  return valor.normalize('NFC').toLocaleUpperCase('es-AR');
}

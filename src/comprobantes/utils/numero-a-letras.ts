// Importe en letras para el comprobante impreso: "SON PESOS ... CON XX/100".
// Es un requisito de forma del comprobante A4, no un dato que AFIP valide.

const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS',
  'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE',
];

const DECENAS = [
  '', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

// 0-999
const menorAMil = (n: number): string => {
  if (n === 0) return '';
  if (n <= 20) return UNIDADES[n];
  if (n === 100) return 'CIEN';

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const prefijo = centena > 0 ? CENTENAS[centena] : '';

  if (resto === 0) return prefijo;

  let texto: string;
  if (resto <= 20) {
    texto = UNIDADES[resto];
  } else {
    const decena = Math.floor(resto / 10);
    const unidad = resto % 10;
    // "VEINTIDOS" va junto; de treinta en adelante lleva "Y"
    texto =
      decena === 2
        ? `${DECENAS[2]}${UNIDADES[unidad] ? UNIDADES[unidad].toLowerCase() : ''}`.toUpperCase()
        : unidad > 0
          ? `${DECENAS[decena]} Y ${UNIDADES[unidad]}`
          : DECENAS[decena];
  }

  return prefijo ? `${prefijo} ${texto}` : texto;
};

const enteroALetras = (n: number): string => {
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];

  // "UNO" se apocopa delante de MIL y MILLONES: VEINTIUN MIL, TREINTA Y UN MILLONES
  const apocopar = (n: number) => menorAMil(n).replace(/UNO$/, 'UN');

  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLON' : `${apocopar(millones)} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${apocopar(miles)} MIL`);
  }
  if (resto > 0) {
    partes.push(menorAMil(resto));
  }

  return partes.join(' ');
};

/**
 * Convierte un importe a su expresión en letras.
 * Los centavos van en formato XX/100, como es habitual en la factura argentina.
 */
export const importeALetras = (valor: number | string): string => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';

  const negativo = numero < 0;
  const absoluto = Math.abs(numero);
  // Redondear antes de partir evita que 0.999 quede como "CERO CON 100/100"
  const centavosTotales = Math.round(absoluto * 100);
  const entero = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;

  const letras = `${enteroALetras(entero)} CON ${String(centavos).padStart(2, '0')}/100`;
  return `SON PESOS ${negativo ? 'MENOS ' : ''}${letras}`;
};

/**
 * Cálculo de alícuotas de IVA para el comprobante electrónico.
 *
 * AFIP identifica cada alícuota con un Id fijo (FEParamGetTiposIva) y espera un
 * nodo <AlicIva> por alícuota presente, con su base imponible y su importe.
 */

/**
 * Alícuotas que el sistema permite cargar en un producto.
 * 27% existe en AFIP pero aplica a servicios regulados (telefonía, energía),
 * no a venta de productos: se deja fuera para no ofrecer una opción errónea.
 */
export const ALICUOTAS_IVA_VALIDAS = [0, 10.5, 21] as const;

/** Id de alícuota según AFIP (FEParamGetTiposIva) */
export const ALICUOTA_AFIP_ID: Record<string, number> = {
  '0': 3,     // 0%
  '10.5': 4,  // 10,5%
  '21': 5,    // 21%
  '27': 6,    // 27%
};

export interface ItemParaIva {
  /** Importe final del item, IVA incluido */
  subtotal: number | string;
  /** Alícuota del producto; si falta se asume la general */
  alicuota_iva?: number | string | null;
}

export interface DetalleAlicuota {
  /** Id que espera AFIP */
  id: number;
  /** Alícuota en porcentaje (21, 10.5, 0) */
  porcentaje: number;
  /** Base imponible (neto, sin IVA) */
  baseImponible: number;
  /** IVA de esa base */
  importe: number;
}

export interface TotalesIva {
  /** Suma de bases imponibles — va en ImpNeto */
  neto: number;
  /** Suma de IVA — va en ImpIVA */
  iva: number;
  /** Importe exento — va en ImpOpEx (alícuota 0) */
  exento: number;
  /** Un nodo por alícuota, sin incluir los exentos */
  alicuotas: DetalleAlicuota[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Desglosa los items por alícuota. Los precios del sistema son finales (IVA
 * incluido), así que cada subtotal se divide por (1 + alicuota/100) para obtener
 * la base imponible.
 */
export function calcularIvaDesdeItems(
  items: ItemParaIva[],
  alicuotaPorDefecto = 21,
): TotalesIva {
  const porAlicuota = new Map<number, { base: number; iva: number }>();
  let exento = 0;

  for (const item of items) {
    const bruto = Number(item.subtotal ?? 0);
    if (!bruto) continue;

    const alicuota = Number(item.alicuota_iva ?? alicuotaPorDefecto);

    // Exento / 0%: no genera IVA y va por ImpOpEx, no por el array de alícuotas
    if (!alicuota) {
      exento += bruto;
      continue;
    }

    const base = bruto / (1 + alicuota / 100);
    const iva = bruto - base;

    const acumulado = porAlicuota.get(alicuota) ?? { base: 0, iva: 0 };
    acumulado.base += base;
    acumulado.iva += iva;
    porAlicuota.set(alicuota, acumulado);
  }

  const alicuotas: DetalleAlicuota[] = [...porAlicuota.entries()]
    .map(([porcentaje, { base, iva }]) => ({
      id: ALICUOTA_AFIP_ID[String(porcentaje)] ?? ALICUOTA_AFIP_ID['21'],
      porcentaje,
      baseImponible: round2(base),
      importe: round2(iva),
    }))
    .sort((a, b) => a.porcentaje - b.porcentaje);

  return {
    neto: round2(alicuotas.reduce((s, a) => s + a.baseImponible, 0)),
    iva: round2(alicuotas.reduce((s, a) => s + a.importe, 0)),
    exento: round2(exento),
    alicuotas,
  };
}

/**
 * Reglas legales de la cuenta corriente comercial (Argentina).
 *
 * No es asesoramiento legal: son los limites que la practica y la jurisprudencia
 * suelen aceptar. Conviene revisarlos con un contador antes de produccion.
 */

/**
 * Tope de la tasa diaria de mora.
 *
 * El CCyC art. 771 faculta a los jueces a reducir de oficio los intereses que
 * consideren usurarios. El criterio habitual es no superar 2 a 2,5 veces la tasa
 * activa del Banco Nacion. 0,20% diario ronda el 73% anual, que queda dentro de
 * ese margen en un contexto normal.
 *
 * Ojo con la intuicion: un "1% diario" suena chico pero son 365% anual, y un juez
 * lo reduce sin dudar.
 */
export const TASA_MORA_DIARIA_MAXIMA = 0.2;

/**
 * Dias corridos que tiene el cliente para objetar el resumen de cuenta.
 *
 * El CCyC art. 1145 establece que el silencio NO vale como aceptacion salvo que
 * las partes lo hayan pactado. Por eso el resumen debe informar el plazo de forma
 * expresa, y el cliente debe haberlo aceptado al firmar la solicitud de credito.
 */
export const DIAS_OBJECION_RESUMEN = 30;

/** Leyenda del resumen. Sin esto el silencio del cliente no tiene efecto legal. */
export const LEYENDA_OBJECION_RESUMEN =
  `Si no recibimos observaciones dentro de los ${DIAS_OBJECION_RESUMEN} dias corridos ` +
  'de recibido este resumen, se lo considerara aceptado en los terminos acordados ' +
  'en la solicitud de credito. Ante cualquier diferencia, comuniquese con nosotros.';

/** Equivalente anual de una tasa diaria, para mostrarla donde se configura. */
export const tasaAnualEquivalente = (tasaDiaria: number): number =>
  Math.round(tasaDiaria * 365 * 100) / 100;

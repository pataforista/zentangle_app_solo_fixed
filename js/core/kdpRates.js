// kdpRates.js
// Tarifas de KDP usadas para estimar regalías. Archivo de datos: cuando KDP
// cambie sus tarifas, se cambia aquí y nada más.
//
// Fuentes (consultadas el 15 nov 2026):
//   - Coste de impresión de tapa blanda (Amazon.com):
//     https://kdp.amazon.com/en_US/help/topic/G201834340
//   - Regalías de tapa blanda (50 % por debajo de 9.99 USD; 60 % desde 9.99):
//     https://kdp.amazon.com/en_US/help/topic/G201834330
// Verificado solo lo que aparece en esas fuentes: B/N con papel blanco.
// Color y canal expandido NO están verificados: se devuelven como null y la
// tabla lo dice en lugar de inventar una cifra.

export const KDP_RATES_AS_OF = "2026-11-15";

// Coste de impresión en USD: fijo + por página. "large" = tamaños grandes
// (8.5×11 in entra aquí); "regular" = tamaños pequeños (6×9 in).
export const KDP_PRINT_COSTS = {
  blackWhite: { fixedCost: 1.0, perPage: { regular: 0.012, large: 0.017 } },
  colorPremium: null,
  colorStandard: null,
};

// Regalía por tramo de precio de lista (Amazon.com).
export const KDP_ROYALTY_BREAK_USD = 9.99;
export const KDP_ROYALTY_RATES_AMAZON = { below: 0.5, atOrAbove: 0.6 };

// Coste de impresión por libro (USD) o null si no hay tarifa verificada.
export function printCostUsd(pages, printType = "blackWhite", trim = "large") {
  const c = KDP_PRINT_COSTS[printType];
  if (!c) return null;
  return c.fixedCost + c.perPage[trim] * pages;
}

// Porcentaje de regalía según precio de lista y canal (null si no verificado).
export function royaltyRateUsd(price, channel = "amazon") {
  if (channel !== "amazon") return null;
  return price < KDP_ROYALTY_BREAK_USD ? KDP_ROYALTY_RATES_AMAZON.below : KDP_ROYALTY_RATES_AMAZON.atOrAbove;
}

// Regalía por venta con la fórmula de KDP: tarifa × precio − impresión.
export function royaltyPerSaleUsd(price, printCost, channel = "amazon") {
  const rate = royaltyRateUsd(price, channel);
  if (rate === null || printCost === null) return null;
  return rate * price - printCost;
}

// Precio mínimo de lista que deja regalía positiva.
export function minPriceForPositiveRoyalty(printCost, channel = "amazon") {
  if (printCost === null || channel !== "amazon") return null;
  const below = printCost / KDP_ROYALTY_RATES_AMAZON.below;
  if (below < KDP_ROYALTY_BREAK_USD) return below;
  return Math.max(KDP_ROYALTY_BREAK_USD, printCost / KDP_ROYALTY_RATES_AMAZON.atOrAbove);
}

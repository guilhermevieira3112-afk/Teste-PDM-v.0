import { TenantStockItem, StockMovement, PDMItem, ABCAnalysisItem, ABCSummary } from '../types/pdm';

export function calculateABCCurve(
  stockItems: TenantStockItem[],
  movements: StockMovement[],
  pdmItems: PDMItem[],
  periodMonths: number = 6
): { items: ABCAnalysisItem[]; summary: ABCSummary } {
  const pdmMap = new Map<string, PDMItem>(pdmItems.map((item) => [item.id, item]));

  // Calculate cut-off date based on period
  // We use the movements' date
  const now = new Date('2026-10-27T16:00:00Z');
  const cutoffDate = new Date(now.getTime() - periodMonths * 30 * 24 * 60 * 60 * 1000);

  // Group consumed quantities (Movement type 'OUT') by pdmItemId
  const consumedQuantities = new Map<string, number>();

  for (const mov of movements) {
    if (mov.type === 'OUT') {
      const movDate = new Date(mov.date);
      if (movDate >= cutoffDate) {
        const current = consumedQuantities.get(mov.pdmItemId) || 0;
        consumedQuantities.set(mov.pdmItemId, current + mov.quantity);
      }
    }
  }

  // Calculate consumed value for each stocked item
  const rawItems: {
    pdmItemId: string;
    pdmCode: string;
    internalCode: string;
    description: string;
    unitCost: number;
    currentStock: number;
    consumedQuantity: number;
    consumedValue: number;
    criticism: 'V' | 'E' | 'D';
  }[] = [];

  let grandTotalConsumedValue = 0;

  for (const stock of stockItems) {
    const pdm = pdmMap.get(stock.pdmItemId);
    const consumedQty = consumedQuantities.get(stock.pdmItemId) || 0;
    const consumedVal = consumedQty * stock.unitCost;
    grandTotalConsumedValue += consumedVal;

    rawItems.push({
      pdmItemId: stock.pdmItemId,
      pdmCode: pdm ? pdm.pdmCode : 'N/A',
      internalCode: stock.internalCode,
      description: pdm ? pdm.shortDescription : 'Item não catalogado',
      unitCost: stock.unitCost,
      currentStock: stock.currentStock,
      consumedQuantity: consumedQty,
      consumedValue: consumedVal,
      criticism: stock.criticism,
    });
  }

  // Sort descending by consumedValue
  rawItems.sort((a, b) => b.consumedValue - a.consumedValue);

  // Avoid division by zero
  const safeTotal = grandTotalConsumedValue > 0 ? grandTotalConsumedValue : 1;

  let runningSum = 0;
  const analyzedItems: ABCAnalysisItem[] = [];

  let countA = 0;
  let valA = 0;
  let countB = 0;
  let valB = 0;
  let countC = 0;
  let valC = 0;

  for (const item of rawItems) {
    runningSum += item.consumedValue;
    const itemPct = (item.consumedValue / safeTotal) * 100;
    const accumPct = (runningSum / safeTotal) * 100;

    let abcClass: 'A' | 'B' | 'C' = 'C';

    // Standard Industrial ABC Thresholds:
    // A represents up to 80% of accumulated consumption value
    // B represents next 15% (up to 95%)
    // C represents last 5% (up to 100%)
    if (accumPct <= 80 || (accumPct > 80 && runningSum - item.consumedValue < safeTotal * 0.70)) {
      abcClass = 'A';
      countA++;
      valA += item.consumedValue;
    } else if (accumPct <= 95 || (accumPct > 95 && runningSum - item.consumedValue < safeTotal * 0.90)) {
      abcClass = 'B';
      countB++;
      valB += item.consumedValue;
    } else {
      abcClass = 'C';
      countC++;
      valC += item.consumedValue;
    }

    analyzedItems.push({
      ...item,
      percentageOfTotal: itemPct,
      accumulatedPercentage: Math.min(100, accumPct),
      abcClass,
    });
  }

  const totalSKUs = analyzedItems.length;
  const safeSkuTotal = totalSKUs > 0 ? totalSKUs : 1;

  const summary: ABCSummary = {
    periodMonths,
    totalConsumedValue: grandTotalConsumedValue,
    totalSKUs,
    classA: {
      skuCount: countA,
      skuPercentage: (countA / safeSkuTotal) * 100,
      consumedValue: valA,
      valuePercentage: (valA / safeTotal) * 100,
    },
    classB: {
      skuCount: countB,
      skuPercentage: (countB / safeSkuTotal) * 100,
      consumedValue: valB,
      valuePercentage: (valB / safeTotal) * 100,
    },
    classC: {
      skuCount: countC,
      skuPercentage: (countC / safeSkuTotal) * 100,
      consumedValue: valC,
      valuePercentage: (valC / safeTotal) * 100,
    },
  };

  return { items: analyzedItems, summary };
}

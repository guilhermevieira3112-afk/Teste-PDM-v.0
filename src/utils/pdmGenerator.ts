import { SpecificSubgroup } from '../types/pdm';

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Common technical abbreviations for ERP 40-character field
 */
const ABBREVIATIONS: Record<string, string> = {
  'AÇO INOXIDÁVEL AISI 304 (A2-70)': 'INOX 304',
  'AÇO INOXIDÁVEL AISI 316 (A4-80)': 'INOX 316',
  'AÇO INOX ASTM A351 CF8M': 'CF8M INOX',
  'AÇO CARBONO ASTM A216 WCB': 'WCB CS',
  'AÇO CARBONO CLASSE 8.8': 'CL8.8',
  'AÇO LIGA CLASSE 10.9': 'CL10.9',
  'ASTM A325': 'A325',
  'POLIDO / PASSIVADO': 'PASSIV',
  'GALVANIZADO A FOGO': 'GALV FOGO',
  'ZINCADO BRANCO TRIVALENTE': 'ZN BRANCO',
  'OXIDADO NEGRO': 'OX NEGRO',
  'ABERTO (SEM VEDAÇÃO)': 'ABERTO',
  '2RS (BORRACHA NBR)': '2RS',
  '2Z (BLINDAGEM AÇO)': '2Z',
  'DDU (VEDAÇÃO DUPLA CONTATO)': 'DDU',
  'NORMAL (CN)': 'CN',
  'C3 (AUMENTADA)': 'C3',
  'C4 (EXTREMA)': 'C4',
  'C2 (REDUZIDA)': 'C2',
  'AÇO ESTAMPADO': 'ACO EST',
  'LATÃO USINADO': 'LATAO',
  'POLIAMIDA REFORÇADA (TN9)': 'TN9',
  'PTFE PURO (TEFLON)': 'PTFE',
  'PTFE REFORÇADO COM FIBRA DE VIDRO (RPTFE)': 'RPTFE',
  'GRAFOIL / METAL-METAL': 'GRAFOIL',
  'ALAVANCA MANUAL COM TRAVA': 'ALAV TRAVA',
  'ATUADOR PNEUMÁTICO DUPLA AÇÃO': 'ATUAD PNEUM',
  'ROSCA BSP': 'BSP',
  'ROSCA NPT': 'NPT',
  'ENCAIXE PARA SOLDA (SW)': 'SW',
  'FLANGEADA ANSI B16.5': 'FLG ANSI',
  '2 TRAMAS DE AÇO TRANÇADO (2SN)': '2SN',
  '4 ESPIRAIS DE AÇO (4SP)': '4SP',
  '4 ESPIRAIS DE ALTÍSSIMA PRESSÃO (4SH)': '4SH',
  'VAQUETA INTEGRAL PETROLEIRA': 'VAQ INTEGRAL',
  'VAQUETA COM DORSO EM RASPA': 'VAQ/RASPA',
  'CANO CURTO 7CM COM ELÁSTICO': 'CC 7CM',
  'CANO MÉDIO 15CM': 'CM 15CM',
  'CANO LONGO 20CM EM RASPA': 'CL 20CM',
  'P (TAMANHO 8)': 'TAM 8/P',
  'M (TAMANHO 9)': 'TAM 9/M',
  'G (TAMANHO 10)': 'TAM 10/G',
  'GG (TAMANHO 11)': 'TAM 11/GG',
  'TRILHO DIN 35MM / PARAFUSO': 'DIN 35MM',
  'TERMOMAGNÉTICO FIXO': 'TM FIXO',
  'TERMOMAGNÉTICO AJUSTÁVEL': 'TM AJUST',
  'ELETRÔNICO MICROPROCESSADO': 'ELET MPROC',
  '3 POLOS (TRIPOLAR)': '3P',
  '4 POLOS (TETRAPOLAR)': '4P',
};

function abbreviate(val: string): string {
  if (!val) return '';
  const clean = val.trim();
  const upper = clean.toUpperCase();
  for (const [key, abbr] of Object.entries(ABBREVIATIONS)) {
    if (upper === key.toUpperCase() || upper.includes(key.toUpperCase())) {
      return abbr;
    }
  }
  return normalizeText(clean);
}

/**
 * Builds Short Description (Strictly <= 60 characters for ERP standard)
 */
export function generateShortDescription(
  specSubgroup: SpecificSubgroup,
  attributes: Record<string, string>
): { shortDescription: string; charCount: number; isTruncated: boolean } {
  const parts: string[] = [specSubgroup.shortPrefix];

  const sortedDefs = [...specSubgroup.attributeDefinitions].sort(
    (a, b) => a.orderInNarrative - b.orderInNarrative
  );

  for (const def of sortedDefs) {
    const rawVal = attributes[def.id];
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      const abbrVal = abbreviate(String(rawVal));
      if (abbrVal) {
        if (def.unit && !abbrVal.includes(def.unit.toUpperCase())) {
          parts.push(`${abbrVal}${def.unit.toUpperCase()}`);
        } else {
          parts.push(abbrVal);
        }
      }
    }
  }

  let result = parts.join(' ').replace(/\s+/g, ' ').trim();
  result = normalizeText(result);

  const isTruncated = result.length > 60;
  const shortDescription = isTruncated ? result.substring(0, 60).trim() : result;

  return {
    shortDescription,
    charCount: shortDescription.length,
    isTruncated,
  };
}

/**
 * Builds Long Description (Complete technical narrative for procurement and engineering)
 */
export function generateLongDescription(
  specSubgroup: SpecificSubgroup,
  attributes: Record<string, string>
): string {
  const chunks: string[] = [specSubgroup.name.toUpperCase()];

  const sortedDefs = [...specSubgroup.attributeDefinitions].sort(
    (a, b) => a.orderInNarrative - b.orderInNarrative
  );

  for (const def of sortedDefs) {
    const rawVal = attributes[def.id];
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      const valStr = String(rawVal).trim();
      const unitStr = def.unit ? ` ${def.unit}` : '';
      chunks.push(`${def.label.toUpperCase()}: ${valStr}${unitStr}`);
    }
  }

  return chunks.join(', ') + '.';
}

/**
 * Compares two items and returns a similarity score (0 to 100) and match details
 */
export function calculateDuplicateSimilarity(
  newItem: { specificSubgroupId: string; attributes: Record<string, string>; shortDesc?: string },
  existingItem: { specificSubgroupId: string; attributes: Record<string, string>; shortDescription: string }
): { score: number; matchingKeys: string[]; divergentKeys: string[] } {
  let score = 0;
  const matchingKeys: string[] = [];
  const divergentKeys: string[] = [];

  // 1. Same specific subgroup is high indicator
  if (newItem.specificSubgroupId === existingItem.specificSubgroupId) {
    score += 40;
  } else {
    // If not even same subgroup, low probability
    return { score: 10, matchingKeys: [], divergentKeys: ['Subgrupo Taxonômico Diferente'] };
  }

  // 2. Compare attributes
  const allKeys = Array.from(
    new Set([...Object.keys(newItem.attributes || {}), ...Object.keys(existingItem.attributes || {})])
  );

  let evaluatedCount = 0;
  let matchingCount = 0;

  for (const key of allKeys) {
    const valA = String(newItem.attributes?.[key] || '').trim().toLowerCase();
    const valB = String(existingItem.attributes?.[key] || '').trim().toLowerCase();

    if (valA && valB) {
      evaluatedCount++;
      if (valA === valB) {
        matchingCount++;
        matchingKeys.push(key);
      } else {
        divergentKeys.push(key);
      }
    }
  }

  if (evaluatedCount > 0) {
    const attrMatchRatio = matchingCount / evaluatedCount;
    score += Math.round(attrMatchRatio * 50);
  }

  // 3. String overlap in short description
  if (newItem.shortDesc) {
    const tokensA = new Set(normalizeText(newItem.shortDesc).split(' '));
    const tokensB = new Set(normalizeText(existingItem.shortDescription).split(' '));
    let commonTokens = 0;
    tokensA.forEach((token) => {
      if (tokensB.has(token)) commonTokens++;
    });
    if (tokensA.size > 0) {
      const tokenOverlap = (commonTokens / tokensA.size) * 10;
      score += Math.round(tokenOverlap);
    }
  }

  const boundedScore = Math.min(100, Math.max(0, score));
  return { score: boundedScore, matchingKeys, divergentKeys };
}

import { PDMItem } from '../types/pdm';

export type SearchLogicMode = 'AND' | 'OR';

export interface SearchMatchResult {
  isMatch: boolean;
  matchedFields: ('code' | 'shortDesc' | 'narrative' | 'family' | 'ncm')[];
}

/**
 * Searches items taking into account TOTVS character constraints:
 * - Short description has up to 60 chars (Col AE)
 * - Narrative has up to 200 chars (Col AF - OEM part numbers, specs, notes)
 * - Supports logical AND (E) / OR (OU) across both fields and code
 */
export function matchTotvsSearch(
  item: PDMItem,
  query: string,
  mode: SearchLogicMode = 'AND'
): SearchMatchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { isMatch: true, matchedFields: [] };
  }

  // Detect explicit inline boolean operators like "termo1 OU termo2" or "termo1 E termo2"
  let effectiveMode = mode;
  let rawTokens: string[] = [];

  const upperQuery = trimmed.toUpperCase();
  if (upperQuery.includes(' OU ') || upperQuery.includes(' OR ')) {
    effectiveMode = 'OR';
    rawTokens = trimmed.split(/\s+(?:OU|OR)\s+/i).map((t) => t.trim()).filter(Boolean);
  } else if (upperQuery.includes(' E ') || upperQuery.includes(' AND ')) {
    effectiveMode = 'AND';
    rawTokens = trimmed.split(/\s+(?:E|AND)\s+/i).map((t) => t.trim()).filter(Boolean);
  } else {
    // Normal whitespace tokenization
    rawTokens = trimmed.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  }

  if (rawTokens.length === 0) {
    return { isMatch: true, matchedFields: [] };
  }

  const codeStr = (item.totvsCode || item.pdmCode || '').toLowerCase();
  const shortDescStr = (item.shortDescription || item.originalDescription || '').toLowerCase();
  const narrativeStr = (item.narrative || item.longDescription || '').toLowerCase();
  const familyStr = (item.totvsFamily || '').toLowerCase();
  const ncmStr = (item.ncm || '').toLowerCase();

  const matchedFieldsSet = new Set<'code' | 'shortDesc' | 'narrative' | 'family' | 'ncm'>();

  const tokenMatches = rawTokens.map((token) => {
    const t = token.toLowerCase();
    let tokenMatched = false;

    if (codeStr.includes(t)) {
      matchedFieldsSet.add('code');
      tokenMatched = true;
    }
    if (shortDescStr.includes(t)) {
      matchedFieldsSet.add('shortDesc');
      tokenMatched = true;
    }
    if (narrativeStr.includes(t)) {
      matchedFieldsSet.add('narrative');
      tokenMatched = true;
    }
    if (familyStr.includes(t)) {
      matchedFieldsSet.add('family');
      tokenMatched = true;
    }
    if (ncmStr.includes(t)) {
      matchedFieldsSet.add('ncm');
      tokenMatched = true;
    }

    return tokenMatched;
  });

  const isMatch =
    effectiveMode === 'AND'
      ? tokenMatches.every(Boolean)
      : tokenMatches.some(Boolean);

  return {
    isMatch,
    matchedFields: Array.from(matchedFieldsSet),
  };
}

/**
 * Matches an explicit list of validated search terms using strict AND logic
 * across item description (60c), technical narrative (200c), code, family, and NCM.
 */
export function matchTotvsTokens(
  item: PDMItem,
  tokens: string[]
): SearchMatchResult {
  const cleanTokens = tokens.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (cleanTokens.length === 0) {
    return { isMatch: true, matchedFields: [] };
  }

  const codeStr = (item.totvsCode || item.pdmCode || '').toLowerCase();
  const shortDescStr = (item.shortDescription || item.originalDescription || '').toLowerCase();
  const narrativeStr = (item.narrative || item.longDescription || '').toLowerCase();
  const familyStr = (item.totvsFamily || '').toLowerCase();
  const ncmStr = (item.ncm || '').toLowerCase();

  const matchedFieldsSet = new Set<'code' | 'shortDesc' | 'narrative' | 'family' | 'ncm'>();

  const allMatch = cleanTokens.every((t) => {
    let tokenMatched = false;

    if (shortDescStr.includes(t)) {
      matchedFieldsSet.add('shortDesc');
      tokenMatched = true;
    }
    if (narrativeStr.includes(t)) {
      matchedFieldsSet.add('narrative');
      tokenMatched = true;
    }
    if (codeStr.includes(t)) {
      matchedFieldsSet.add('code');
      tokenMatched = true;
    }
    if (familyStr.includes(t)) {
      matchedFieldsSet.add('family');
      tokenMatched = true;
    }
    if (ncmStr.includes(t)) {
      matchedFieldsSet.add('ncm');
      tokenMatched = true;
    }

    return tokenMatched;
  });

  return {
    isMatch: allMatch,
    matchedFields: Array.from(matchedFieldsSet),
  };
}


import { PDMItem } from '../types/pdm';

export interface WmsParseDiagnostic {
  lineNumber: number;
  code: string;
  rawLine: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface WmsParsedEntry {
  itemCode: string;
  wmsStock: number;
  wmsAddress: string;
  wmsAddresses: string[];
}

export interface WmsParseResult {
  fileName: string;
  fileSizeLabel: string;
  totalLines: number;
  validLines: number;
  uniqueItemsCount: number;
  matchedCatalogCount: number;
  unmatchedCount: number;
  totalPieces: number;
  addressesCount: number;
  entriesByCode: Map<string, WmsParsedEntry>;
  errors: WmsParseDiagnostic[];
  updatedAt: string;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 8).join('\n');
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

function parseLocaleNumber(raw: string): number {
  const cleaned = raw
    .replace(/["'\s]/g, '')
    .replace(/UN|PC|KG|LT|MT|CX/gi, '')
    .trim();
  if (!cleaned) return NaN;

  // Brazilian format "1.234,56" or "12,5"
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    return Number(normalized);
  }
  return Number(cleaned);
}

export async function readFileTextWithEncodingFallback(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(buffer);
  }
  return utf8;
}

export function parseWmsCsvText(
  csvText: string,
  fileName: string,
  fileSizeBytes: number,
  catalogItems: PDMItem[]
): WmsParseResult {
  const rawLines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd());

  const nonEmptyLines = rawLines
    .map((text, idx) => ({ text, lineNumber: idx + 1 }))
    .filter((entry) => entry.text.trim().length > 0);

  const fileSizeLabel =
    fileSizeBytes >= 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(fileSizeBytes / 1024))} KB`;

  const errors: WmsParseDiagnostic[] = [];
  const entriesByCode = new Map<string, WmsParsedEntry>();

  if (nonEmptyLines.length === 0) {
    errors.push({
      lineNumber: 1,
      code: '-',
      rawLine: '',
      reason: 'O arquivo CSV selecionado está vazio.',
      severity: 'error',
    });
    return {
      fileName,
      fileSizeLabel,
      totalLines: 0,
      validLines: 0,
      uniqueItemsCount: 0,
      matchedCatalogCount: 0,
      unmatchedCount: 0,
      totalPieces: 0,
      addressesCount: 0,
      entriesByCode,
      errors,
      updatedAt: new Date().toISOString(),
    };
  }

  const delimiter = detectDelimiter(nonEmptyLines.map((l) => l.text));

  // Detect header row among first 5 non-empty lines
  let headerRowIdx = -1;
  let codeCol = 0; // Col A default
  let qtyCol = 3; // Col D default (QTD)
  let addrCol = 4; // Col E default (ENDEREÇO)

  for (let i = 0; i < Math.min(5, nonEmptyLines.length); i++) {
    const cols = splitCsvLine(nonEmptyLines[i].text, delimiter).map(normalizeHeader);
    const hasQtyHeader = cols.some((c) => /^(QTD|QTDE|QUANTIDADE|SALDO|ESTOQUE)/.test(c));
    const hasAddrHeader = cols.some((c) => /(ENDERECO|POSICAO|LOCAL|RUA)/.test(c));
    const hasCodeHeader = cols.some((c) => /(ITEM|CODIGO|COD|PRODUTO|MATERIAL|TOTVS)/.test(c));

    if (hasQtyHeader || hasAddrHeader || hasCodeHeader) {
      headerRowIdx = i;
      const detectedCodeIdx = cols.findIndex((c) => /^(COD|CODIGO|ITEM|PRODUTO|MATERIAL|COD_ITEM|COD_TOTVS)/.test(c));
      const detectedQtyIdx = cols.findIndex((c) => /^(QTD|QTDE|QUANTIDADE|SALDO|QTD_WMS)/.test(c));
      const detectedAddrIdx = cols.findIndex((c) => /(ENDERECO|POSICAO|LOCALIZACAO)/.test(c));

      if (detectedCodeIdx >= 0) codeCol = detectedCodeIdx;
      if (detectedQtyIdx >= 0) qtyCol = detectedQtyIdx;
      if (detectedAddrIdx >= 0) addrCol = detectedAddrIdx;
      break;
    }
  }

  const startDataIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

  // Build quick lookup set of known catalog codes
  const knownCodes = new Set<string>();
  catalogItems.forEach((item) => {
    if (item.totvsCode) knownCodes.add(item.totvsCode.trim().toUpperCase());
    if (item.pdmCode) knownCodes.add(item.pdmCode.trim().toUpperCase());
  });

  let validLines = 0;
  let totalPieces = 0;
  const uniqueAddresses = new Set<string>();

  for (let i = startDataIdx; i < nonEmptyLines.length; i++) {
    const { text, lineNumber } = nonEmptyLines[i];
    const cols = splitCsvLine(text, delimiter);

    const rawCode = (cols[codeCol] || '').replace(/^"|"$/g, '').trim().toUpperCase();
    const rawQty = (cols[qtyCol] || '').replace(/^"|"$/g, '').trim();
    const rawAddr = (cols[addrCol] || '').replace(/^"|"$/g, '').trim().toUpperCase();

    if (!rawCode) {
      errors.push({
        lineNumber,
        code: '(vazio)',
        rawLine: text.slice(0, 120),
        reason: `Código TOTVS ausente na coluna ${String.fromCharCode(65 + codeCol)}.`,
        severity: 'error',
      });
      continue;
    }

    const parsedQty = parseLocaleNumber(rawQty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      errors.push({
        lineNumber,
        code: rawCode,
        rawLine: text.slice(0, 120),
        reason: `Quantidade inválida na Coluna ${String.fromCharCode(65 + qtyCol)} ("${rawQty || 'vazio'}").`,
        severity: 'error',
      });
      continue;
    }

    if (!rawAddr) {
      errors.push({
        lineNumber,
        code: rawCode,
        rawLine: text.slice(0, 120),
        reason: `Endereço WMS ausente na Coluna ${String.fromCharCode(65 + addrCol)}; saldo importado sem posição.`,
        severity: 'warning',
      });
    }

    if (knownCodes.size > 0 && !knownCodes.has(rawCode)) {
      errors.push({
        lineNumber,
        code: rawCode,
        rawLine: text.slice(0, 120),
        reason: 'Código não localizado no Catálogo Mestre TOTVS carregado.',
        severity: 'warning',
      });
    }

    validLines++;
    totalPieces += parsedQty;
    if (rawAddr) uniqueAddresses.add(rawAddr);

    const existing = entriesByCode.get(rawCode);
    if (existing) {
      existing.wmsStock = Math.round((existing.wmsStock + parsedQty) * 100) / 100;
      if (rawAddr && !existing.wmsAddresses.includes(rawAddr)) {
        existing.wmsAddresses.push(rawAddr);
        existing.wmsAddress = existing.wmsAddresses.join(', ');
      }
    } else {
      entriesByCode.set(rawCode, {
        itemCode: rawCode,
        wmsStock: Math.round(parsedQty * 100) / 100,
        wmsAddress: rawAddr,
        wmsAddresses: rawAddr ? [rawAddr] : [],
      });
    }
  }

  let matchedCatalogCount = 0;
  entriesByCode.forEach((_entry, code) => {
    if (knownCodes.has(code)) matchedCatalogCount++;
  });

  const totalDataLines = Math.max(0, nonEmptyLines.length - startDataIdx);

  return {
    fileName,
    fileSizeLabel,
    totalLines: totalDataLines,
    validLines,
    uniqueItemsCount: entriesByCode.size,
    matchedCatalogCount,
    unmatchedCount: entriesByCode.size - matchedCatalogCount,
    totalPieces: Math.round(totalPieces * 100) / 100,
    addressesCount: uniqueAddresses.size,
    entriesByCode,
    errors,
    updatedAt: new Date().toISOString(),
  };
}

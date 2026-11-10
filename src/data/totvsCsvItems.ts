import { PDMItem } from '../types/pdm';
import rawData from './totvsCsvItems.json';

export const TOTVS_CSV_PDM_ITEMS: PDMItem[] = rawData as unknown as PDMItem[];

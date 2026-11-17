import { AttributeDefinition } from '../types/pdm';
import { normalizeText } from './pdmGenerator';

export interface DynamicLevelSchema {
  shortPrefix: string;
  defaultNcm: string;
  categoryLabel: string;
  attributes: AttributeDefinition[];
}

export function validateUpperNoAccents(value: string): {
  isValid: boolean;
  hasAccents: boolean;
  hasLowercase: boolean;
} {
  if (!value) {
    return { isValid: true, hasAccents: false, hasLowercase: false };
  }
  const withoutAccents = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hasAccents = withoutAccents !== value;
  const hasLowercase = /[a-z]/.test(withoutAccents);
  return {
    isValid: !hasAccents && !hasLowercase,
    hasAccents,
    hasLowercase,
  };
}

export function sanitizeUpperNoAccents(value: string, maxLen?: number): string {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return typeof maxLen === 'number' ? clean.slice(0, maxLen) : clean;
}

function buildPrefixFromLevel3(nivel3: string, fallback: string): string {
  const clean = normalizeText(nivel3 || fallback)
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\b(DE|DA|DO|DOS|DAS|E|PARA|COM|SEM|EM)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return fallback;
  const words = clean.split(' ').slice(0, 3);
  return words.map((w) => w.slice(0, 5)).join(' ');
}

export function getDynamicSchemaForLevels(
  nivel1: string,
  nivel2: string,
  nivel3: string
): DynamicLevelSchema {
  const n1 = (nivel1 || '').toLowerCase();
  const n2 = (nivel2 || '').toLowerCase();
  const n3 = (nivel3 || '').toLowerCase();
  const combined = `${n1} ${n2} ${n3}`;
  const prefix = buildPrefixFromLevel3(nivel3, 'ITEM MRO');

  // 1. Rolamentos e Mancais
  if (combined.includes('rolamento') || combined.includes('mancal')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'ROLAMENTO'),
      defaultNcm: '8482.10.10',
      categoryLabel: 'Rolamentos e Mancais',
      attributes: [
        { id: 'bearing_series', name: 'bearing_series', label: 'Série / Modelo', type: 'text', placeholder: 'Ex: 6205, 6308, UCP 208', orderInNarrative: 1, required: false },
        { id: 'inner_diameter', name: 'inner_diameter', label: 'Diâmetro Interno', type: 'text', unit: 'mm', placeholder: 'Ex: 25', orderInNarrative: 2, required: false },
        { id: 'outer_diameter', name: 'outer_diameter', label: 'Diâmetro Externo', type: 'text', unit: 'mm', placeholder: 'Ex: 52', orderInNarrative: 3, required: false },
        { id: 'width', name: 'width', label: 'Largura / Altura', type: 'text', unit: 'mm', placeholder: 'Ex: 15', orderInNarrative: 4, required: false },
        { id: 'shielding', name: 'shielding', label: 'Blindagem / Vedação', type: 'select', options: ['ABERTO', '2RS', '2Z', 'DDU', 'ZZ'], orderInNarrative: 5, required: false },
        { id: 'clearance', name: 'clearance', label: 'Folga Radial', type: 'select', options: ['CN (Normal)', 'C3', 'C4', 'C2'], orderInNarrative: 6, required: false },
      ],
    };
  }

  // 2. Correias, Correntes, Polias, Engrenagens, Acoplamentos, Redutores, Eixos, Buchas
  if (combined.includes('correia')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'CORREIA'),
      defaultNcm: '4010.39.00',
      categoryLabel: 'Transmissão por Correias',
      attributes: [
        { id: 'belt_profile', name: 'belt_profile', label: 'Perfil / Passo', type: 'text', placeholder: 'Ex: A, B, SPZ, HTD 8M, AT10', orderInNarrative: 1, required: false },
        { id: 'length', name: 'length', label: 'Comprimento / Desenvolvimento', type: 'text', unit: 'mm', placeholder: 'Ex: 1200', orderInNarrative: 2, required: false },
        { id: 'width', name: 'width', label: 'Largura', type: 'text', unit: 'mm', placeholder: 'Ex: 25', orderInNarrative: 3, required: false },
        { id: 'ribs', name: 'ribs', label: 'Nº de Canais / Dentes', type: 'text', placeholder: 'Ex: 120 DENTES / 4 CANAIS', orderInNarrative: 4, required: false },
        { id: 'material', name: 'material', label: 'Material', type: 'select', options: ['BORRACHA', 'POLIURETANO', 'NEOPRENE', 'KEVLAR'], orderInNarrative: 5, required: false },
      ],
    };
  }

  if (combined.includes('corrente')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'CORRENTE'),
      defaultNcm: '7315.11.00',
      categoryLabel: 'Transmissão por Correntes',
      attributes: [
        { id: 'chain_norm', name: 'chain_norm', label: 'Passo / Norma', type: 'text', placeholder: 'Ex: ASA 50, ASA 60, 08B-1', orderInNarrative: 1, required: false },
        { id: 'rows', name: 'rows', label: 'Nº de Carreiras', type: 'select', options: ['SIMPLES', 'DUPLA', 'TRIPLA'], orderInNarrative: 2, required: false },
        { id: 'material', name: 'material', label: 'Material', type: 'select', options: ['ACO CARBONO', 'ACO INOX 304', 'ACO INOX 316', 'NIQUELADA'], orderInNarrative: 3, required: false },
        { id: 'length', name: 'length', label: 'Comprimento / Elos', type: 'text', placeholder: 'Ex: 5M ou 80 ELOS', orderInNarrative: 4, required: false },
      ],
    };
  }

  if (combined.includes('redutor')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'REDUTOR'),
      defaultNcm: '8483.40.10',
      categoryLabel: 'Redutores de Velocidade',
      attributes: [
        { id: 'ratio', name: 'ratio', label: 'Relação de Redução (i)', type: 'text', placeholder: 'Ex: 1:25, 1:40', orderInNarrative: 1, required: false },
        { id: 'power', name: 'power', label: 'Potência / Torque', type: 'text', placeholder: 'Ex: 3CV / 280NM', orderInNarrative: 2, required: false },
        { id: 'shaft', name: 'shaft', label: 'Eixo / Flange', type: 'text', placeholder: 'Ex: VAZADO 35MM FLANGE B5', orderInNarrative: 3, required: false },
        { id: 'mounting', name: 'mounting', label: 'Forma Construtiva', type: 'select', options: ['COAXIAL', 'ROSCA SEM FIM', 'HELICOIDAL', 'EIXO PARALELO', 'PLANETARIO'], orderInNarrative: 4, required: false },
      ],
    };
  }

  if (
    combined.includes('acoplamento') ||
    combined.includes('polia') ||
    combined.includes('engrenagem') ||
    combined.includes('bucha') ||
    combined.includes('eixo') ||
    combined.includes('esteira')
  ) {
    return {
      shortPrefix: prefix,
      defaultNcm: '8483.90.00',
      categoryLabel: 'Elementos Mecânicos & Transmissão',
      attributes: [
        { id: 'model_type', name: 'model_type', label: 'Tipo / Modelo Construtivo', type: 'text', placeholder: 'Ex: ELASTICO, Z-24, EIXO ESTRIADO', orderInNarrative: 1, required: false },
        { id: 'bore_diameter', name: 'bore_diameter', label: 'Diâmetro do Furo / Eixo', type: 'text', unit: 'mm', placeholder: 'Ex: 30', orderInNarrative: 2, required: false },
        { id: 'outer_diameter', name: 'outer_diameter', label: 'Diâmetro Externo / Passo', type: 'text', unit: 'mm', placeholder: 'Ex: 110', orderInNarrative: 3, required: false },
        { id: 'length', name: 'length', label: 'Comprimento / Largura', type: 'text', unit: 'mm', placeholder: 'Ex: 60', orderInNarrative: 4, required: false },
        { id: 'material', name: 'material', label: 'Material', type: 'select', options: ['ACO CARBONO', 'ACO INOX 304', 'ACO INOX 316', 'FERRO FUNDIDO', 'BRONZE', 'POLIACETAL / UHMW'], orderInNarrative: 5, required: false },
      ],
    };
  }

  // 3. Elementos de Fixação (Parafusos, Porcas, Arruelas, Abraçadeiras, etc.)
  if (combined.includes('abraçadeira') || combined.includes('abracadeira')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'ABRACADEIRA'),
      defaultNcm: '7326.90.90',
      categoryLabel: 'Fixação · Abraçadeiras',
      attributes: [
        { id: 'diameter_range', name: 'diameter_range', label: 'Faixa / Diâmetro Nominal', type: 'text', placeholder: 'Ex: 32-44MM ou 2 POL', orderInNarrative: 1, required: false },
        { id: 'band_width', name: 'band_width', label: 'Largura da Fita', type: 'text', unit: 'mm', placeholder: 'Ex: 12', orderInNarrative: 2, required: false },
        { id: 'material', name: 'material', label: 'Material', type: 'select', options: ['ACO INOX 304', 'ACO INOX 316', 'ACO CARBONO', 'NYLON / POLIAMIDA', 'UHMW'], orderInNarrative: 3, required: false },
        { id: 'clamp_type', name: 'clamp_type', label: 'Tipo de Aperto', type: 'select', options: ['ROSCA SEM FIM', 'TIPO T / MANGOTE', 'TIPO U', 'TIPO D', 'ABRACADEIRA NYLON'], orderInNarrative: 4, required: false },
      ],
    };
  }

  if (
    n1.includes('fixação') ||
    n1.includes('fixacao') ||
    combined.includes('parafuso') ||
    combined.includes('porca') ||
    combined.includes('arruela') ||
    combined.includes('chumbador') ||
    combined.includes('rebite') ||
    combined.includes('pino') ||
    combined.includes('anel')
  ) {
    return {
      shortPrefix: prefix,
      defaultNcm: '7318.15.00',
      categoryLabel: 'Elementos de Fixação',
      attributes: [
        { id: 'thread_diameter', name: 'thread_diameter', label: 'Diâmetro / Rosca Nominal', type: 'text', placeholder: 'Ex: M8, M12, 1/2 UNC', orderInNarrative: 1, required: false },
        { id: 'length', name: 'length', label: 'Comprimento / Espessura', type: 'text', unit: 'mm', placeholder: 'Ex: 40', orderInNarrative: 2, required: false },
        { id: 'thread_pitch', name: 'thread_pitch', label: 'Passo / Tipo de Cabeça', type: 'text', placeholder: 'Ex: MA ROSCA TOTAL / ALLEN', orderInNarrative: 3, required: false },
        { id: 'material_grade', name: 'material_grade', label: 'Material / Classe', type: 'select', options: ['INOX 304', 'INOX 316', 'ACO 8.8', 'ACO 10.9', 'ACO CARBONO', 'LATAO'], orderInNarrative: 4, required: false },
        { id: 'surface_finish', name: 'surface_finish', label: 'Acabamento', type: 'select', options: ['POLIDO', 'ZINCADO BRANCO', 'GALVANIZADO A FOGO', 'OXIDADO NEGRO'], orderInNarrative: 5, required: false },
      ],
    };
  }

  // 4. Motores Elétricos e Servomotores
  if (n1.includes('motores') || combined.includes('motor')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'MOTOR ELETRICO'),
      defaultNcm: '8501.52.10',
      categoryLabel: 'Motores e Acionamentos',
      attributes: [
        { id: 'power', name: 'power', label: 'Potência', type: 'text', placeholder: 'Ex: 5CV / 3.7KW', orderInNarrative: 1, required: false },
        { id: 'voltage', name: 'voltage', label: 'Tensão Nominal', type: 'select', options: ['220/380V', '380/660V', '220/440V', '440V', '24VCC'], orderInNarrative: 2, required: false },
        { id: 'rpm_poles', name: 'rpm_poles', label: 'Rotação / Polos', type: 'select', options: ['2 POLOS (3500RPM)', '4 POLOS (1750RPM)', '6 POLOS (1150RPM)', '8 POLOS (850RPM)'], orderInNarrative: 3, required: false },
        { id: 'frame_size', name: 'frame_size', label: 'Carcaça / Montagem', type: 'text', placeholder: 'Ex: 100L B3D / B5', orderInNarrative: 4, required: false },
        { id: 'protection', name: 'protection', label: 'Grau de Proteção', type: 'select', options: ['IP55', 'IP65', 'IP66', 'IP21'], orderInNarrative: 5, required: false },
      ],
    };
  }

  // 5. Automação, Instrumentação & Elétrica
  if (combined.includes('inversor') || combined.includes('fonte') || combined.includes('clp') || combined.includes('ihm')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '8504.40.50',
      categoryLabel: 'Automação & Potência',
      attributes: [
        { id: 'supply_voltage', name: 'supply_voltage', label: 'Tensão de Alimentação', type: 'text', placeholder: 'Ex: 380V TRIF / 24VCC', orderInNarrative: 1, required: false },
        { id: 'rated_current', name: 'rated_current', label: 'Corrente / Potência Nominal', type: 'text', placeholder: 'Ex: 10A / 5CV / 240W', orderInNarrative: 2, required: false },
        { id: 'output_spec', name: 'output_spec', label: 'Saída / Interface', type: 'text', placeholder: 'Ex: ETHERNET/IP, PROFIBUS, 24VCC', orderInNarrative: 3, required: false },
        { id: 'protection', name: 'protection', label: 'Grau de Proteção', type: 'select', options: ['IP20', 'IP54', 'IP65', 'IP67'], orderInNarrative: 4, required: false },
      ],
    };
  }

  if (combined.includes('sensor') || combined.includes('encoder')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '9031.80.99',
      categoryLabel: 'Sensores & Encoders',
      attributes: [
        { id: 'output_type', name: 'output_type', label: 'Tipo de Saída / Sinal', type: 'select', options: ['PNP', 'NPN', '4-20MA', '0-10V', 'INCREMENTAL HTL/TTL', 'ABSOLUTO'], orderInNarrative: 1, required: false },
        { id: 'voltage', name: 'voltage', label: 'Tensão de Operação', type: 'text', placeholder: 'Ex: 10-30VCC ou 24VCC', orderInNarrative: 2, required: false },
        { id: 'sensing_range', name: 'sensing_range', label: 'Alcance / Resolução (PPR)', type: 'text', placeholder: 'Ex: 8MM ou 1024 PPR', orderInNarrative: 3, required: false },
        { id: 'housing', name: 'housing', label: 'Formato / Rosca', type: 'text', placeholder: 'Ex: M12, M18, M30, QUADRADO', orderInNarrative: 4, required: false },
        { id: 'connection', name: 'connection', label: 'Conexão Elétrica', type: 'select', options: ['CONECTOR M12', 'CONECTOR M8', 'CABO 2M', 'CABO 5M'], orderInNarrative: 5, required: false },
      ],
    };
  }

  if (combined.includes('manômetro') || combined.includes('manometro') || combined.includes('instrumentação')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '9026.20.10',
      categoryLabel: 'Instrumentação de Medição',
      attributes: [
        { id: 'range', name: 'range', label: 'Faixa de Medição', type: 'text', placeholder: 'Ex: 0 A 10 BAR / 0 A 200C', orderInNarrative: 1, required: false },
        { id: 'dial_size', name: 'dial_size', label: 'Diâmetro do Mostrador', type: 'text', unit: 'mm', placeholder: 'Ex: 63 ou 100', orderInNarrative: 2, required: false },
        { id: 'process_conn', name: 'process_conn', label: 'Conexão ao Processo', type: 'text', placeholder: 'Ex: 1/4 NPT ou 1/2 BSP', orderInNarrative: 3, required: false },
        { id: 'fill_type', name: 'fill_type', label: 'Enchimento / Saída', type: 'select', options: ['COM GLICERINA', 'SECO', '4-20MA', 'PT100'], orderInNarrative: 4, required: false },
      ],
    };
  }

  if (n1.includes('elétrica') || n1.includes('eletrica') || n1.includes('automação')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '8536.50.90',
      categoryLabel: 'Elétrica & Comando',
      attributes: [
        { id: 'voltage', name: 'voltage', label: 'Tensão Nominal / Bobina', type: 'text', placeholder: 'Ex: 24VCC, 220VCA, 380V', orderInNarrative: 1, required: false },
        { id: 'current', name: 'current', label: 'Corrente / Bitola / Potência', type: 'text', placeholder: 'Ex: 32A, 2.5MM2, 50W', orderInNarrative: 2, required: false },
        { id: 'poles', name: 'poles', label: 'Polos / Contatos / Vias', type: 'text', placeholder: 'Ex: 3P, 1NA+1NF, 4 VIAS', orderInNarrative: 3, required: false },
        { id: 'mounting', name: 'mounting', label: 'Fixação / Grau IP', type: 'text', placeholder: 'Ex: TRILHO DIN / IP65', orderInNarrative: 4, required: false },
      ],
    };
  }

  // 6. Pneumática & Hidráulica & Utilidades (Cilindros, Válvulas, Bombas, Tubos, Conexões)
  if (combined.includes('cilindro')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'CILINDRO'),
      defaultNcm: '8412.31.10',
      categoryLabel: 'Atuadores & Cilindros',
      attributes: [
        { id: 'bore', name: 'bore', label: 'Diâmetro do Êmbolo', type: 'text', unit: 'mm', placeholder: 'Ex: 50', orderInNarrative: 1, required: false },
        { id: 'stroke', name: 'stroke', label: 'Curso', type: 'text', unit: 'mm', placeholder: 'Ex: 150', orderInNarrative: 2, required: false },
        { id: 'action', name: 'action', label: 'Ação', type: 'select', options: ['DUPLA ACAO', 'SIMPLES ACAO', 'HASTE PASSANTE', 'COMPACTO'], orderInNarrative: 3, required: false },
        { id: 'port_thread', name: 'port_thread', label: 'Conexão / Rosca', type: 'text', placeholder: 'Ex: 1/4 BSP', orderInNarrative: 4, required: false },
      ],
    };
  }

  if (combined.includes('válvula') || combined.includes('valvula')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'VALVULA'),
      defaultNcm: '8481.80.95',
      categoryLabel: 'Válvulas Industriais',
      attributes: [
        { id: 'nominal_diameter', name: 'nominal_diameter', label: 'Diâmetro Nominal / Bitola', type: 'text', placeholder: 'Ex: 1/2 POL, DN50, 1/4 BSP', orderInNarrative: 1, required: false },
        { id: 'pressure', name: 'pressure', label: 'Pressão / Classe', type: 'text', placeholder: 'Ex: 150 LBS, 300 LBS, 10 BAR', orderInNarrative: 2, required: false },
        { id: 'body_material', name: 'body_material', label: 'Material do Corpo', type: 'select', options: ['INOX 316', 'INOX 304', 'ACO CARBONO', 'LATAO', 'ALUMINIO', 'PVC'], orderInNarrative: 3, required: false },
        { id: 'actuation', name: 'actuation', label: 'Acionamento / Bobina', type: 'text', placeholder: 'Ex: SOLENOIDE 24VCC, PNEUMATICO, MANUAL', orderInNarrative: 4, required: false },
        { id: 'connection', name: 'connection', label: 'Conexão / Extremidade', type: 'select', options: ['BSP', 'NPT', 'FLANGEADA', 'TRI-CLAMP', 'SOLDA SW', 'ENGATE RAPIDO'], orderInNarrative: 5, required: false },
      ],
    };
  }

  if (combined.includes('bomba')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'BOMBA'),
      defaultNcm: '8413.70.90',
      categoryLabel: 'Bombas Industriais',
      attributes: [
        { id: 'flow_rate', name: 'flow_rate', label: 'Vazão Nominal', type: 'text', placeholder: 'Ex: 15 M3/H ou 40 L/MIN', orderInNarrative: 1, required: false },
        { id: 'pressure_head', name: 'pressure_head', label: 'Pressão / Altura Manométrica', type: 'text', placeholder: 'Ex: 35 MCA ou 120 BAR', orderInNarrative: 2, required: false },
        { id: 'power', name: 'power', label: 'Potência / Motor', type: 'text', placeholder: 'Ex: 5CV 220/380V', orderInNarrative: 3, required: false },
        { id: 'material', name: 'material', label: 'Material Construtivo', type: 'select', options: ['INOX 316', 'INOX 304', 'FERRO FUNDIDO', 'ALUMINIO'], orderInNarrative: 4, required: false },
        { id: 'ports', name: 'ports', label: 'Conexão Sucção / Recalque', type: 'text', placeholder: 'Ex: 2 X 1.1/2 POL', orderInNarrative: 5, required: false },
      ],
    };
  }

  if (n1.includes('pneumática') || n1.includes('pneumatica') || n1.includes('hidráulica') || n1.includes('hidraulica') || n1.includes('utilidades')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '7307.29.00',
      categoryLabel: 'Fluidos, Conexões e Utilidades',
      attributes: [
        { id: 'nominal_size', name: 'nominal_size', label: 'Diâmetro / Bitola', type: 'text', placeholder: 'Ex: 8MM, 1/2 POL, DN25', orderInNarrative: 1, required: false },
        { id: 'connection_type', name: 'connection_type', label: 'Tipo de Conexão / Rosca', type: 'text', placeholder: 'Ex: BSP, NPT, TRI-CLAMP, ENGATE RAPIDO', orderInNarrative: 2, required: false },
        { id: 'pressure_rating', name: 'pressure_rating', label: 'Pressão Máxima Trabalho', type: 'text', placeholder: 'Ex: 10 BAR, 250 BAR', orderInNarrative: 3, required: false },
        { id: 'material', name: 'material', label: 'Material', type: 'select', options: ['INOX 304', 'INOX 316', 'LATAO', 'ACO CARBONO', 'POLIURETANO (PU)', 'BORRACHA'], orderInNarrative: 4, required: false },
      ],
    };
  }

  // 7. Filtragem e Separação
  if (n1.includes('filtragem') || combined.includes('filtro')) {
    return {
      shortPrefix: buildPrefixFromLevel3(nivel3, 'FILTRO'),
      defaultNcm: '8421.29.90',
      categoryLabel: 'Filtragem e Separação',
      attributes: [
        { id: 'micron_rating', name: 'micron_rating', label: 'Grau de Filtragem', type: 'text', placeholder: 'Ex: 5 MICRA, 10 MICRA, MESH 100', orderInNarrative: 1, required: false },
        { id: 'dimensions', name: 'dimensions', label: 'Dimensões (Ø x Comp)', type: 'text', placeholder: 'Ex: 140 X 350MM', orderInNarrative: 2, required: false },
        { id: 'flow_pressure', name: 'flow_pressure', label: 'Vazão / Pressão Máx.', type: 'text', placeholder: 'Ex: 50 L/MIN / 10 BAR', orderInNarrative: 3, required: false },
        { id: 'media_material', name: 'media_material', label: 'Meio Filtrante', type: 'select', options: ['POLIPROPILENO', 'CELULOSE', 'MICROFIBRA VIDRO', 'TELA INOX', 'CARVAO ATIVADO'], orderInNarrative: 4, required: false },
      ],
    };
  }

  // 8. Vedação e Isolamento
  if (n1.includes('vedação') || n1.includes('vedacao') || combined.includes('retentor') || combined.includes('o-ring') || combined.includes('gaxeta') || combined.includes('selo') || combined.includes('junta')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '4016.93.00',
      categoryLabel: 'Vedação e Isolamento',
      attributes: [
        { id: 'inner_diameter', name: 'inner_diameter', label: 'Diâmetro Interno / Eixo', type: 'text', unit: 'mm', placeholder: 'Ex: 35', orderInNarrative: 1, required: false },
        { id: 'outer_diameter', name: 'outer_diameter', label: 'Diâmetro Externo', type: 'text', unit: 'mm', placeholder: 'Ex: 55', orderInNarrative: 2, required: false },
        { id: 'thickness', name: 'thickness', label: 'Altura / Cordão / Espessura', type: 'text', unit: 'mm', placeholder: 'Ex: 10 ou 3.53', orderInNarrative: 3, required: false },
        { id: 'elastomer', name: 'elastomer', label: 'Material / Elastômero', type: 'select', options: ['NBR (NITRILICA)', 'VITON (FKM)', 'SILICONE', 'EPDM', 'PTFE', 'SIC / CARVAO'], orderInNarrative: 4, required: false },
        { id: 'profile', name: 'profile', label: 'Perfil / Modelo', type: 'text', placeholder: 'Ex: BRG, BAO, TIPO 21', orderInNarrative: 5, required: false },
      ],
    };
  }

  // 9. Lubrificação e Químicos Industriais
  if (n1.includes('lubrificação') || n1.includes('lubrificacao') || n1.includes('químico') || n1.includes('quimico')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '2710.19.32',
      categoryLabel: 'Lubrificantes e Químicos',
      attributes: [
        { id: 'grade_viscosity', name: 'grade_viscosity', label: 'Viscosidade / Grau / Concentração', type: 'text', placeholder: 'Ex: ISO VG 68, NLGI 2, 10W40', orderInNarrative: 1, required: false },
        { id: 'base_type', name: 'base_type', label: 'Base / Grau Alimentício', type: 'select', options: ['ALIMENTICIO NSF H1', 'SINTETICO', 'MINERAL', 'SEMI-SINTETICO', 'AQUOSO / ALCALINO'], orderInNarrative: 2, required: false },
        { id: 'package_size', name: 'package_size', label: 'Embalagem / Volume', type: 'text', placeholder: 'Ex: BALDE 20L, CARTUCHO 400G, TAMBOR 200L', orderInNarrative: 3, required: false },
      ],
    };
  }

  // 10. Segurança (EPIs), Soldagem, Ferramentas, Consumíveis
  if (n1.includes('segurança') || n1.includes('seguranca')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '3926.20.00',
      categoryLabel: 'Segurança Industrial (EPI)',
      attributes: [
        { id: 'size', name: 'size', label: 'Tamanho / Numeração', type: 'text', placeholder: 'Ex: M, G, GG, 41', orderInNarrative: 1, required: false },
        { id: 'ca_number', name: 'ca_number', label: 'Nº C.A. (Certificado Aprovação)', type: 'text', placeholder: 'Ex: CA 38542', orderInNarrative: 2, required: false },
        { id: 'material', name: 'material', label: 'Material / Proteção', type: 'text', placeholder: 'Ex: VAQUETA, NITRILICA, POLICARBONATO', orderInNarrative: 3, required: false },
      ],
    };
  }

  if (n1.includes('ferramenta') || n1.includes('soldagem') || n1.includes('consumíveis') || n1.includes('consumiveis')) {
    return {
      shortPrefix: prefix,
      defaultNcm: '8205.59.00',
      categoryLabel: 'Ferramentas, Soldagem e Consumíveis',
      attributes: [
        { id: 'spec_measure', name: 'spec_measure', label: 'Medida / Bitola / Grão', type: 'text', placeholder: 'Ex: 13MM, 2.5MM, GRAO 80', orderInNarrative: 1, required: false },
        { id: 'material_alloy', name: 'material_alloy', label: 'Material / Liga / Norma', type: 'text', placeholder: 'Ex: CR-V, ER308L, HSS', orderInNarrative: 2, required: false },
        { id: 'application', name: 'application', label: 'Aplicação / Tipo', type: 'text', placeholder: 'Ex: CORTE INOX, APERTO', orderInNarrative: 3, required: false },
      ],
    };
  }

  // Fallback genérico dinâmico baseado nos 3 níveis
  return {
    shortPrefix: prefix,
    defaultNcm: '8487.90.00',
    categoryLabel: nivel1 || 'Item Industrial MRO',
    attributes: [
      { id: 'spec_model', name: 'spec_model', label: 'Modelo / Especificação Técnica', type: 'text', placeholder: 'Ex: Modelo ou série', orderInNarrative: 1, required: false },
      { id: 'dimensions', name: 'dimensions', label: 'Dimensões / Capacidade', type: 'text', placeholder: 'Ex: 50X30MM / 220V', orderInNarrative: 2, required: false },
      { id: 'material', name: 'material', label: 'Material Construtivo', type: 'text', placeholder: 'Ex: ACO INOX 304 / POLIURETANO', orderInNarrative: 3, required: false },
      { id: 'application', name: 'application', label: 'Aplicação / Máquina', type: 'text', placeholder: 'Ex: EXTRUSORA / ENSACADORA', orderInNarrative: 4, required: false },
    ],
  };
}

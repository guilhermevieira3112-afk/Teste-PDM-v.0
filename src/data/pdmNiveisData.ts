// Base oficial de Níveis PDM PremieRpet MRO (Nível 1, Nível 2, Nível 3)
// Origem: Niveis_PDM_MRO_Padronizado_a06391b2.csv

export interface PdmNivelItem {
  id: string;
  nivel1: string; // Nível 1: Grupo Macro
  nivel2: string; // Nível 2: Subgrupo / Família
  nivel3: string; // Nível 3: Subgrupo Específico
}

export const INITIAL_PDM_NIVEIS: PdmNivelItem[] = [
  {
    "id": "lvl-1",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Controladores",
    "nivel3": "Módulo CLP / E/S"
  },
  {
    "id": "lvl-2",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Encoders",
    "nivel3": "Encoder Incremental / Absoluto"
  },
  {
    "id": "lvl-3",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Instrumentação de Medição",
    "nivel3": "Manômetro de Pressão"
  },
  {
    "id": "lvl-4",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Interface Homem Máquina",
    "nivel3": "Painel IHM Touch Screen"
  },
  {
    "id": "lvl-5",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Inversores",
    "nivel3": "Inversor de Frequência"
  },
  {
    "id": "lvl-6",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Sensores Fotoelétricos",
    "nivel3": "Transmissor de Sinal"
  },
  {
    "id": "lvl-7",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Sensores de Proximidade",
    "nivel3": "Sensor Fotoelétrico"
  },
  {
    "id": "lvl-8",
    "nivel1": "Automação e Instrumentação",
    "nivel2": "Sensores Indutivo",
    "nivel3": "Sensor de Proximidade Indutivo"
  },
  {
    "id": "lvl-9",
    "nivel1": "Consumíveis de Manutenção",
    "nivel2": "Materiais Consumíveis Gerais",
    "nivel3": "Item Consumível de Almoxarifado"
  },
  {
    "id": "lvl-10",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira Diversas"
  },
  {
    "id": "lvl-11",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira de Acoplamento"
  },
  {
    "id": "lvl-12",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira Inox"
  },
  {
    "id": "lvl-13",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira UHMW"
  },
  {
    "id": "lvl-14",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira para Mangueira"
  },
  {
    "id": "lvl-15",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Abraçadeiras",
    "nivel3": "Abraçadeira para Cabos/Eletrodutos"
  },
  {
    "id": "lvl-16",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Porcas",
    "nivel3": "Porca Diversas"
  },
  {
    "id": "lvl-17",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Anel",
    "nivel3": "Anel de Retenção / Trava"
  },
  {
    "id": "lvl-18",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Rebites",
    "nivel3": "Rebite de Repuxo / Pop"
  },
  {
    "id": "lvl-19",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Arruelas",
    "nivel3": "Arruela Diversas"
  },
  {
    "id": "lvl-20",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Arruelas",
    "nivel3": "Arruela de Pressão"
  },
  {
    "id": "lvl-21",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Arruelas",
    "nivel3": "Arruela Lisa"
  },
  {
    "id": "lvl-22",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Chumbadors",
    "nivel3": "Chumbador de Expansão"
  },
  {
    "id": "lvl-23",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Parafusos",
    "nivel3": "Parafuso Oco / Banjo"
  },
  {
    "id": "lvl-24",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Parafusos",
    "nivel3": "Parafuso Diversos"
  },
  {
    "id": "lvl-25",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Pinos",
    "nivel3": "Pino Elástico / Guia"
  },
  {
    "id": "lvl-26",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Parafusos",
    "nivel3": "Parafuso Sextavado"
  },
  {
    "id": "lvl-27",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Parafusos",
    "nivel3": "Parafuso Fenda / Philips"
  },
  {
    "id": "lvl-28",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Parafusos",
    "nivel3": "Parafuso Allen"
  },
  {
    "id": "lvl-29",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Porcas",
    "nivel3": "Porca Sextavada"
  },
  {
    "id": "lvl-30",
    "nivel1": "Elementos de Fixação",
    "nivel2": "Porcas",
    "nivel3": "Porca Autotravante"
  },
  {
    "id": "lvl-31",
    "nivel1": "Elétrica",
    "nivel2": "Relés",
    "nivel3": "Relé de Interface"
  },
  {
    "id": "lvl-32",
    "nivel1": "Elétrica",
    "nivel2": "Tomadas e Conectores",
    "nivel3": "Conector / Borne de Passagem"
  },
  {
    "id": "lvl-33",
    "nivel1": "Elétrica",
    "nivel2": "Cabos",
    "nivel3": "Cabo Elétrico Diversos"
  },
  {
    "id": "lvl-34",
    "nivel1": "Elétrica",
    "nivel2": "Relés",
    "nivel3": "Relé Diversos"
  },
  {
    "id": "lvl-35",
    "nivel1": "Elétrica",
    "nivel2": "Sensores",
    "nivel3": "Sensor Elétrico"
  },
  {
    "id": "lvl-36",
    "nivel1": "Elétrica",
    "nivel2": "Cabos",
    "nivel3": "Cabo Silicone Alta Temp"
  },
  {
    "id": "lvl-37",
    "nivel1": "Elétrica",
    "nivel2": "Cabos",
    "nivel3": "Cabo Blindado"
  },
  {
    "id": "lvl-38",
    "nivel1": "Elétrica",
    "nivel2": "Cabos",
    "nivel3": "Cabo Flexível"
  },
  {
    "id": "lvl-39",
    "nivel1": "Elétrica",
    "nivel2": "Fontes",
    "nivel3": "Fonte Chaveada 24V"
  },
  {
    "id": "lvl-40",
    "nivel1": "Elétrica",
    "nivel2": "Painéis",
    "nivel3": "Painel de Comando"
  },
  {
    "id": "lvl-41",
    "nivel1": "Elétrica",
    "nivel2": "Contatores",
    "nivel3": "Contator Tripolar"
  },
  {
    "id": "lvl-42",
    "nivel1": "Elétrica",
    "nivel2": "Disjuntores",
    "nivel3": "Disjuntor Termomagnético DIN"
  },
  {
    "id": "lvl-43",
    "nivel1": "Elétrica",
    "nivel2": "Disjuntores",
    "nivel3": "Disjuntor Motor"
  },
  {
    "id": "lvl-44",
    "nivel1": "Elétrica",
    "nivel2": "Iluminação",
    "nivel3": "Luminária / Lâmpada LED"
  },
  {
    "id": "lvl-45",
    "nivel1": "Elétrica",
    "nivel2": "Relés",
    "nivel3": "Relé Térmico"
  },
  {
    "id": "lvl-46",
    "nivel1": "Elétrica",
    "nivel2": "Disjuntores",
    "nivel3": "Disjuntor Caixa Moldada"
  },
  {
    "id": "lvl-47",
    "nivel1": "Ferramentas",
    "nivel2": "Ferramentas Manuais",
    "nivel3": "Ferramentas Manuais Diversas"
  },
  {
    "id": "lvl-48",
    "nivel1": "Ferramentas",
    "nivel2": "Ferramentas de Usinagem",
    "nivel3": "Broca / Macho de Roscar"
  },
  {
    "id": "lvl-49",
    "nivel1": "Ferramentas",
    "nivel2": "Abrasivos",
    "nivel3": "Disco de Corte / Lixa"
  },
  {
    "id": "lvl-50",
    "nivel1": "Filtragem e Separação",
    "nivel2": "Filtros Industriais",
    "nivel3": "Filtro de Ar"
  },
  {
    "id": "lvl-51",
    "nivel1": "Filtragem e Separação",
    "nivel2": "Filtros Industriais",
    "nivel3": "Elemento Filtrante"
  },
  {
    "id": "lvl-52",
    "nivel1": "Filtragem e Separação",
    "nivel2": "Filtros Industriais",
    "nivel3": "Filtro Diversos"
  },
  {
    "id": "lvl-53",
    "nivel1": "Filtragem e Separação",
    "nivel2": "Filtros Industriais",
    "nivel3": "Filtro de Óleo"
  },
  {
    "id": "lvl-54",
    "nivel1": "Hidráulica",
    "nivel2": "Hidráulica Diversos",
    "nivel3": "Componente Hidráulico Genérico"
  },
  {
    "id": "lvl-55",
    "nivel1": "Hidráulica",
    "nivel2": "Cilindros Hidráulicos",
    "nivel3": "Cilindro Hidráulico Industrial"
  },
  {
    "id": "lvl-56",
    "nivel1": "Hidráulica",
    "nivel2": "Válvulas Hidráulicas",
    "nivel3": "Válvula Direcional Hidráulica"
  },
  {
    "id": "lvl-57",
    "nivel1": "Hidráulica",
    "nivel2": "Bombas Hidráulicas",
    "nivel3": "Bomba Hidráulica de Pistões"
  },
  {
    "id": "lvl-58",
    "nivel1": "Lubrificação",
    "nivel2": "Acessórios de Lubrificação",
    "nivel3": "Pino Graxeiro"
  },
  {
    "id": "lvl-59",
    "nivel1": "Lubrificação",
    "nivel2": "Graxas Industriais",
    "nivel3": "Graxa líquida / pasta"
  },
  {
    "id": "lvl-60",
    "nivel1": "Lubrificação",
    "nivel2": "Graxas Industriais",
    "nivel3": "Graxa seca"
  },
  {
    "id": "lvl-61",
    "nivel1": "Lubrificação",
    "nivel2": "Óleos industriais",
    "nivel3": "Óleo indutrial"
  },
  {
    "id": "lvl-62",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Acoplamentos",
    "nivel3": "Acoplamento Diversos"
  },
  {
    "id": "lvl-63",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Acoplamentos",
    "nivel3": "Acoplamento Elástico"
  },
  {
    "id": "lvl-64",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Eixos",
    "nivel3": "Eixo de Transmissão"
  },
  {
    "id": "lvl-65",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento Diversos"
  },
  {
    "id": "lvl-66",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Esteiras Transportadoras",
    "nivel3": "Esteira Modular"
  },
  {
    "id": "lvl-67",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Engrenagens",
    "nivel3": "Engrenagem Industrial"
  },
  {
    "id": "lvl-68",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Redutores",
    "nivel3": "Redutor de Velocidade"
  },
  {
    "id": "lvl-69",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Buchas",
    "nivel3": "Bucha Diversas"
  },
  {
    "id": "lvl-70",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Buchas",
    "nivel3": "Bucha de Fixação"
  },
  {
    "id": "lvl-71",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Mancais",
    "nivel3": "Mancal Diversos"
  },
  {
    "id": "lvl-72",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correntes",
    "nivel3": "Corrente Diversas"
  },
  {
    "id": "lvl-73",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correias",
    "nivel3": "Correia Diversas"
  },
  {
    "id": "lvl-74",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correias",
    "nivel3": "Correia em V"
  },
  {
    "id": "lvl-75",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correias",
    "nivel3": "Correia Sincronizadora"
  },
  {
    "id": "lvl-76",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correias",
    "nivel3": "Correia Transportadora"
  },
  {
    "id": "lvl-77",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correntes",
    "nivel3": "Corrente de Transmissão"
  },
  {
    "id": "lvl-78",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Correntes",
    "nivel3": "Corrente de Carga"
  },
  {
    "id": "lvl-79",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Polias",
    "nivel3": "Polia Industrial"
  },
  {
    "id": "lvl-80",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento Autoalinhante"
  },
  {
    "id": "lvl-81",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento Cônico"
  },
  {
    "id": "lvl-82",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento Radial de Esferas"
  },
  {
    "id": "lvl-83",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Buchas",
    "nivel3": "Bucha de Bronze"
  },
  {
    "id": "lvl-84",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Mecânica Diversos",
    "nivel3": "Componente Mecânico Genérico"
  },
  {
    "id": "lvl-85",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento de Agulhas"
  },
  {
    "id": "lvl-86",
    "nivel1": "Mecânica e Transmissão",
    "nivel2": "Rolamentos",
    "nivel3": "Rolamento Axial"
  },
  {
    "id": "lvl-87",
    "nivel1": "Motores e Acionamentos",
    "nivel2": "Motores Elétricos",
    "nivel3": "Motor Elétrico Diversos"
  },
  {
    "id": "lvl-88",
    "nivel1": "Motores e Acionamentos",
    "nivel2": "Motores Elétricos",
    "nivel3": "Motor Elétrico AC"
  },
  {
    "id": "lvl-89",
    "nivel1": "Motores e Acionamentos",
    "nivel2": "Motores Elétricos",
    "nivel3": "Motor Elétrico DC"
  },
  {
    "id": "lvl-90",
    "nivel1": "Motores e Acionamentos",
    "nivel2": "Servomotores elétricos",
    "nivel3": "Servomotores"
  },
  {
    "id": "lvl-91",
    "nivel1": "Pneumática",
    "nivel2": "Pneumática Diversos",
    "nivel3": "Componente Pneumático Genérico"
  },
  {
    "id": "lvl-92",
    "nivel1": "Pneumática",
    "nivel2": "Cilindros Pneumáticos",
    "nivel3": "Cilindro Pneumático ISO"
  },
  {
    "id": "lvl-93",
    "nivel1": "Pneumática",
    "nivel2": "Conexões Pneumáticas",
    "nivel3": "Conexão Instantânea Pneumática"
  },
  {
    "id": "lvl-94",
    "nivel1": "Pneumática",
    "nivel2": "Válvulas Pneumáticas",
    "nivel3": "Válvula Solenóide Pneumática"
  },
  {
    "id": "lvl-95",
    "nivel1": "Químicos Industriais",
    "nivel2": "Produtos Químicos",
    "nivel3": "Químico Industrial"
  },
  {
    "id": "lvl-96",
    "nivel1": "Segurança",
    "nivel2": "Equipamentos de Proteção",
    "nivel3": "EPI Industrial Padronizado"
  },
  {
    "id": "lvl-97",
    "nivel1": "Soldagem",
    "nivel2": "Consumíveis de Solda",
    "nivel3": "Eletrodo / Arame de Solda"
  },
  {
    "id": "lvl-98",
    "nivel1": "Utilidades",
    "nivel2": "Tubos e Dutos",
    "nivel3": "Tê Tubular"
  },
  {
    "id": "lvl-99",
    "nivel1": "Utilidades",
    "nivel2": "Conexões e Flanges",
    "nivel3": "Conexão Tubular Diversas"
  },
  {
    "id": "lvl-100",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula Industrial Diversas"
  },
  {
    "id": "lvl-101",
    "nivel1": "Utilidades",
    "nivel2": "Tubos e Dutos",
    "nivel3": "Item de Tubulação / Utilidades"
  },
  {
    "id": "lvl-102",
    "nivel1": "Utilidades",
    "nivel2": "Utilidades Diversas",
    "nivel3": "Cotovelo / Joelho"
  },
  {
    "id": "lvl-103",
    "nivel1": "Utilidades",
    "nivel2": "Conexões e Flanges",
    "nivel3": "Flange Industrial"
  },
  {
    "id": "lvl-104",
    "nivel1": "Utilidades",
    "nivel2": "Tubos e Dutos",
    "nivel3": "Tubo Industrial Diversos"
  },
  {
    "id": "lvl-105",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula Globo"
  },
  {
    "id": "lvl-106",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula Esfera"
  },
  {
    "id": "lvl-107",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula de Retenção"
  },
  {
    "id": "lvl-108",
    "nivel1": "Utilidades",
    "nivel2": "Tubos e Dutos",
    "nivel3": "Tubo Aço Inox"
  },
  {
    "id": "lvl-109",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula Borboleta"
  },
  {
    "id": "lvl-110",
    "nivel1": "Utilidades",
    "nivel2": "Válvulas Industriais",
    "nivel3": "Válvula Gaveta"
  },
  {
    "id": "lvl-111",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Retentores",
    "nivel3": "Retentor Radial"
  },
  {
    "id": "lvl-112",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Anéis O-Ring",
    "nivel3": "Anel O-Ring Viton"
  },
  {
    "id": "lvl-113",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Gaxetas",
    "nivel3": "Anel O-Ring Padronizado"
  },
  {
    "id": "lvl-114",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Anéis O-Ring",
    "nivel3": "Anel O-Ring Nitrílica"
  },
  {
    "id": "lvl-115",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Gaxetas",
    "nivel3": "Gaxeta Industrial"
  },
  {
    "id": "lvl-116",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Juntas",
    "nivel3": "Junta Diversas"
  },
  {
    "id": "lvl-117",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Juntas",
    "nivel3": "Junta de Expansão"
  },
  {
    "id": "lvl-118",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Juntas",
    "nivel3": "Junta de Vedação"
  },
  {
    "id": "lvl-119",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Selos Mecânicos",
    "nivel3": "Selo Mecânico"
  },
  {
    "id": "lvl-120",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Vedações Diversas",
    "nivel3": "Elemento de Vedação Genérico"
  },
  {
    "id": "lvl-121",
    "nivel1": "Vedação e Isolamento",
    "nivel2": "Anéis O-Ring",
    "nivel3": "Anel O-Ring Silicone"
  }
];

export function getNiveis1List(niveis: PdmNivelItem[]): string[] {
  const set = new Set<string>();
  niveis.forEach(n => {
    if (n.nivel1) set.add(n.nivel1);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getNiveis2List(niveis: PdmNivelItem[], nivel1: string): string[] {
  const set = new Set<string>();
  niveis
    .filter(n => n.nivel1 === nivel1)
    .forEach(n => {
      if (n.nivel2) set.add(n.nivel2);
    });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getNiveis3List(niveis: PdmNivelItem[], nivel1: string, nivel2: string): string[] {
  const set = new Set<string>();
  niveis
    .filter(n => n.nivel1 === nivel1 && n.nivel2 === nivel2)
    .forEach(n => {
      if (n.nivel3) set.add(n.nivel3);
    });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

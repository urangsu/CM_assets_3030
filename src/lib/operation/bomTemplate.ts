import { BomMatrixRow } from './bomMatrixParser';

export const BOM_TEMPLATE_V1: BomMatrixRow[] = [
  {
    id: 'tmpl_1',
    category: '원재료',
    itemName: '망간분말',
    unit: 'kg',
    coefficients: { MN: 0.0387 },
    unitPrice: 2300
  },
  {
    id: 'tmpl_2',
    category: '부재료',
    itemName: '황산',
    unit: 'kg',
    coefficients: { NI: 2.33, CO: 2.33, LC: 1.56 },
    unitPrice: 180
  },
  {
    id: 'tmpl_3',
    category: '부재료',
    itemName: '희황산',
    unit: 'kg',
    coefficients: { NI: 5.13, CO: 5.20, LC: 2.74, MN: 1.6662, CU: 1.08 },
    unitPrice: 120
  },
  {
    id: 'tmpl_4',
    category: '부재료',
    itemName: '액화CO2',
    unit: 'kg',
    coefficients: { LC: 1.32 },
    unitPrice: 250
  },
  {
    id: 'tmpl_5',
    category: '조업재료',
    itemName: '티오황산나트륨',
    unit: 'kg',
    coefficients: { CO: 0.38 },
    unitPrice: 880
  },
  {
    id: 'tmpl_6',
    category: '부재료',
    itemName: '가성소다(20%)',
    unit: 'kg',
    coefficients: {},
    unitPrice: 210
  },
  {
    id: 'tmpl_7',
    category: '부재료',
    itemName: '가성소다(25%)',
    unit: 'kg',
    coefficients: { NI: 12.15, CO: 13.50, LC: 1.06, MN: 7.11 },
    unitPrice: 260
  },
  {
    id: 'tmpl_8',
    category: '부재료',
    itemName: '염산(35%)',
    unit: 'kg',
    coefficients: { NI: 0.34, CO: 0.33, LC: 0.02, MN: 0.00, CU: 0.00 },
    unitPrice: 190
  },
  {
    id: 'tmpl_9',
    category: '부재료',
    itemName: '탄산나트륨(95%)',
    unit: 'kg',
    coefficients: { NI: 0.77, CO: 0.77, LC: 3.19 },
    unitPrice: 420
  },
  {
    id: 'tmpl_10',
    category: '부재료',
    itemName: 'P507',
    unit: 'L',
    coefficients: { NI: 0.00, CO: 0.01 },
    unitPrice: 12500
  },
  {
    id: 'tmpl_11',
    category: '부재료',
    itemName: 'P204',
    unit: 'L',
    coefficients: {},
    unitPrice: 11000
  },
  {
    id: 'tmpl_12',
    category: '부재료',
    itemName: 'C272',
    unit: 'L',
    coefficients: {},
    unitPrice: 14500
  },
  {
    id: 'tmpl_13',
    category: '부재료',
    itemName: 'LIX973',
    unit: 'L',
    coefficients: {},
    unitPrice: 22000
  },
  {
    id: 'tmpl_14',
    category: '부재료',
    itemName: '희석제(D80)',
    unit: 'L',
    coefficients: { NI: 0.06, CO: 0.07, MN: 0.10, CU: 0.03 },
    unitPrice: 2100
  },
  {
    id: 'tmpl_15',
    category: '부재료',
    itemName: '인제거제',
    unit: 'kg',
    coefficients: { LC: 0.02 },
    unitPrice: 3800
  },
  {
    id: 'tmpl_16',
    category: '부재료',
    itemName: '불소제거제',
    unit: 'kg',
    coefficients: { LC: 0.01 },
    unitPrice: 4200
  },
  {
    id: 'tmpl_17',
    category: '부재료',
    itemName: '활성탄',
    unit: 'kg',
    coefficients: { NI: 0.02, CO: 0.02, LC: 0.02, MN: 0.0258 },
    unitPrice: 3100
  },
  {
    id: 'tmpl_18',
    category: '부재료',
    itemName: '액화산소',
    unit: 'kg',
    coefficients: { NI: 0.05, CO: 0.05 },
    unitPrice: 150
  },
  {
    id: 'tmpl_19',
    category: '부재료',
    itemName: '아교',
    unit: 'kg',
    coefficients: { CU: 0.0003 },
    unitPrice: 8500
  },
  {
    id: 'tmpl_20',
    category: '유틸리티',
    itemName: 'LNG',
    unit: 'Nm3',
    coefficients: {},
    unitPrice: 1100
  },
  {
    id: 'tmpl_21',
    category: '유틸리티',
    itemName: '전기',
    unit: 'kWh',
    coefficients: {},
    unitPrice: 140
  },
  {
    id: 'tmpl_22',
    category: '유틸리티',
    itemName: '용수',
    unit: 't',
    coefficients: {},
    unitPrice: 950
  }
];

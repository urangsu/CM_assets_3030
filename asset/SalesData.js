/* HYCM Sales & Purchase Data Layer — SAMPLE DATA
   localStorage keys:
     hycm_sales_records      (실제 업로드 데이터)
     hycm_purchase_records   (실제 업로드 데이터)
   Sample flag:
     hycm_ops_sample_enabled
*/
window.HYCMSalesData = (() => {

  /* ── Country Master ── */
  const COUNTRY_MASTER = [
    { code:'KR', nameKo:'대한민국',   nameEn:'South Korea',    region:'아시아',    lon:127.5, lat:36.5 },
    { code:'JP', nameKo:'일본',       nameEn:'Japan',           region:'아시아',    lon:139.5, lat:36.0 },
    { code:'CN', nameKo:'중국',       nameEn:'China',           region:'아시아',    lon:104.0, lat:35.9 },
    { code:'US', nameKo:'미국',       nameEn:'United States',   region:'아메리카',  lon:-98.0, lat:38.0 },
    { code:'DE', nameKo:'독일',       nameEn:'Germany',         region:'유럽',      lon:10.5,  lat:51.2 },
    { code:'HU', nameKo:'헝가리',     nameEn:'Hungary',         region:'유럽',      lon:19.5,  lat:47.2 },
    { code:'PL', nameKo:'폴란드',     nameEn:'Poland',          region:'유럽',      lon:20.0,  lat:52.0 },
    { code:'FI', nameKo:'핀란드',     nameEn:'Finland',         region:'유럽',      lon:25.7,  lat:61.9 },
    { code:'FR', nameKo:'프랑스',     nameEn:'France',          region:'유럽',      lon:2.2,   lat:46.2 },
    { code:'GB', nameKo:'영국',       nameEn:'United Kingdom',  region:'유럽',      lon:-3.4,  lat:55.4 },
    { code:'IN', nameKo:'인도',       nameEn:'India',           region:'아시아',    lon:79.0,  lat:20.6 },
    { code:'AU', nameKo:'호주',       nameEn:'Australia',       region:'오세아니아',lon:133.8, lat:-25.3},
    { code:'CL', nameKo:'칠레',       nameEn:'Chile',           region:'아메리카',  lon:-71.5, lat:-35.7},
    { code:'AR', nameKo:'아르헨티나', nameEn:'Argentina',       region:'아메리카',  lon:-63.6, lat:-38.4},
    { code:'PH', nameKo:'필리핀',     nameEn:'Philippines',     region:'아시아',    lon:121.8, lat:12.9 },
    { code:'ID', nameKo:'인도네시아', nameEn:'Indonesia',       region:'아시아',    lon:113.9, lat:-0.8 },
    { code:'CD', nameKo:'콩고(DRC)', nameEn:'Congo DRC',        region:'아프리카',  lon:23.7,  lat:-4.0 },
    { code:'ZA', nameKo:'남아공',     nameEn:'South Africa',    region:'아프리카',  lon:25.1,  lat:-29.0},
    { code:'CA', nameKo:'캐나다',     nameEn:'Canada',          region:'아메리카',  lon:-96.0, lat:56.1 },
  ];

  /* ── Item Master ── */
  const ITEM_MASTER = [
    { code:'NS-001', name:'황산니켈(NiSO4)',    type:'product',  material:'Ni',    unit:'MT' },
    { code:'CS-001', name:'황산코발트(CoSO4)',  type:'product',  material:'Co',    unit:'MT' },
    { code:'LH-001', name:'수산화리튬(LiOH)',   type:'product',  material:'Li',    unit:'MT' },
    { code:'MH-001', name:'MHP(판매)',          type:'product',  material:'Ni/Co', unit:'MT' },
    { code:'NH-001', name:'수산화니켈(NiOH)',   type:'material', material:'Ni',    unit:'MT' },
    { code:'CH-001', name:'수산화코발트(CoOH)', type:'material', material:'Co',    unit:'MT' },
    { code:'MH-002', name:'MHP(구매)',          type:'material', material:'Ni/Co', unit:'MT' },
    { code:'BP-001', name:'블랙파우더(BP)',     type:'material', material:'Ni/Co/Li',unit:'MT'},
    { code:'LO-001', name:'LCO',              type:'material', material:'Co/Li', unit:'MT' },
  ];

  /* ── Partner Master ── */
  const PARTNER_MASTER = [
    { code:'C-001', name:'삼성SDI',                type:'customer', country:'KR' },
    { code:'C-002', name:'LG에너지솔루션',          type:'customer', country:'KR' },
    { code:'C-003', name:'SK온',                    type:'customer', country:'KR' },
    { code:'C-004', name:'포스코퓨처엠',            type:'customer', country:'KR' },
    { code:'C-005', name:'Panasonic Energy',        type:'customer', country:'JP' },
    { code:'C-006', name:'Toyota Battery',          type:'customer', country:'JP' },
    { code:'C-007', name:'Sumitomo Metal Mining',   type:'customer', country:'JP' },
    { code:'C-008', name:'CATL',                    type:'customer', country:'CN' },
    { code:'C-009', name:'BYD',                     type:'customer', country:'CN' },
    { code:'C-010', name:'Tesla',                   type:'customer', country:'US' },
    { code:'C-011', name:'BASF',                    type:'customer', country:'DE' },
    { code:'C-012', name:'Umicore',                 type:'customer', country:'DE' },
    { code:'C-013', name:'Samsung SDI Hungary',     type:'customer', country:'HU' },
    { code:'C-014', name:'LG Energy Solution PL',   type:'customer', country:'PL' },
    { code:'C-015', name:'Terrafame',               type:'customer', country:'FI' },
    { code:'C-016', name:'Johnson Matthey',         type:'customer', country:'GB' },
    { code:'C-017', name:'TATA Chemicals',          type:'customer', country:'IN' },
    { code:'S-001', name:'BHP',                     type:'supplier', country:'AU' },
    { code:'S-002', name:'Wyloo Metals',            type:'supplier', country:'AU' },
    { code:'S-003', name:'Nickel Asia Corp.',       type:'supplier', country:'PH' },
    { code:'S-004', name:'TPI Polene',              type:'supplier', country:'PH' },
    { code:'S-005', name:'PT Vale Indonesia',       type:'supplier', country:'ID' },
    { code:'S-006', name:'PT Antam',                type:'supplier', country:'ID' },
    { code:'S-007', name:'Harita Nickel',           type:'supplier', country:'ID' },
    { code:'S-008', name:'Glencore',                type:'supplier', country:'CD' },
    { code:'S-009', name:'Impala Platinum',         type:'supplier', country:'ZA' },
    { code:'S-010', name:'Anglo American',          type:'supplier', country:'ZA' },
    { code:'S-011', name:'SQM',                    type:'supplier', country:'CL' },
    { code:'S-012', name:'Livent',                 type:'supplier', country:'AR' },
    { code:'S-013', name:'Lithea',                 type:'supplier', country:'AR' },
    { code:'S-014', name:'Vale Canada',            type:'supplier', country:'CA' },
    { code:'S-015', name:'Terrafame (Supply)',      type:'supplier', country:'FI' },
  ];

  /* ── Sales Sample Records (SAMPLE DATA) ── */
  const DEMO_SALES = [
    { id:'SR-001', year:'2026', month:'2026-01', countryCode:'KR', countryName:'대한민국', productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-001', customerName:'삼성SDI',              quantity:500, unit:'MT', unitPrice:4800, revenue:2400000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-002', year:'2026', month:'2026-01', countryCode:'KR', countryName:'대한민국', productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-002', customerName:'LG에너지솔루션',       quantity:120, unit:'MT', unitPrice:7200, revenue: 864000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-003', year:'2026', month:'2026-02', countryCode:'KR', countryName:'대한민국', productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-003', customerName:'SK온',                 quantity:460, unit:'MT', unitPrice:4850, revenue:2231000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-004', year:'2026', month:'2026-03', countryCode:'KR', countryName:'대한민국', productCode:'LH-001', productName:'수산화리튬(LiOH)',  customerCode:'C-003', customerName:'SK온',                 quantity:180, unit:'MT', unitPrice:12600,revenue:2268000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-005', year:'2026', month:'2026-04', countryCode:'KR', countryName:'대한민국', productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-004', customerName:'포스코퓨처엠',          quantity:450, unit:'MT', unitPrice:4800, revenue:2160000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-006', year:'2026', month:'2026-05', countryCode:'KR', countryName:'대한민국', productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-001', customerName:'삼성SDI',              quantity:520, unit:'MT', unitPrice:4750, revenue:2470000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-007', year:'2026', month:'2026-01', countryCode:'JP', countryName:'일본',     productCode:'LH-001', productName:'수산화리튬(LiOH)',  customerCode:'C-005', customerName:'Panasonic Energy',     quantity:200, unit:'MT', unitPrice:12500,revenue:2500000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-008', year:'2026', month:'2026-02', countryCode:'JP', countryName:'일본',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-006', customerName:'Toyota Battery',        quantity:350, unit:'MT', unitPrice:4800, revenue:1680000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-009', year:'2026', month:'2026-03', countryCode:'JP', countryName:'일본',     productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-007', customerName:'Sumitomo Metal Mining', quantity:150, unit:'MT', unitPrice:7200, revenue:1080000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-010', year:'2026', month:'2026-04', countryCode:'JP', countryName:'일본',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-005', customerName:'Panasonic Energy',     quantity:380, unit:'MT', unitPrice:4780, revenue:1816400, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-011', year:'2026', month:'2026-02', countryCode:'CN', countryName:'중국',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-008', customerName:'CATL',                 quantity:800, unit:'MT', unitPrice:4700, revenue:3760000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-012', year:'2026', month:'2026-03', countryCode:'CN', countryName:'중국',     productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-008', customerName:'CATL',                 quantity:200, unit:'MT', unitPrice:7100, revenue:1420000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-013', year:'2026', month:'2026-04', countryCode:'CN', countryName:'중국',     productCode:'LH-001', productName:'수산화리튬(LiOH)',  customerCode:'C-009', customerName:'BYD',                  quantity:300, unit:'MT', unitPrice:12400,revenue:3720000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-014', year:'2026', month:'2026-05', countryCode:'CN', countryName:'중국',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-009', customerName:'BYD',                  quantity:600, unit:'MT', unitPrice:4680, revenue:2808000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-015', year:'2026', month:'2026-01', countryCode:'US', countryName:'미국',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-010', customerName:'Tesla',                 quantity:400, unit:'MT', unitPrice:5100, revenue:2040000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-016', year:'2026', month:'2026-03', countryCode:'US', countryName:'미국',     productCode:'LH-001', productName:'수산화리튬(LiOH)',  customerCode:'C-010', customerName:'Tesla',                 quantity:150, unit:'MT', unitPrice:12800,revenue:1920000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-017', year:'2026', month:'2026-05', countryCode:'US', countryName:'미국',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-010', customerName:'Tesla',                 quantity:420, unit:'MT', unitPrice:5050, revenue:2121000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-018', year:'2026', month:'2026-02', countryCode:'DE', countryName:'독일',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-011', customerName:'BASF',                  quantity:300, unit:'MT', unitPrice:4900, revenue:1470000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-019', year:'2026', month:'2026-03', countryCode:'DE', countryName:'독일',     productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-012', customerName:'Umicore',               quantity:100, unit:'MT', unitPrice:7300, revenue: 730000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-020', year:'2026', month:'2026-04', countryCode:'HU', countryName:'헝가리',   productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-013', customerName:'Samsung SDI Hungary',   quantity:250, unit:'MT', unitPrice:4850, revenue:1212500, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-021', year:'2026', month:'2026-05', countryCode:'PL', countryName:'폴란드',   productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-014', customerName:'LG Energy Solution PL', quantity:200, unit:'MT', unitPrice:4850, revenue: 970000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-022', year:'2026', month:'2026-01', countryCode:'FI', countryName:'핀란드',   productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-015', customerName:'Terrafame',             quantity: 80, unit:'MT', unitPrice:7250, revenue: 580000, currency:'USD', sourceType:'sample', status:'normal' },
    { id:'SR-023', year:'2026', month:'2026-05', countryCode:'GB', countryName:'영국',     productCode:'CS-001', productName:'황산코발트(CoSO4)', customerCode:'C-016', customerName:'Johnson Matthey',        quantity: 60, unit:'MT', unitPrice:7300, revenue: 438000, currency:'USD', sourceType:'sample', status:'warning'},
    { id:'SR-024', year:'2026', month:'2026-05', countryCode:'IN', countryName:'인도',     productCode:'NS-001', productName:'황산니켈(NiSO4)',   customerCode:'C-017', customerName:'TATA Chemicals',         quantity:200, unit:'MT', unitPrice:4750, revenue: 950000, currency:'USD', sourceType:'sample', status:'normal' },
  ];

  /* ── Purchase Sample Records (SAMPLE DATA) ── */
  const DEMO_PURCHASES = [
    { id:'PR-001', year:'2026', month:'2026-01', countryCode:'AU', countryName:'호주',       supplierCode:'S-001', supplierName:'BHP',               materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity:1200, unit:'MT', unitPrice:3200, amount:3840000, currency:'USD', niGrade:38.5, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-002', year:'2026', month:'2026-02', countryCode:'AU', countryName:'호주',       supplierCode:'S-002', supplierName:'Wyloo Metals',      materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity:1000, unit:'MT', unitPrice:3400, amount:3400000, currency:'USD', niGrade:34.2, coGrade:2.8,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-003', year:'2026', month:'2026-03', countryCode:'AU', countryName:'호주',       supplierCode:'S-001', supplierName:'BHP',               materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity:1100, unit:'MT', unitPrice:3180, amount:3498000, currency:'USD', niGrade:38.2, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-004', year:'2026', month:'2026-04', countryCode:'AU', countryName:'호주',       supplierCode:'S-002', supplierName:'Wyloo Metals',      materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 900, unit:'MT', unitPrice:3350, amount:3015000, currency:'USD', niGrade:33.8, coGrade:2.9,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-005', year:'2026', month:'2026-05', countryCode:'AU', countryName:'호주',       supplierCode:'S-001', supplierName:'BHP',               materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity:1050, unit:'MT', unitPrice:3220, amount:3381000, currency:'USD', niGrade:38.0, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-006', year:'2026', month:'2026-01', countryCode:'PH', countryName:'필리핀',     supplierCode:'S-003', supplierName:'Nickel Asia Corp.', materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity: 800, unit:'MT', unitPrice:3100, amount:2480000, currency:'USD', niGrade:36.5, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-007', year:'2026', month:'2026-03', countryCode:'PH', countryName:'필리핀',     supplierCode:'S-004', supplierName:'TPI Polene',        materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity: 750, unit:'MT', unitPrice:3080, amount:2310000, currency:'USD', niGrade:36.8, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-008', year:'2026', month:'2026-05', countryCode:'PH', countryName:'필리핀',     supplierCode:'S-004', supplierName:'TPI Polene',        materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity: 700, unit:'MT', unitPrice:3050, amount:2135000, currency:'USD', niGrade:36.0, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-009', year:'2026', month:'2026-02', countryCode:'ID', countryName:'인도네시아', supplierCode:'S-005', supplierName:'PT Vale Indonesia', materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 600, unit:'MT', unitPrice:3500, amount:2100000, currency:'USD', niGrade:33.5, coGrade:3.1,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-010', year:'2026', month:'2026-03', countryCode:'ID', countryName:'인도네시아', supplierCode:'S-006', supplierName:'PT Antam',          materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 550, unit:'MT', unitPrice:3450, amount:1897500, currency:'USD', niGrade:33.2, coGrade:3.0,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-011', year:'2026', month:'2026-04', countryCode:'ID', countryName:'인도네시아', supplierCode:'S-007', supplierName:'Harita Nickel',     materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 600, unit:'MT', unitPrice:3380, amount:2028000, currency:'USD', niGrade:33.0, coGrade:2.9,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-012', year:'2026', month:'2026-05', countryCode:'ID', countryName:'인도네시아', supplierCode:'S-007', supplierName:'Harita Nickel',     materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 600, unit:'MT', unitPrice:3380, amount:2028000, currency:'USD', niGrade:32.8, coGrade:2.8,  liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-013', year:'2026', month:'2026-02', countryCode:'CD', countryName:'콩고(DRC)', supplierCode:'S-008', supplierName:'Glencore',           materialCode:'CH-001', materialName:'수산화코발트(CoOH)',materialType:'Co',quantity: 200, unit:'MT', unitPrice:6800, amount:1360000, currency:'USD', niGrade:null, coGrade:58.2, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-014', year:'2026', month:'2026-04', countryCode:'CD', countryName:'콩고(DRC)', supplierCode:'S-008', supplierName:'Glencore',           materialCode:'CH-001', materialName:'수산화코발트(CoOH)',materialType:'Co',quantity: 180, unit:'MT', unitPrice:6900, amount:1242000, currency:'USD', niGrade:null, coGrade:58.5, liGrade:null, sourceType:'sample', status:'warning'},
    { id:'PR-015', year:'2026', month:'2026-03', countryCode:'ZA', countryName:'남아공',     supplierCode:'S-009', supplierName:'Impala Platinum',   materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity: 500, unit:'MT', unitPrice:3150, amount:1575000, currency:'USD', niGrade:37.0, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-016', year:'2026', month:'2026-05', countryCode:'ZA', countryName:'남아공',     supplierCode:'S-010', supplierName:'Anglo American',    materialCode:'NH-001', materialName:'수산화니켈(NiOH)', materialType:'Ni', quantity: 450, unit:'MT', unitPrice:3200, amount:1440000, currency:'USD', niGrade:37.2, coGrade:null, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-017', year:'2026', month:'2026-01', countryCode:'CL', countryName:'칠레',       supplierCode:'S-011', supplierName:'SQM',               materialCode:'LH-001', materialName:'수산화리튬(LiOH)', materialType:'Li', quantity: 300, unit:'MT', unitPrice:11000,amount:3300000, currency:'USD', niGrade:null, coGrade:null, liGrade:56.5, sourceType:'sample', status:'normal' },
    { id:'PR-018', year:'2026', month:'2026-04', countryCode:'CL', countryName:'칠레',       supplierCode:'S-011', supplierName:'SQM',               materialCode:'LH-001', materialName:'수산화리튬(LiOH)', materialType:'Li', quantity: 280, unit:'MT', unitPrice:10900,amount:3052000, currency:'USD', niGrade:null, coGrade:null, liGrade:56.3, sourceType:'sample', status:'normal' },
    { id:'PR-019', year:'2026', month:'2026-02', countryCode:'AR', countryName:'아르헨티나', supplierCode:'S-012', supplierName:'Livent',            materialCode:'LH-001', materialName:'수산화리튬(LiOH)', materialType:'Li', quantity: 250, unit:'MT', unitPrice:10800,amount:2700000, currency:'USD', niGrade:null, coGrade:null, liGrade:56.0, sourceType:'sample', status:'normal' },
    { id:'PR-020', year:'2026', month:'2026-05', countryCode:'AR', countryName:'아르헨티나', supplierCode:'S-013', supplierName:'Lithea',            materialCode:'LH-001', materialName:'수산화리튬(LiOH)', materialType:'Li', quantity: 200, unit:'MT', unitPrice:10700,amount:2140000, currency:'USD', niGrade:null, coGrade:null, liGrade:55.8, sourceType:'sample', status:'normal' },
    { id:'PR-021', year:'2026', month:'2026-04', countryCode:'CA', countryName:'캐나다',     supplierCode:'S-014', supplierName:'Vale Canada',       materialCode:'CH-001', materialName:'수산화코발트(CoOH)',materialType:'Co',quantity: 150, unit:'MT', unitPrice:6750, amount:1012500, currency:'USD', niGrade:null, coGrade:57.8, liGrade:null, sourceType:'sample', status:'normal' },
    { id:'PR-022', year:'2026', month:'2026-03', countryCode:'FI', countryName:'핀란드',     supplierCode:'S-015', supplierName:'Terrafame (Supply)',materialCode:'MH-002', materialName:'MHP',            materialType:'Ni', quantity: 100, unit:'MT', unitPrice:7000, amount: 700000, currency:'USD', niGrade:32.5, coGrade:3.2,  liGrade:null, sourceType:'sample', status:'normal' },
  ];

  /* ── localStorage I/O ── */
  function getSalesRecords()    { try { const r=localStorage.getItem('hycm_sales_records');    return r?JSON.parse(r):[]; } catch(e){return [];} }
  function getPurchaseRecords() { try { const r=localStorage.getItem('hycm_purchase_records'); return r?JSON.parse(r):[]; } catch(e){return [];} }
  function hasRealSalesData()    { return getSalesRecords().length > 0; }
  function hasRealPurchaseData() { return getPurchaseRecords().length > 0; }

  /* ── Aggregation helpers ── */
  function getSalesByCountry(records) {
    const map = {};
    records.forEach(r => {
      if (!map[r.countryCode]) map[r.countryCode] = { countryCode:r.countryCode, countryName:r.countryName, revenue:0, quantity:0, products:{}, customers:{} };
      const c = map[r.countryCode];
      c.revenue   += r.revenue  || 0;
      c.quantity  += r.quantity || 0;
      c.products[r.productName] = (c.products[r.productName]||0) + r.revenue;
      if (r.customerName) c.customers[r.customerName] = true;
    });
    return Object.values(map).map(c => {
      const topProd = Object.entries(c.products).sort((a,b)=>b[1]-a[1])[0];
      return { countryCode:c.countryCode, countryName:c.countryName, revenue:c.revenue, quantity:c.quantity,
        productCount:Object.keys(c.products).length, customerCount:Object.keys(c.customers).length,
        topProductName:topProd?.[0]||'', products:c.products, customers:Object.keys(c.customers) };
    }).sort((a,b)=>b.revenue-a.revenue);
  }

  function getPurchaseByCountry(records) {
    const map = {};
    records.forEach(r => {
      if (!map[r.countryCode]) map[r.countryCode] = { countryCode:r.countryCode, countryName:r.countryName, amount:0, quantity:0, materials:{}, suppliers:{} };
      const c = map[r.countryCode];
      c.amount    += r.amount   || 0;
      c.quantity  += r.quantity || 0;
      c.materials[r.materialName] = (c.materials[r.materialName]||0) + r.amount;
      if (r.supplierName) c.suppliers[r.supplierName] = true;
    });
    return Object.values(map).map(c => {
      const topMat = Object.entries(c.materials).sort((a,b)=>b[1]-a[1])[0];
      const avgP   = c.quantity > 0 ? c.amount/c.quantity : 0;
      return { countryCode:c.countryCode, countryName:c.countryName, amount:c.amount, quantity:c.quantity,
        materialCount:Object.keys(c.materials).length, supplierCount:Object.keys(c.suppliers).length,
        topMaterialName:topMat?.[0]||'', averageUnitPrice:avgP, materials:c.materials, suppliers:Object.keys(c.suppliers) };
    }).sort((a,b)=>b.amount-a.amount);
  }

  function getSalesByProduct(records) {
    const map = {};
    records.forEach(r => { if(!map[r.productCode]) map[r.productCode]={productCode:r.productCode,productName:r.productName,revenue:0,quantity:0}; map[r.productCode].revenue+=r.revenue; map[r.productCode].quantity+=r.quantity; });
    return Object.values(map).sort((a,b)=>b.revenue-a.revenue);
  }

  function getPurchaseByMaterial(records) {
    const map = {};
    records.forEach(r => { if(!map[r.materialCode]) map[r.materialCode]={materialCode:r.materialCode,materialName:r.materialName,materialType:r.materialType,amount:0,quantity:0}; map[r.materialCode].amount+=r.amount; map[r.materialCode].quantity+=r.quantity; });
    return Object.values(map).sort((a,b)=>b.amount-a.amount);
  }

  function getMonthlyTrend(records, valueKey) {
    const map = {};
    records.forEach(r => { const m=r.month||''; if(!map[m]) map[m]=0; map[m]+=(r[valueKey]||0); });
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,value])=>({month,value}));
  }

  return {
    COUNTRY_MASTER, ITEM_MASTER, PARTNER_MASTER,
    DEMO_SALES, DEMO_PURCHASES,
    getSalesRecords, getPurchaseRecords,
    hasRealSalesData, hasRealPurchaseData,
    getSalesByCountry, getPurchaseByCountry,
    getSalesByProduct, getPurchaseByMaterial,
    getMonthlyTrend,
  };
})();

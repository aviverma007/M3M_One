// Key Ratio calculation engine shared by the server (module scores) and the client (live cards).
// Ported from the original application. Behaviours the original got wrong are fixed here and
// called out with "FIX:" so they are easy to find; results for in-range values are unchanged.

export const SQM_TO_SQFT = 10.764;
export const CRORE = 1e7;

export const round = (x, d = 2) => (x === null || x === undefined || Number.isNaN(Number(x)) ? null : Math.round(Number(x) * 10 ** d) / 10 ** d);
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

// category as stored on a project → key used on benchmark rows
export const categoryKey = (category) => String(category || '').replace('-', '_').replace('hi_street', 'hi_street');
const RANGE_KEYS = { mid_end: 'mid_end', premium: 'premium', affluent: 'affluent', hi_street: 'high_street', high_street: 'high_street', enclosed_mall: 'enclosed_mall' };

// --------------------------------------------------------------------------------------------
// Residential inputs (left panel) — order and units as in the original
export const RESIDENTIAL_INPUT_GROUPS = [
  { name: 'Efficiency', fields: [['building_height', 'm'], ['carpet_area', 'sq m'], ['saleable_area', 'sq m'], ['balcony_area', 'sq m'], ['built_up_area', 'sq m'], ['far', ''], ['total_external_wall_area', 'sq m'], ['window_to_area_ratio', ''], ['service_shaft_area', 'sq m'], ['sales_price', ''], ['construction_cost_on_bua', ''], ['permissible_far', '']] },
  { name: 'Apt Configuration/ Dimensions', fields: [['floor_to_floor_height_apt', 'm'], ['no_of_units', ''], ['average_wall_area_interior_exterior_per_unit', 'sq m']] },
  { name: 'Non-Apt Configuration', fields: [['lobby_corridor_width', 'm'], ['driveway_width_basement', 'm'], ['floor_to_floor_height_ground_lobby', 'm'], ['floor_to_floor_height_basement_b1_b2', 'm'], ['clear_height', 'm'], ['average_wall_area_interior_exterior_per_basement', 'sq m'], ['no_of_basements', ''], ['car_length', 'm'], ['car_width', 'm']] },
  { name: 'Non-Apt Efficiencies', fields: [['total_basement_area', 'sq m'], ['circulation_area', 'sq m'], ['total_parking_area', 'sq m'], ['total_number_of_cars', '']] },
  { name: 'Structure', fields: [['total_steel_reinforcement', 'kg'], ['total_concrete_consumption', 'cubic m']] },
  { name: 'MEP', fields: [['air_conditioned_area_for_appartment', 'sq m'], ['tonnage_per_appartment', 'tonne'], ['air_conditioned_area_for_club', 'sq m'], ['tonnage_of_club_house', 'tonne'], ['passenger_lift_speed', 'm/s'], ['service_lift_speed', 'm/s'], ['avg_waiting_time', 'sec'], ['cost_per_tonne_apartment', ''], ['no_of_apartments', ''], ['cost_per_tonne_club', ''], ['no_of_clubs', ''], ['no_of_passanger_lift', ''], ['no_of_service_lift', '']] },
];
export const RESIDENTIAL_INPUT_KEYS = RESIDENTIAL_INPUT_GROUPS.flatMap((g) => g.fields.map((f) => f[0]));

// Cost constants carried on the key-ratio record (not shown as inputs) — defaults from the original data
export const RESIDENTIAL_COST_DEFAULTS = {
  cost_of_apartment_wall_construction: 50,
  cost_of_basement_wall_construction: 40,
  revenue_per_extra_car_slot: 500000,
  price_per_steel: 55,
  price_per_concrete: 5000,
  cost_of_passenger_lift_3ms: 0.69,
  cost_of_passenger_lift_3_5ms: 1.2,
  cost_of_passenger_lift_4ms: 1.4,
  cost_of_service_lift_2_5ms: 0.66,
  cost_of_service_lift_3ms: 0.7,
};

export const inputLabel = (key) => {
  const special = {
    average_wall_area_interior_exterior_per_unit: 'average wall area (interior + exterior) per unit',
    average_wall_area_interior_exterior_per_basement: 'average wall area (interior + exterior) per basement',
    no_of_passanger_lift: 'no. of passenger lift',
    air_conditioned_area_for_appartment: 'air conditioned area for apartment',
    tonnage_per_appartment: 'tonnage per apartment',
    far: 'FAR area',
    sales_price: 'sales price (₹/sq ft)',
    construction_cost_on_bua: 'construction cost on BUA (₹/sq ft)',
  };
  if (special[key]) return special[key];
  return key.replaceAll('_', ' ').replace(/\bno\b/gi, 'no.').replaceAll('far', 'FAR').replaceAll('bua', 'BUA');
};

// --------------------------------------------------------------------------------------------
// Residential ratio formulas keyed by calculated-field id
const RES_FORMULAS = {
  1: (f) => (f.carpet_area + f.total_external_wall_area + f.balcony_area) / f.saleable_area,
  2: (f) => f.carpet_area / f.saleable_area,
  3: (f) => f.balcony_area / f.saleable_area,
  4: (f) => f.built_up_area / f.saleable_area,
  5: (f) => f.saleable_area / f.far,
  14: (f) => f.car_length * f.car_width,
  15: (f) => f.total_parking_area / f.total_number_of_cars,
  16: (f) => (f.circulation_area / f.far) * 100,
  17: (f) => f.total_steel_reinforcement / (f.built_up_area * SQM_TO_SQFT),
  18: (f) => f.total_concrete_consumption / (f.built_up_area * SQM_TO_SQFT),
  19: (f) => (f.service_shaft_area / f.far) * 100,
  23: (f) => (f.air_conditioned_area_for_appartment / f.tonnage_per_appartment) * SQM_TO_SQFT,
  24: (f) => (f.air_conditioned_area_for_club / f.tonnage_of_club_house) * SQM_TO_SQFT,
  27: (f) => (f.far / f.permissible_far) * 100,
};
const RES_FORMULA_INPUTS = {
  1: ['carpet_area', 'total_external_wall_area', 'balcony_area', 'saleable_area'], 2: ['carpet_area', 'saleable_area'],
  3: ['balcony_area', 'saleable_area'], 4: ['built_up_area', 'saleable_area'], 5: ['saleable_area', 'far'],
  14: ['car_length', 'car_width'], 15: ['total_parking_area', 'total_number_of_cars'], 16: ['circulation_area', 'far'],
  17: ['total_steel_reinforcement', 'built_up_area'], 18: ['total_concrete_consumption', 'built_up_area'], 19: ['service_shaft_area', 'far'],
  23: ['air_conditioned_area_for_appartment', 'tonnage_per_appartment'], 24: ['air_conditioned_area_for_club', 'tonnage_of_club_house'],
  27: ['far', 'permissible_far'],
};
export const RATIO_UNITS = { 6: '%', 7: 'm', 10: 'm', 11: 'm', 12: 'm', 13: 'm', 14: 'sq m', 15: 'sq m/car', 16: '%', 17: 'Kg/sqft', 18: 'cum/sqft', 19: '%', 20: 'm/s', 21: 'm/s', 22: 'sec', 23: 'sq ft/TR', 24: 'sq ft/TR', 26: 'm', 27: '%' };

// FIX: original rounded concrete (id 18) to 2 dp on the residential page, so 0.046 showed as 0.05
export const decimalsFor = (id) => (Number(id) === 18 ? 3 : 2);

export function computeResidentialRatio(calcField, inputs) {
  const id = Number(calcField.id);
  const f = {};
  for (const [k, v] of Object.entries(inputs || {})) f[k] = num(v);
  if (RES_FORMULAS[id]) {
    if (RES_FORMULA_INPUTS[id].some((k) => f[k] === null || f[k] === undefined)) return null;
    const v = RES_FORMULAS[id](f);
    return Number.isFinite(v) ? round(v, decimalsFor(id)) : null; // FIX: original returned Infinity/NaN as 0
  }
  const deps = calcField.dependecy_fields || calcField.dependency_fields || [];
  if (deps.length === 1) return f[deps[0]] === null || f[deps[0]] === undefined ? null : round(f[deps[0]], decimalsFor(id));
  return null;
}

// --------------------------------------------------------------------------------------------
// Building-height dependent ranges for steel (17) and concrete (18)
const HEIGHT_RANGES = {
  17: {
    mid_end: ['4.75-5.2', '5.2-6.1', '6.1-6.5', '6.1-6.5', '6.1-6.5'],
    premium: ['0-7.5', '0-7.5', '0-7.5', '7.5-8.5', '7.5-8.5'],
    affluent: ['0-7.5', '0-7.5', '0-7.5', '8-9', '8-9'],
    high_street: ['6.2-7', '7-7.2', '7.2-7.5', '7.5-8', '8-9'],
    enclosed_mall: ['6.2-7', '7-7.2', '7.2-7.5', '7.5-8', '8-9'],
  },
  18: {
    mid_end: ['0-0.046', '0-0.046', '0-0.046', '0-0.046', '0-0.046'],
    premium: ['0-0.046', '0-0.046', '0-0.046', '0-0.052', '0-0.052'],
    affluent: ['0-0.046', '0-0.046', '0-0.046', '0-0.052', '0-0.052'],
    high_street: ['0-0.042', '0-0.045', '0-0.046', '0-0.048', '0-0.052'],
    enclosed_mall: ['0-0.042', '0-0.045', '0-0.046', '0-0.048', '0-0.052'],
  },
};
const heightIdx = (h) => (h < 50 ? 0 : h < 75 ? 1 : h < 100 ? 2 : h < 125 ? 3 : 4);
export function heightRange(id, category, buildingHeight) {
  const table = HEIGHT_RANGES[Number(id)];
  const cat = RANGE_KEYS[categoryKey(category)];
  if (!table || !cat || !table[cat]) return undefined;
  return table[cat][heightIdx(num(buildingHeight) ?? 0)];
}

// Green band = the range; yellow = 5% tolerance above it (matches original band tables for 17/18)
function heightBands(id, category, buildingHeight) {
  const r = heightRange(id, category, buildingHeight);
  if (!r) return null;
  const [min, max] = r.split('-').map(Number);
  return [{ min, max, color: 'green' }, { min: max, max: round(max * 1.05, 4), color: 'yellow' }];
}

// Parse "{0.70-0.74: green, 0.66-0.70: yellow}" / object / "NA" into bands
export function parseBands(range, buildingHeight) {
  if (range === null || range === undefined || range === 'NA' || range === '') return null;
  let obj = range;
  if (typeof range === 'string') {
    obj = {};
    range.replace(/[{}]/g, '').split(',').forEach((part) => {
      const [k, c] = part.split(':').map((s) => s && s.trim());
      if (k && c) obj[k] = c;
    });
  }
  if (typeof obj !== 'object') return null;
  // height-bucketed objects
  const h = num(buildingHeight) ?? 0;
  const bucket = h < 50 ? '<50' : h < 75 ? '<75' : h < 100 ? '<100' : '>=100';
  if (obj[bucket] && typeof obj[bucket] === 'object') obj = obj[bucket];
  else if (obj['>=75'] && h >= 75) obj = obj['>=75']; // FIX: original never reached the ">=75" bucket
  const bands = [];
  for (const [k, color] of Object.entries(obj)) {
    const m = String(k).match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
    if (m) bands.push({ min: Number(m[1]), max: Number(m[2]), color: String(color).toLowerCase() });
  }
  return bands.length ? bands.sort((a, b) => a.min - b.min) : null;
}

export const STATUS = { PENDING: 'pending', OK: 'true', FAIL: 'false' };

// Validity of a value against a static range string ("a-b" / "N<" / "N<=") and optional colour bands
export function validity(value, range, bands) {
  if (value === null || value === undefined || String(value).trim() === '') return { value: STATUS.PENDING, color: 'gray', message: '' };
  const v = Number(value);
  if (bands && bands.length) {
    const green = bands.filter((b) => b.color === 'green');
    const yellow = bands.filter((b) => b.color === 'yellow');
    if (green.some((b) => v >= b.min && v <= b.max)) return { value: STATUS.OK, color: 'green', message: 'Within the benchmark' };
    if (yellow.some((b) => v >= b.min && v <= b.max)) return { value: STATUS.OK, color: 'yellow', message: 'Close to the benchmark' };
    const all = [...green, ...yellow];
    if (!all.length) return { value: STATUS.FAIL, color: 'red', message: 'Benchmark reference data is missing' };
    if (v < Math.min(...all.map((b) => b.min))) return { value: STATUS.FAIL, color: 'red', message: 'Value less than benchmark' };
    if (v > Math.max(...all.map((b) => b.max))) return { value: STATUS.FAIL, color: 'red', message: 'Value more than benchmark' };
    return { value: STATUS.FAIL, color: 'red', message: 'Value is outside defined ranges' };
  }
  if (!range) return { value: STATUS.PENDING, color: 'gray', message: 'No benchmark defined' };
  const r = String(range).trim();
  if (/<=?$/.test(r)) {
    const thr = parseFloat(r.replace(/[<=]/g, ''));
    // FIX: original reported "more than benchmark" when the value was below the minimum
    return v < thr ? { value: STATUS.FAIL, color: 'red', message: 'Value less than benchmark' } : { value: STATUS.OK, color: 'green', message: 'Within the benchmark' };
  }
  const [min, max] = r.split('-').map(Number);
  if (Number.isNaN(min) || Number.isNaN(max)) return { value: STATUS.PENDING, color: 'gray', message: 'No benchmark defined' };
  if (v >= min && v <= max) return { value: STATUS.OK, color: 'green', message: 'Within the benchmark' };
  return v < min ? { value: STATUS.FAIL, color: 'red', message: 'Value less than benchmark' } : { value: STATUS.FAIL, color: 'red', message: 'Value more than benchmark' };
}

// Benchmark (static range + bands) for a calculated field and project category
export function benchmarkFor(calcField, category, buildingHeight) {
  const id = Number(calcField.id ?? calcField.field_id);
  const cat = RANGE_KEYS[categoryKey(category)] || 'premium';
  const hr = heightRange(id, category, buildingHeight);
  if (hr) return { range: hr, bands: heightBands(id, category, buildingHeight) };
  return { range: calcField[cat], bands: parseBands(calcField[`${cat}_range`], buildingHeight) };
}

export function evaluate(calcField, value, category, buildingHeight) {
  const { range, bands } = benchmarkFor(calcField, category, buildingHeight);
  return { ...validity(value, range, bands), range };
}

export const rangeMinMax = (range) => {
  if (!range || !String(range).includes('-')) return null;
  const [min, max] = String(range).split('-').map(Number);
  if (Number.isNaN(min) || Number.isNaN(max)) return null;
  return { min, max, average: (min + max) / 2 };
};

// --------------------------------------------------------------------------------------------
// Residential cost of deviation per field (₹ Cr). Returns null when no cost applies.
export function residentialFieldCost(calcField, value, check, inputs, category) {
  if (Number(calcField.rupee_value) === 0) return null;
  const f = {};
  for (const [k, v] of Object.entries(inputs || {})) f[k] = num(v);
  const { range } = benchmarkFor(calcField, category, f.building_height);
  const mm = rangeMinMax(range);
  if (!mm || value === null) return null;
  const msg = (check?.message || '').toLowerCase();
  const more = msg === 'value more than benchmark';
  const within = value >= mm.min && value <= mm.max;
  const id = Number(calcField.id);
  const name = String(calcField.field_name || '').toLowerCase().trim();
  const sq = SQM_TO_SQFT;
  let cost = null;
  if (name === 'floor to floor height for apartment') { if (more) cost = (f.floor_to_floor_height_apt - mm.max) * f.cost_of_apartment_wall_construction * f.average_wall_area_interior_exterior_per_unit * f.no_of_units / CRORE; }
  else if (name === 'floor to floor height for basement') { if (more) cost = (f.floor_to_floor_height_basement_b1_b2 - mm.max) * f.cost_of_basement_wall_construction * f.average_wall_area_interior_exterior_per_basement * f.no_of_basements / CRORE; }
  else if (id === 15) { if (value > mm.max) cost = (f.total_parking_area / mm.min - f.total_number_of_cars) * f.revenue_per_extra_car_slot / CRORE; }
  else if (id === 17) { if (value > mm.max) cost = (value - mm.max) * f.built_up_area * sq * f.price_per_steel / CRORE; }
  else if (id === 18) { if (value > mm.max) cost = (value - mm.max) * f.built_up_area * sq * f.price_per_concrete / CRORE; }
  else if (id === 23) { if (!within) cost = (f.tonnage_per_appartment - f.air_conditioned_area_for_appartment * sq / mm.min) * f.cost_per_tonne_apartment * f.no_of_apartments / CRORE; }
  else if (id === 24) { if (!within) cost = (f.tonnage_of_club_house - f.air_conditioned_area_for_club * sq / mm.min) * f.no_of_clubs * f.cost_per_tonne_club / CRORE; }
  else if (id === 21) {
    if (more) {
      const base = mm.max === 2.5 ? f.cost_of_service_lift_2_5ms : f.cost_of_service_lift_3ms;
      // FIX: original used the lift speed itself as the cost when speed ≠ 3 m/s
      const cur = f.service_lift_speed >= 3 ? f.cost_of_service_lift_3ms : f.cost_of_service_lift_2_5ms;
      cost = f.no_of_service_lift * (cur - base);
    }
  } else if (id === 20) {
    if (!within && f.passenger_lift_speed === 4) {
      const base = mm.max === 3.5 ? f.cost_of_passenger_lift_3_5ms : mm.max === 4 ? f.cost_of_passenger_lift_4ms : null;
      if (base !== null) cost = f.no_of_passanger_lift * (f.cost_of_passenger_lift_4ms - base);
    }
  }
  return cost === null || !Number.isFinite(cost) ? null : cost;
}

// "Efficiency" section economics for residential projects
export function residentialEconomics(inputs, valuesByName, rangesByName) {
  const f = {};
  for (const [k, v] of Object.entries(inputs || {})) f[k] = num(v) ?? 0;
  const mm = (n) => rangeMinMax(rangesByName[n]) || { min: 0, max: 0, average: 0 };
  const cur = (n) => num(valuesByName[n]) ?? 0;
  const sq = SQM_TO_SQFT;
  const SP = f.sales_price; const CC = f.construction_cost_on_bua; const SA = f.saleable_area; const BUA = f.built_up_area; const F = f.far;
  const REV = SA * sq * SP / CRORE; const CST = BUA * sq * CC / CRORE; const BASE = REV - CST;
  const z = f.permissible_far * cur('saleable/far'); const Bz = z * cur('bua/saleable');
  const farUtilisationCost = (z * sq * SP / CRORE) - (Bz * sq * CC / CRORE) - BASE;
  const q = f.permissible_far * mm('saleable/far').average; const qb = q * mm('bua/saleable').average;
  const farPermissibleMaximization = q * sq * SP / CRORE - qb * sq * CC / CRORE - BASE;
  const G = SA * mm('bua/saleable').average;
  const builtUpAreaOptimization = REV - G * sq * CC / CRORE - BASE;
  const newSale = mm('saleable/far').average * F; const newBUA = mm('bua/saleable').average * newSale;
  const newCarp = mm('carpet_area/saleable').average * newSale; const newBalc = mm('balcony_area/saleable_area').average * newSale;
  const newLoadingFactor = newSale ? (newCarp + f.total_external_wall_area + newBalc) / newSale : 0;
  const optimized = (newSale * sq * SP / CRORE - newBUA * sq * CC / CRORE) - BASE;
  const thSale = mm('saleable/far').max * F; const thBUA = mm('bua/saleable').min * thSale;
  const theoreticalLoadingFactor = thSale ? (f.total_external_wall_area + mm('balcony_area/saleable_area').average * thSale + mm('carpet_area/saleable').average * thSale) / thSale : 0;
  const theoretical = (thSale * sq * SP / CRORE - thBUA * sq * CC / CRORE) - BASE;
  const fin = (x) => (Number.isFinite(x) ? x : 0);
  return {
    farUtilisationCost: fin(farUtilisationCost),
    optimized: fin(optimized),
    new_loading_factor: fin(newLoadingFactor),
    new_loading_factor2: fin(theoreticalLoadingFactor),
    theoritical_maximum: fin(theoretical),
    far_permissible_maximization: `₹ ${Math.round(fin(farPermissibleMaximization))} Cr`,
    built_up_area_optimization: `₹ ${Math.round(fin(builtUpAreaOptimization))} Cr`,
  };
}

export const normName = (s) => String(s || '').toLowerCase().trim().replaceAll(' ', '_');

// Evaluate a whole residential key-ratio sheet: returns per-field results + section/tab totals
export function evaluateResidential(keyCalFields, inputs, category) {
  const results = {}; const sectionCost = {}; const tabCost = {};
  const valuesByName = {}; const rangesByName = {};
  let effSection = null;
  for (const [tab, sections] of Object.entries(keyCalFields || {})) {
    tabCost[tab] = 0;
    for (const [section, fields] of Object.entries(sections || {})) {
      sectionCost[section] = 0;
      for (const cf of fields) {
        const value = computeResidentialRatio(cf, inputs);
        const check = evaluate(cf, value, category, inputs?.building_height);
        valuesByName[normName(cf.field_name)] = value;
        rangesByName[normName(cf.field_name)] = check.range;
        results[cf.id] = { value, check, cost: null };
        if (section.toLowerCase() === 'efficiency') effSection = { tab, section };
      }
    }
  }
  for (const [tab, sections] of Object.entries(keyCalFields || {})) {
    for (const [section, fields] of Object.entries(sections || {})) {
      if (section.toLowerCase() === 'efficiency') continue;
      for (const cf of fields) {
        const r = results[cf.id];
        r.cost = residentialFieldCost(cf, r.value, r.check, inputs, category);
        if (r.cost) { sectionCost[section] += Math.round(r.cost); tabCost[tab] += Math.round(r.cost); }
      }
    }
  }
  let economics = null;
  if (effSection) {
    economics = residentialEconomics(inputs, valuesByName, rangesByName);
    sectionCost[effSection.section] = economics.optimized;
    tabCost[effSection.tab] += economics.optimized;
    if (results[27]) results[27].cost = economics.farUtilisationCost;
  }
  return { results, sectionCost, tabCost, economics };
}

// Module card statistics derived from an evaluated sheet
export function keyRatioStats(results, flags = {}) {
  const rows = Object.entries(results);
  const filled = rows.filter(([, r]) => r.check.value !== STATUS.PENDING);
  const ok = filled.filter(([, r]) => r.check.value === STATUS.OK).length;
  const deviations = filled.length - ok;
  const flagged = Object.values(flags).filter((x) => x && (x.is_flag === true || x.is_flag === 1 || x.flag === 1)).length;
  return { allParams: rows.length, benchmarkParams: ok, deviations, flags: flagged, complianceScore: filled.length ? Math.round((ok / filled.length) * 100) : 0 };
}

// --------------------------------------------------------------------------------------------
// Commercial outputs keyed by output field_id
const COM_FORMULAS = {
  1: [[2, 53], (i) => (i[2] / i[53]) * 100], 2: [[3, 52], (i) => (i[3] / i[52]) * 100], 3: [[4, 42], (i) => (i[4] / i[42]) * 100],
  4: [[6, 1], (i) => (i[6] / i[1]) * 100], 8: [[11, 17], (i) => i[11] / i[17]], 17: [[14, 42], (i) => i[14] / (i[42] * SQM_TO_SQFT)],
  18: [[15, 42], (i) => i[15] / (i[42] * SQM_TO_SQFT)], 22: [[16, 43], (i) => (i[16] / i[43]) * SQM_TO_SQFT], 26: [[1, 35], (i) => (i[1] / i[35]) * 100],
  30: [[74, 73], (i) => (i[74] / i[73]) * 100], 31: [[58, 1], (i) => i[58] / i[1]], 32: [[58, 52], (i) => i[58] / i[52]], 33: [[58, 53], (i) => i[58] / i[53]],
  37: [[42, 58], (i) => i[42] / i[58]], 38: [[42, 59], (i) => i[42] / i[59]], 39: [[42, 60], (i) => i[42] / i[60]], 41: [[71, 58], (i) => i[71] / i[58]],
  44: [[79, 77], (i) => (i[79] / i[77]) * SQM_TO_SQFT],
};
export const PERCENT_OUTPUTS = [1, 2, 3, 4];

export function commercialInputMap(inputs) {
  const m = {};
  for (const r of inputs || []) m[Number(r.field_id)] = num(r.value);
  return m;
}

export function computeCommercialOutput(row, inputMap) {
  const id = Number(row.field_id);
  if (COM_FORMULAS[id]) {
    const [needs, fn] = COM_FORMULAS[id];
    if (needs.some((n) => inputMap[n] === null || inputMap[n] === undefined)) return null;
    const v = fn(inputMap);
    return Number.isFinite(v) ? round(v, decimalsFor(id)) : null;
  }
  const deps = row.dependency || [];
  if (deps.length === 1) return inputMap[Number(deps[0])] ?? null;
  return null;
}

export function commercialFieldCost(id, value, check, mm, i) {
  if (!mm || value === null) return 0;
  const more = check?.message === 'Value more than benchmark';
  const within = value >= mm.min && value <= mm.max;
  const d = (x, def) => (x === null || x === undefined ? def : x);
  let c = 0;
  switch (Number(id)) {
    case 20: if (more) { const base = mm.max === 2.5 ? d(i[65], 0.66) : d(i[66], 0.7); const cur = value >= 3 ? d(i[66], 0.7) : d(i[65], 0.66); c = (i[64] || 0) * (cur - base); } break;
    case 43: if (more) { const base = mm.max === 2.5 ? d(i[82], 0.66) : d(i[83], 0.7); const cur = value >= 3 ? d(i[83], 0.7) : d(i[82], 0.66); c = (i[80] || 0) * (cur - base); } break;
    case 19: if (!within && value === 4) { const base = mm.max === 2.5 ? d(i[69], 1.2) : mm.max === 4 ? d(i[70], 1.4) : null; if (base !== null) c = (i[67] || 0) * (d(i[70], 1.4) - base); } break;
    case 42: if (!within && value === 4) { const base = mm.max === 2.5 ? d(i[85], 1.2) : mm.max === 4 ? d(i[86], 1.4) : null; if (base !== null) c = (i[81] || 0) * (d(i[86], 1.4) - base); } break;
    case 17: if (value > mm.max) c = (value - mm.max) * i[42] * SQM_TO_SQFT * d(i[46], 55) / CRORE; break;
    case 18: if (value > mm.max) c = (value - mm.max) * i[42] * SQM_TO_SQFT * d(i[47], 5000) / CRORE; break;
    case 8: if (value > mm.max) c = (i[11] / mm.min - i[17]) * d(i[44], 500000) / CRORE; break;
    case 22: if (!within) c = (i[43] - i[16] * SQM_TO_SQFT / mm.min) * i[50] / CRORE; break;
    case 44: if (!within) c = (i[77] - i[79] * SQM_TO_SQFT / mm.min) * i[78] / CRORE; break;
    case 16: if (more) c = (value - mm.max) * d(i[45], 40) * i[48] * i[49] / CRORE; break;
    default: c = 0;
  }
  return Number.isFinite(c) ? Math.round(c) : 0; // FIX: original produced undefined/NaN tab totals
}

export function evaluateCommercial(outputData, inputs, category) {
  const i = commercialInputMap(inputs);
  const results = {}; const sectionCost = {}; const tabCost = {}; const mmById = {}; const valById = {};
  for (const [tab, sections] of Object.entries(outputData || {})) {
    tabCost[tab] = 0;
    for (const [section, rows] of Object.entries(sections || {})) {
      sectionCost[section] = 0;
      for (const row of rows) {
        const value = computeCommercialOutput(row, i);
        const check = evaluate({ ...row, id: row.field_id }, value, category, i[41]);
        const mm = rangeMinMax(check.range);
        const cost = commercialFieldCost(row.field_id, value, check, mm, i);
        results[row.field_id] = { value, check, cost };
        mmById[row.field_id] = mm; valById[row.field_id] = value;
        sectionCost[section] += cost; tabCost[tab] += cost;
      }
    }
  }
  const sq = SQM_TO_SQFT; const g = (n) => i[n] ?? 0; const avg = (id) => mmById[id]?.average ?? 0;
  const D = g(58) ? g(60) / g(58) : 0; const T = g(58) ? g(59) / g(58) : 0;
  const R = D * g(62) + T * g(61);
  const REV = g(58) * sq * R / CRORE; const CST = g(42) * sq * g(63) / CRORE; const BASE = REV - CST;
  const z = g(1) * avg(31); const B = z * avg(37);
  const ae = g(35) * (valById[31] ?? 0); const L = ae * (valById[37] ?? 0);
  const fin = (x) => (Number.isFinite(x) ? Math.round(x) : 0);
  const economics = {
    SaleableAreaMaximization: fin(z * sq * R / CRORE - B * sq * g(63) / CRORE - BASE),
    FARPermissibleUtilization: fin(ae * sq * R / CRORE - L * sq * g(63) / CRORE - BASE),
    BuiltUpAreaOptimization: fin(REV - (g(58) * avg(37) * sq * g(63) / CRORE) - BASE),
    Saleable_GC_Maximization: fin((g(73) * (g(56) / 100) - g(74)) * (valById[6] ?? 0) * g(72) / CRORE),
  };
  Object.assign(sectionCost, economics);
  if (results[30]) results[30].cost = economics.Saleable_GC_Maximization;
  return { results, sectionCost, tabCost, economics };
}

export function commercialStats(results, outputs = []) {
  const rows = Object.values(results);
  const filled = rows.filter((r) => r.check.value !== STATUS.PENDING);
  const ok = filled.filter((r) => r.check.value === STATUS.OK).length;
  return {
    allParams: rows.length,
    benchmarkParams: ok,
    deviations: filled.length - ok,
    flags: outputs.filter((o) => o.is_flag === true || o.is_flag === 1 || o.is_flag === 'true').length,
    complianceScore: filled.length ? Math.round((ok / filled.length) * 100) : 0,
  };
}

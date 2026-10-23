/*
 * Data model for M3M One.
 * Table and column names mirror the original API's JSON keys so that a database export from the
 * previous vendor can be migrated with a straight column mapping.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const JSONType = (name) => ({
  type: DataTypes.TEXT('long'),
  get() {
    const raw = this.getDataValue(name);
    if (raw === null || raw === undefined || raw === '') return null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  set(v) { this.setDataValue(name, v === undefined || v === null ? null : JSON.stringify(v)); },
});

// ---------------------------------------------------------------- users / auth
const User = sequelize.define('User', {
  name: DataTypes.STRING,
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: DataTypes.STRING,
  password: DataTypes.STRING,
  role: { type: DataTypes.STRING, defaultValue: 'general_contributor' },
  department: DataTypes.STRING,
  company: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  failedLoginAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  lockUntil: DataTypes.DATE,
  resetToken: DataTypes.STRING,
  resetTokenExpires: DataTypes.DATE,
}, { tableName: 'users', defaultScope: { attributes: { exclude: ['password', 'resetToken', 'resetTokenExpires'] } } });

// Both "classic" roles and Module Access records ("<company>:<department>") live here
const Role = sequelize.define('Role', {
  roleName: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.STRING(1000),
  permissions: JSONType('permissions'),
}, { tableName: 'roles' });

// ---------------------------------------------------------------- projects
const Project = sequelize.define('Project', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  projectType: DataTypes.STRING, // residential | commercial
  category: DataTypes.STRING, // mid-end | premium | affluent | high_street | enclosed_mall
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  projectOwner: DataTypes.STRING,
  location: DataTypes.STRING,
  userId: DataTypes.INTEGER,
  userName: DataTypes.STRING,
  userEmail: DataTypes.STRING,
  userNumber: DataTypes.STRING,
  userDesignation: DataTypes.STRING,
  date: DataTypes.DATE,
  projectClassification: DataTypes.STRING,
  designOwner: DataTypes.STRING,
  structureOwner: DataTypes.STRING,
  mepOwner: DataTypes.STRING,
  interiorDesignOwner: DataTypes.STRING,
  far_permissible: DataTypes.DECIMAL(18, 2),
  site_area: DataTypes.DECIMAL(18, 2),
  site_area_acres: DataTypes.DECIMAL(18, 6),
  locationCategory: DataTypes.STRING, // M3M Noida | M3M Gurgaon | Smartworld
  moduleId: DataTypes.INTEGER,
}, { tableName: 'projects' });

// ---------------------------------------------------------------- modules / chapters (question bank)
const Module = sequelize.define('Module', {
  moduleNumber: DataTypes.INTEGER,
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
  projectType: DataTypes.STRING, // residential | commercial
  status: { type: DataTypes.STRING, defaultValue: 'active' },
}, { tableName: 'modules' });

const Chapter = sequelize.define('Chapter', {
  moduleId: DataTypes.INTEGER,
  title: DataTypes.STRING,
  chapterNumber: DataTypes.INTEGER,
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  isLastChapter: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'chapters' });

const ChapterSection = sequelize.define('ChapterSection', {
  chapterId: DataTypes.INTEGER,
  title: DataTypes.STRING,
  content: DataTypes.TEXT,
  status: { type: DataTypes.STRING, defaultValue: 'active' },
}, { tableName: 'chapter_sections' });

const SectionField = sequelize.define('SectionField', {
  sectionId: DataTypes.INTEGER,
  fieldName: DataTypes.STRING,
  fieldType: DataTypes.STRING, // select | text | number | ...
  midEndAns: JSONType('midEndAns'),
  premiumAns: JSONType('premiumAns'),
  affluentAns: JSONType('affluentAns'),
  hiStreetAns: JSONType('hiStreetAns'),
  enclosedMallAns: JSONType('enclosedMallAns'),
  inputValue: JSONType('inputValue'),
}, { tableName: 'section_fields' });

const SectionFieldOption = sequelize.define('SectionFieldOption', {
  sectionFieldId: DataTypes.INTEGER,
  fieldOption: DataTypes.STRING,
}, { tableName: 'section_field_options' });

// Per-project answer to a section field
const FieldValue = sequelize.define('FieldValue', {
  projectId: DataTypes.INTEGER,
  sectionFieldId: DataTypes.INTEGER,
  answer: DataTypes.TEXT,
  anyOtherAnswer: DataTypes.TEXT,
  remark: DataTypes.TEXT,
  isFlaged: { type: DataTypes.INTEGER, defaultValue: 0 },
  isDraft: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'field_values', indexes: [{ unique: true, fields: ['projectId', 'sectionFieldId'] }] });

// Per-project module progress (projectModule block on the module list)
const ProjectModule = sequelize.define('ProjectModule', {
  projectId: DataTypes.INTEGER,
  moduleId: DataTypes.INTEGER,
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  completedChapters: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'project_modules', indexes: [{ unique: true, fields: ['projectId', 'moduleId'] }] });

// ---------------------------------------------------------------- key ratio
const KeyRatio = sequelize.define('KeyRatio', {
  project_id: DataTypes.INTEGER,
  module_id: DataTypes.INTEGER,
  user_id: DataTypes.INTEGER,
  kind: { type: DataTypes.STRING, defaultValue: 'residential' }, // residential | commercial
  isDraft: { type: DataTypes.BOOLEAN, defaultValue: false },
  inputs: JSONType('inputs'), // every key-ratio input field, keyed exactly as the API sends them
  flags: JSONType('flags'), // { [calcFieldId]: { is_flag, remark, field_cost } }
  calculated: JSONType('calculated'), // calculatedFields record (loading factors, optimisation figures)
}, { tableName: 'key_ratios', underscored: false });

// Benchmark definitions for calculated key ratios (section/field/range bands per category)
const KeyRatioBenchmark = sequelize.define('KeyRatioBenchmark', {
  kind: { type: DataTypes.STRING, defaultValue: 'residential' },
  field_name: DataTypes.STRING,
  type: DataTypes.STRING, // Design | Structure | MEP
  section_id: DataTypes.INTEGER,
  section: DataTypes.STRING,
  formula: DataTypes.STRING, // key into services/keyRatio formulas
  dependecy_fields: JSONType('dependecy_fields'),
  mid_end: DataTypes.STRING,
  mid_end_range: DataTypes.STRING,
  premium: DataTypes.STRING,
  premium_range: DataTypes.STRING,
  affluent: DataTypes.STRING,
  affluent_range: DataTypes.STRING,
  high_street: DataTypes.STRING,
  high_street_range: DataTypes.STRING,
  enclosed_mall: DataTypes.STRING,
  enclosed_mall_range: DataTypes.STRING,
  rupee_value: { type: DataTypes.INTEGER, defaultValue: 0 },
  order_id: DataTypes.INTEGER,
  units: DataTypes.STRING,
  is_visible: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'key_ratio_benchmarks' });

// Commercial key-ratio input definitions (residential inputs are fixed columns, see shared/keyRatio.js)
const KeyRatioInputField = sequelize.define('KeyRatioInputField', {
  kind: { type: DataTypes.STRING, defaultValue: 'commercial' },
  field_id: DataTypes.INTEGER,
  tab: DataTypes.STRING,
  section: DataTypes.STRING,
  field_name: DataTypes.STRING,
  units: DataTypes.STRING,
  is_visible: { type: DataTypes.BOOLEAN, defaultValue: true },
  default_value: DataTypes.STRING,
  order_id: DataTypes.INTEGER,
}, { tableName: 'key_ratio_input_fields' });

// Free-form benchmark dictionary used by the design chapters (GET /benchmark)
const Benchmark = sequelize.define('Benchmark', {
  label: { type: DataTypes.STRING, unique: true },
  benchmarkValue: DataTypes.STRING(1000),
  validOptions: JSONType('validOptions'),
  status: DataTypes.STRING,
}, { tableName: 'benchmarks' });

// ---------------------------------------------------------------- design brief
const deptCommon = {
  userId: DataTypes.INTEGER,
  projectId: DataTypes.INTEGER,
  assignedTo: DataTypes.INTEGER,
  deadline: DataTypes.DATE,
  receivedDate: DataTypes.DATE,
  customFields: JSONType('customFields'),
  status: DataTypes.STRING,
  instructions: DataTypes.TEXT,
  revisionReasons: DataTypes.TEXT,
};
const withNotes = (keys, extraSuffixes = []) => {
  const out = {};
  for (const k of keys) {
    out[k] = DataTypes.TEXT;
    out[`${k}Note`] = DataTypes.TEXT;
    for (const s of extraSuffixes) out[`${k}${s}`] = DataTypes.TEXT;
  }
  return out;
};

const DEPARTMENT_FIELDS = {
  liaison: ['zoningClassificationAndLandUse', 'aaiHeightClearanceStatus', 'phasingStrategyInput', 'adjoiningRoadsStatus', 'revenueRastaTreatment'],
  businessDevelopment: ['licenseApplication', 'far', 'tdrUtilization', 'productMix', 'phasingStrategy'],
  land: ['certifiedLandBoundaryForTestFitPlanning', 'finalLandBoundary', 'finalPlotBoundary', 'htLinesOnSite', 'proximityStudyOfBuildingStructure', 'anyMismatchInSiteBoundaries', 'topographicalSurvey', 'otherConstraints', 'encroachments'],
  structure: ['preferredStructuralSystem', 'groundwaterTableLevel', 'recommendedPlinthLevelAboveRoad', 'soilBearingCapacity', 'foundationLevelSoil', 'typeOfFoundationSoil', 'floodAnalysisReport', 'foundationLevelFlood', 'typeOfFoundationFlood'],
  mep: [
    'oduLocationsAndSizes', 'floodAnalysisReport',
    // MEP chapter (lifts + HVAC) keys stored on the same record
    'passengerLiftsNo', 'passengerLiftsStops', 'passengerLiftsSpeed', 'passengerLiftsPerTower', 'passengerAverageWait',
    'passengerLiftSizeLength', 'passengerLiftSizeWidth', 'serviceLiftsNo', 'serviceLiftsStops', 'serviceLiftsSpeed',
    'serviceLiftsPerTower', 'serviceAverageWait', 'serviceLiftSizeLength', 'serviceLiftSizeWidth', 'acProvisionUnits',
    'acAreaApartment', 'tonnageApartment', 'costPerTonneApartment', 'acAreaClub', 'tonnageClub', 'efficiencyApartment', 'efficiencyClub',
  ],
};

const Liaison = sequelize.define('Liaison', { ...deptCommon, ...withNotes(DEPARTMENT_FIELDS.liaison) }, { tableName: 'liaisons' });
const BusinessDevelopment = sequelize.define('BusinessDevelopment', { ...deptCommon, ...withNotes(DEPARTMENT_FIELDS.businessDevelopment) }, { tableName: 'business_developments' });
const Land = sequelize.define('Land', { ...deptCommon, ...withNotes(DEPARTMENT_FIELDS.land, ['CADNote', 'PDFNote']) }, { tableName: 'lands' });
const Structure = sequelize.define('Structure', { ...deptCommon, ...withNotes(DEPARTMENT_FIELDS.structure) }, { tableName: 'structures' });
const Mep = sequelize.define('Mep', { ...deptCommon, ...withNotes(DEPARTMENT_FIELDS.mep) }, { tableName: 'meps' });

// One JSON document per project; every design chapter writes its own top-level key
const DesignBriefSummary = sequelize.define('DesignBriefSummary', {
  projectId: { type: DataTypes.INTEGER, unique: true },
  data: JSONType('data'),
}, { tableName: 'design_brief_summaries' });

const DesignBriefComment = sequelize.define('DesignBriefComment', {
  projectId: DataTypes.INTEGER,
  department: DataTypes.STRING,
  comment: DataTypes.TEXT,
  status: DataTypes.STRING,
  userId: DataTypes.INTEGER,
}, { tableName: 'design_brief_comments' });

const DropdownOption = sequelize.define('DropdownOption', {
  fieldKey: DataTypes.STRING,
  optionValue: DataTypes.STRING,
  userId: DataTypes.INTEGER,
}, { tableName: 'dropdown_options' });

// ---------------------------------------------------------------- platform
const Notification = sequelize.define('Notification', {
  userId: DataTypes.INTEGER,
  type: DataTypes.STRING,
  message: DataTypes.TEXT,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: JSONType('metadata'),
}, { tableName: 'notifications' });

const AuditLog = sequelize.define('AuditLog', {
  userId: DataTypes.INTEGER,
  taskType: DataTypes.STRING,
  description: DataTypes.TEXT,
  projectId: DataTypes.INTEGER,
}, { tableName: 'audit_logs' });

const Upload = sequelize.define('Upload', {
  userId: DataTypes.INTEGER,
  originalName: DataTypes.STRING,
  storedName: DataTypes.STRING,
  mimeType: DataTypes.STRING,
  size: DataTypes.INTEGER,
  url: DataTypes.STRING(1000),
}, { tableName: 'uploads' });

// ---------------------------------------------------------------- associations
Chapter.hasMany(ChapterSection, { foreignKey: 'chapterId', as: 'chapterSections' });
ChapterSection.hasMany(SectionField, { foreignKey: 'sectionId', as: 'sectionFields' });
SectionField.hasMany(SectionFieldOption, { foreignKey: 'sectionFieldId', as: 'sectionFieldOptions' });
Module.hasMany(Chapter, { foreignKey: 'moduleId', as: 'moduleChapters' });

const DEPARTMENT_MODELS = { liaison: Liaison, businessDevelopment: BusinessDevelopment, land: Land, structure: Structure, mep: Mep };
for (const M of Object.values(DEPARTMENT_MODELS)) {
  M.belongsTo(User, { foreignKey: 'assignedTo', as: 'Assignee' });
  M.belongsTo(User, { foreignKey: 'userId', as: 'Creator' });
}
DesignBriefComment.belongsTo(User, { foreignKey: 'userId', as: 'Creator' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'Creator' });

module.exports = {
  sequelize,
  User, Role, Project, Module, Chapter, ChapterSection, SectionField, SectionFieldOption, FieldValue, ProjectModule,
  KeyRatio, KeyRatioBenchmark, KeyRatioInputField, Benchmark,
  Liaison, BusinessDevelopment, Land, Structure, Mep, DEPARTMENT_MODELS, DEPARTMENT_FIELDS,
  DesignBriefSummary, DesignBriefComment, DropdownOption,
  Notification, AuditLog, Upload,
};

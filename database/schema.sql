/*
  M3M One — SQL Server schema (SQL Server 2019+ / Azure SQL)
  Run once on an empty database:  sqlcmd -S <server> -d M3M_One -i schema.sql
  JSON columns are NVARCHAR(MAX) with ISJSON checks.
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------------------------------------------------------------- users & access */
CREATE TABLE users (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  name                NVARCHAR(255)  NULL,
  email               NVARCHAR(255)  NOT NULL CONSTRAINT uq_users_email UNIQUE,
  phone               NVARCHAR(50)   NULL,
  password            NVARCHAR(255)  NULL,          -- bcrypt hash
  role                NVARCHAR(50)   NOT NULL DEFAULT 'general_contributor',
                      -- super_admin | general_admin | design_admin | general_contributor | design_contributor
  department          NVARCHAR(50)   NULL,
                      -- super_admin | design | design_arch | design_str | design_mep | structure | mep | interior | pmo | cp | liaison | pmo_budget | bt | pl
  company             NVARCHAR(50)   NULL,          -- m3m_gurgaon | m3m_noida | smart_world
  status              NVARCHAR(20)   NOT NULL DEFAULT 'active',
  failedLoginAttempts INT            NOT NULL DEFAULT 0,
  lockUntil           DATETIMEOFFSET NULL,
  resetToken          NVARCHAR(255)  NULL,
  resetTokenExpires   DATETIMEOFFSET NULL,
  createdAt           DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt           DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Classic roles and module-access records (roleName "<company>:<department>")
CREATE TABLE roles (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  roleName    NVARCHAR(255)  NOT NULL,
  description NVARCHAR(1000) NULL,
  permissions NVARCHAR(MAX)  NULL CONSTRAINT ck_roles_perm CHECK (permissions IS NULL OR ISJSON(permissions) = 1),
  createdAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_roles_name ON roles(roleName);

/* ---------------------------------------------------------------- projects */
CREATE TABLE projects (
  id                    INT IDENTITY(1,1) PRIMARY KEY,
  name                  NVARCHAR(255)  NOT NULL,
  description           NVARCHAR(MAX)  NULL,
  projectType           NVARCHAR(30)   NULL,   -- residential | commercial | mixed
  category              NVARCHAR(30)   NULL,   -- mid-end | premium | affluent | hi_street | enclosed_mall
  status                NVARCHAR(30)   NOT NULL DEFAULT 'pending',
  projectOwner          NVARCHAR(255)  NULL,
  location              NVARCHAR(500)  NULL,
  userId                INT            NULL REFERENCES users(id),
  userName              NVARCHAR(255)  NULL,
  userEmail             NVARCHAR(255)  NULL,
  userNumber            NVARCHAR(20)   NULL,
  userDesignation       NVARCHAR(255)  NULL,
  date                  DATETIMEOFFSET NULL,
  projectClassification NVARCHAR(100)  NULL,   -- Delivered | Ongoing (RERA Obtained) | Future (License Applied)
  designOwner           NVARCHAR(255)  NULL,
  structureOwner        NVARCHAR(255)  NULL,
  mepOwner              NVARCHAR(255)  NULL,
  interiorDesignOwner   NVARCHAR(255)  NULL,
  far_permissible       DECIMAL(18,2)  NULL,
  site_area             DECIMAL(18,2)  NULL,   -- sq m
  site_area_acres       DECIMAL(18,6)  NULL,
  locationCategory      NVARCHAR(50)   NULL,   -- M3M Noida | M3M Gurgaon | Smartworld
  moduleId              INT            NULL,
  createdAt             DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt             DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_projects_filter ON projects(locationCategory, projectType, category, date);

/* ---------------------------------------------------------------- modules & question bank */
CREATE TABLE modules (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  moduleNumber INT           NULL,
  name         NVARCHAR(255) NOT NULL,
  description  NVARCHAR(MAX) NULL,
  projectType  NVARCHAR(30)  NULL,
  status       NVARCHAR(20)  NOT NULL DEFAULT 'active',
  createdAt    DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt    DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE chapters (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  moduleId      INT           NOT NULL REFERENCES modules(id),
  title         NVARCHAR(255) NOT NULL,
  chapterNumber INT           NOT NULL,
  status        NVARCHAR(20)  NOT NULL DEFAULT 'active',
  isLastChapter BIT           NOT NULL DEFAULT 0,
  createdAt     DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt     DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE chapter_sections (
  id        INT IDENTITY(1,1) PRIMARY KEY,
  chapterId INT           NOT NULL REFERENCES chapters(id),
  title     NVARCHAR(255) NOT NULL,
  content   NVARCHAR(MAX) NULL,
  status    NVARCHAR(20)  NOT NULL DEFAULT 'active',
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE section_fields (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  sectionId       INT           NOT NULL REFERENCES chapter_sections(id),
  fieldName       NVARCHAR(500) NOT NULL,
  fieldType       NVARCHAR(30)  NOT NULL,      -- select | multiselect | text | number | date
  midEndAns       NVARCHAR(MAX) NULL,          -- JSON array of benchmark answers per category
  premiumAns      NVARCHAR(MAX) NULL,
  affluentAns     NVARCHAR(MAX) NULL,
  hiStreetAns     NVARCHAR(MAX) NULL,
  enclosedMallAns NVARCHAR(MAX) NULL,
  inputValue      NVARCHAR(MAX) NULL,
  createdAt       DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt       DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE section_field_options (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  sectionFieldId INT           NOT NULL REFERENCES section_fields(id),
  fieldOption    NVARCHAR(500) NOT NULL,
  createdAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- One answer per project per question
CREATE TABLE field_values (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  projectId      INT           NOT NULL REFERENCES projects(id),
  sectionFieldId INT           NOT NULL REFERENCES section_fields(id),
  answer         NVARCHAR(MAX) NULL,           -- text, or JSON array for multiselect
  anyOtherAnswer NVARCHAR(MAX) NULL,
  remark         NVARCHAR(MAX) NULL,
  isFlaged       INT           NOT NULL DEFAULT 0,
  isDraft        BIT           NOT NULL DEFAULT 0,
  createdAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT uq_field_values UNIQUE (projectId, sectionFieldId)
);

CREATE TABLE project_modules (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  projectId         INT          NOT NULL REFERENCES projects(id),
  moduleId          INT          NOT NULL REFERENCES modules(id),
  status            NVARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | active | completed
  completedChapters INT          NOT NULL DEFAULT 0,
  createdAt         DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt         DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT uq_project_modules UNIQUE (projectId, moduleId)
);

/* ---------------------------------------------------------------- key ratios */
CREATE TABLE key_ratios (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  project_id INT           NOT NULL REFERENCES projects(id),
  module_id  INT           NULL,
  user_id    INT           NULL REFERENCES users(id),
  kind       NVARCHAR(20)  NOT NULL DEFAULT 'residential',
  isDraft    BIT           NOT NULL DEFAULT 0,
  inputs     NVARCHAR(MAX) NULL,   -- JSON: residential {key:value}, commercial [{field_id,value}]
  flags      NVARCHAR(MAX) NULL,   -- JSON: {ratioId:{is_flag,remark,calculated_cost,field_value}}
  calculated NVARCHAR(MAX) NULL,   -- JSON: loading factors, optimisation figures, section costs
  createdAt  DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt  DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_key_ratios_project ON key_ratios(project_id);

-- Calculated ratios and their benchmark bands per category
CREATE TABLE key_ratio_benchmarks (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  kind                NVARCHAR(20)  NOT NULL DEFAULT 'residential',
  field_name          NVARCHAR(255) NOT NULL,
  type                NVARCHAR(50)  NOT NULL,   -- tab: Design | Structure | MEP
  section_id          INT           NULL,
  section             NVARCHAR(255) NOT NULL,
  formula             NVARCHAR(100) NULL,
  dependecy_fields    NVARCHAR(MAX) NULL,       -- JSON array of input keys
  mid_end             NVARCHAR(100) NULL, mid_end_range       NVARCHAR(500) NULL,
  premium             NVARCHAR(100) NULL, premium_range       NVARCHAR(500) NULL,
  affluent            NVARCHAR(100) NULL, affluent_range      NVARCHAR(500) NULL,
  high_street         NVARCHAR(100) NULL, high_street_range   NVARCHAR(500) NULL,
  enclosed_mall       NVARCHAR(100) NULL, enclosed_mall_range NVARCHAR(500) NULL,
  rupee_value         INT           NOT NULL DEFAULT 0,
  order_id            INT           NULL,
  units               NVARCHAR(50)  NULL,
  is_visible          BIT           NOT NULL DEFAULT 1,
  createdAt           DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt           DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Commercial key-ratio input definitions
CREATE TABLE key_ratio_input_fields (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  kind          NVARCHAR(20)  NOT NULL DEFAULT 'commercial',
  field_id      INT           NOT NULL,
  tab           NVARCHAR(100) NOT NULL,
  section       NVARCHAR(255) NOT NULL,
  field_name    NVARCHAR(255) NOT NULL,
  units         NVARCHAR(50)  NULL,
  is_visible    BIT           NOT NULL DEFAULT 1,
  default_value NVARCHAR(50)  NULL,
  order_id      INT           NULL,
  createdAt     DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt     DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Free-text benchmark dictionary (label → value + valid options)
CREATE TABLE benchmarks (
  id             INT IDENTITY(1,1) PRIMARY KEY,
  label          NVARCHAR(255)  NOT NULL CONSTRAINT uq_benchmarks_label UNIQUE,
  benchmarkValue NVARCHAR(1000) NULL,
  validOptions   NVARCHAR(MAX)  NULL,
  status         NVARCHAR(50)   NULL,
  createdAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt      DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

/* ---------------------------------------------------------------- department inputs
   Every field X has a value column X and an attachment URL column XNote.
   Common columns: userId (creator), projectId, assignedTo, deadline, receivedDate,
   customFields (JSON), status, instructions, revisionReasons. */
CREATE TABLE liaisons (
  id INT IDENTITY(1,1) PRIMARY KEY,
  userId INT NULL REFERENCES users(id), projectId INT NOT NULL REFERENCES projects(id), assignedTo INT NULL REFERENCES users(id),
  deadline DATETIMEOFFSET NULL, receivedDate DATETIMEOFFSET NULL, customFields NVARCHAR(MAX) NULL,
  status NVARCHAR(30) NULL, instructions NVARCHAR(MAX) NULL, revisionReasons NVARCHAR(MAX) NULL,
  zoningClassificationAndLandUse NVARCHAR(MAX) NULL, zoningClassificationAndLandUseNote NVARCHAR(1000) NULL,
  aaiHeightClearanceStatus NVARCHAR(MAX) NULL, aaiHeightClearanceStatusNote NVARCHAR(1000) NULL,
  phasingStrategyInput NVARCHAR(MAX) NULL, phasingStrategyInputNote NVARCHAR(1000) NULL,
  adjoiningRoadsStatus NVARCHAR(MAX) NULL, adjoiningRoadsStatusNote NVARCHAR(1000) NULL,
  revenueRastaTreatment NVARCHAR(MAX) NULL, revenueRastaTreatmentNote NVARCHAR(1000) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE business_developments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  userId INT NULL REFERENCES users(id), projectId INT NOT NULL REFERENCES projects(id), assignedTo INT NULL REFERENCES users(id),
  deadline DATETIMEOFFSET NULL, receivedDate DATETIMEOFFSET NULL, customFields NVARCHAR(MAX) NULL,
  status NVARCHAR(30) NULL, instructions NVARCHAR(MAX) NULL, revisionReasons NVARCHAR(MAX) NULL,
  licenseApplication NVARCHAR(MAX) NULL, licenseApplicationNote NVARCHAR(1000) NULL,
  far NVARCHAR(MAX) NULL, farNote NVARCHAR(1000) NULL,
  tdrUtilization NVARCHAR(MAX) NULL, tdrUtilizationNote NVARCHAR(1000) NULL,
  productMix NVARCHAR(MAX) NULL, productMixNote NVARCHAR(1000) NULL,
  phasingStrategy NVARCHAR(MAX) NULL, phasingStrategyNote NVARCHAR(1000) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Land fields also carry CAD and PDF attachments (XCADNote, XPDFNote)
CREATE TABLE lands (
  id INT IDENTITY(1,1) PRIMARY KEY,
  userId INT NULL REFERENCES users(id), projectId INT NOT NULL REFERENCES projects(id), assignedTo INT NULL REFERENCES users(id),
  deadline DATETIMEOFFSET NULL, receivedDate DATETIMEOFFSET NULL, customFields NVARCHAR(MAX) NULL,
  status NVARCHAR(30) NULL, instructions NVARCHAR(MAX) NULL, revisionReasons NVARCHAR(MAX) NULL,
  certifiedLandBoundaryForTestFitPlanning NVARCHAR(MAX) NULL, certifiedLandBoundaryForTestFitPlanningNote NVARCHAR(1000) NULL, certifiedLandBoundaryForTestFitPlanningCADNote NVARCHAR(1000) NULL, certifiedLandBoundaryForTestFitPlanningPDFNote NVARCHAR(1000) NULL,
  finalLandBoundary NVARCHAR(MAX) NULL, finalLandBoundaryNote NVARCHAR(1000) NULL, finalLandBoundaryCADNote NVARCHAR(1000) NULL, finalLandBoundaryPDFNote NVARCHAR(1000) NULL,
  finalPlotBoundary NVARCHAR(MAX) NULL, finalPlotBoundaryNote NVARCHAR(1000) NULL, finalPlotBoundaryCADNote NVARCHAR(1000) NULL, finalPlotBoundaryPDFNote NVARCHAR(1000) NULL,
  htLinesOnSite NVARCHAR(MAX) NULL, htLinesOnSiteNote NVARCHAR(1000) NULL, htLinesOnSiteCADNote NVARCHAR(1000) NULL, htLinesOnSitePDFNote NVARCHAR(1000) NULL,
  proximityStudyOfBuildingStructure NVARCHAR(MAX) NULL, proximityStudyOfBuildingStructureNote NVARCHAR(1000) NULL, proximityStudyOfBuildingStructureCADNote NVARCHAR(1000) NULL, proximityStudyOfBuildingStructurePDFNote NVARCHAR(1000) NULL,
  anyMismatchInSiteBoundaries NVARCHAR(MAX) NULL, anyMismatchInSiteBoundariesNote NVARCHAR(1000) NULL, anyMismatchInSiteBoundariesCADNote NVARCHAR(1000) NULL, anyMismatchInSiteBoundariesPDFNote NVARCHAR(1000) NULL,
  topographicalSurvey NVARCHAR(MAX) NULL, topographicalSurveyNote NVARCHAR(1000) NULL, topographicalSurveyCADNote NVARCHAR(1000) NULL, topographicalSurveyPDFNote NVARCHAR(1000) NULL,
  otherConstraints NVARCHAR(MAX) NULL, otherConstraintsNote NVARCHAR(1000) NULL, otherConstraintsCADNote NVARCHAR(1000) NULL, otherConstraintsPDFNote NVARCHAR(1000) NULL,
  encroachments NVARCHAR(10) NULL, encroachmentsNote NVARCHAR(1000) NULL, encroachmentsCADNote NVARCHAR(1000) NULL, encroachmentsPDFNote NVARCHAR(1000) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE structures (
  id INT IDENTITY(1,1) PRIMARY KEY,
  userId INT NULL REFERENCES users(id), projectId INT NOT NULL REFERENCES projects(id), assignedTo INT NULL REFERENCES users(id),
  deadline DATETIMEOFFSET NULL, receivedDate DATETIMEOFFSET NULL, customFields NVARCHAR(MAX) NULL,
  status NVARCHAR(30) NULL, instructions NVARCHAR(MAX) NULL, revisionReasons NVARCHAR(MAX) NULL,
  preferredStructuralSystem NVARCHAR(MAX) NULL, preferredStructuralSystemNote NVARCHAR(1000) NULL,
  groundwaterTableLevel NVARCHAR(MAX) NULL, groundwaterTableLevelNote NVARCHAR(1000) NULL,
  recommendedPlinthLevelAboveRoad NVARCHAR(MAX) NULL, recommendedPlinthLevelAboveRoadNote NVARCHAR(1000) NULL,
  soilBearingCapacity NVARCHAR(MAX) NULL, soilBearingCapacityNote NVARCHAR(1000) NULL,
  foundationLevelSoil NVARCHAR(MAX) NULL, foundationLevelSoilNote NVARCHAR(1000) NULL,
  typeOfFoundationSoil NVARCHAR(MAX) NULL, typeOfFoundationSoilNote NVARCHAR(1000) NULL,
  floodAnalysisReport NVARCHAR(MAX) NULL, floodAnalysisReportNote NVARCHAR(1000) NULL,
  foundationLevelFlood NVARCHAR(MAX) NULL, foundationLevelFloodNote NVARCHAR(1000) NULL,
  typeOfFoundationFlood NVARCHAR(MAX) NULL, typeOfFoundationFloodNote NVARCHAR(1000) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE meps (
  id INT IDENTITY(1,1) PRIMARY KEY,
  userId INT NULL REFERENCES users(id), projectId INT NOT NULL REFERENCES projects(id), assignedTo INT NULL REFERENCES users(id),
  deadline DATETIMEOFFSET NULL, receivedDate DATETIMEOFFSET NULL, customFields NVARCHAR(MAX) NULL,
  status NVARCHAR(30) NULL, instructions NVARCHAR(MAX) NULL, revisionReasons NVARCHAR(MAX) NULL,
  oduLocationsAndSizes NVARCHAR(MAX) NULL, oduLocationsAndSizesNote NVARCHAR(1000) NULL,
  floodAnalysisReport NVARCHAR(MAX) NULL, floodAnalysisReportNote NVARCHAR(1000) NULL,
  passengerLiftsNo NVARCHAR(50) NULL, passengerLiftsNoNote NVARCHAR(1000) NULL,
  passengerLiftsStops NVARCHAR(50) NULL, passengerLiftsStopsNote NVARCHAR(1000) NULL,
  passengerLiftsSpeed NVARCHAR(50) NULL, passengerLiftsSpeedNote NVARCHAR(1000) NULL,
  passengerLiftsPerTower NVARCHAR(50) NULL, passengerLiftsPerTowerNote NVARCHAR(1000) NULL,
  passengerAverageWait NVARCHAR(50) NULL, passengerAverageWaitNote NVARCHAR(1000) NULL,
  passengerLiftSizeLength NVARCHAR(50) NULL, passengerLiftSizeLengthNote NVARCHAR(1000) NULL,
  passengerLiftSizeWidth NVARCHAR(50) NULL, passengerLiftSizeWidthNote NVARCHAR(1000) NULL,
  serviceLiftsNo NVARCHAR(50) NULL, serviceLiftsNoNote NVARCHAR(1000) NULL,
  serviceLiftsStops NVARCHAR(50) NULL, serviceLiftsStopsNote NVARCHAR(1000) NULL,
  serviceLiftsSpeed NVARCHAR(50) NULL, serviceLiftsSpeedNote NVARCHAR(1000) NULL,
  serviceLiftsPerTower NVARCHAR(50) NULL, serviceLiftsPerTowerNote NVARCHAR(1000) NULL,
  serviceAverageWait NVARCHAR(50) NULL, serviceAverageWaitNote NVARCHAR(1000) NULL,
  serviceLiftSizeLength NVARCHAR(50) NULL, serviceLiftSizeLengthNote NVARCHAR(1000) NULL,
  serviceLiftSizeWidth NVARCHAR(50) NULL, serviceLiftSizeWidthNote NVARCHAR(1000) NULL,
  acProvisionUnits NVARCHAR(255) NULL, acProvisionUnitsNote NVARCHAR(1000) NULL,
  acAreaApartment NVARCHAR(50) NULL, acAreaApartmentNote NVARCHAR(1000) NULL,
  tonnageApartment NVARCHAR(50) NULL, tonnageApartmentNote NVARCHAR(1000) NULL,
  costPerTonneApartment NVARCHAR(50) NULL, costPerTonneApartmentNote NVARCHAR(1000) NULL,
  acAreaClub NVARCHAR(50) NULL, acAreaClubNote NVARCHAR(1000) NULL,
  tonnageClub NVARCHAR(50) NULL, tonnageClubNote NVARCHAR(1000) NULL,
  efficiencyApartment NVARCHAR(50) NULL, efficiencyApartmentNote NVARCHAR(1000) NULL,
  efficiencyClub NVARCHAR(50) NULL, efficiencyClubNote NVARCHAR(1000) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_liaisons_project ON liaisons(projectId);
CREATE INDEX ix_bd_project       ON business_developments(projectId);
CREATE INDEX ix_lands_project    ON lands(projectId);
CREATE INDEX ix_structures_proj  ON structures(projectId);
CREATE INDEX ix_meps_project     ON meps(projectId);

/* ---------------------------------------------------------------- design chapters (one JSON document per project) */
CREATE TABLE design_brief_summaries (
  id        INT IDENTITY(1,1) PRIMARY KEY,
  projectId INT           NOT NULL CONSTRAINT uq_dbs_project UNIQUE REFERENCES projects(id),
  data      NVARCHAR(MAX) NULL CONSTRAINT ck_dbs_json CHECK (data IS NULL OR ISJSON(data) = 1),
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE design_brief_comments (
  id         INT IDENTITY(1,1) PRIMARY KEY,
  projectId  INT           NOT NULL REFERENCES projects(id),
  department NVARCHAR(50)  NOT NULL,
  comment    NVARCHAR(MAX) NOT NULL,
  status     NVARCHAR(50)  NULL,
  userId     INT           NULL REFERENCES users(id),
  createdAt  DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt  DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE dropdown_options (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  fieldKey    NVARCHAR(100) NOT NULL,
  optionValue NVARCHAR(255) NOT NULL,
  userId      INT           NULL REFERENCES users(id),
  createdAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT uq_dropdown UNIQUE (fieldKey, optionValue)
);

/* ---------------------------------------------------------------- platform */
CREATE TABLE notifications (
  id        INT IDENTITY(1,1) PRIMARY KEY,
  userId    INT           NOT NULL REFERENCES users(id),
  type      NVARCHAR(100) NULL,
  message   NVARCHAR(MAX) NULL,
  isRead    BIT           NOT NULL DEFAULT 0,
  metadata  NVARCHAR(MAX) NULL,
  createdAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_notifications_user ON notifications(userId, isRead, createdAt DESC);

CREATE TABLE audit_logs (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  userId      INT           NULL REFERENCES users(id),
  taskType    NVARCHAR(100) NOT NULL,
  description NVARCHAR(MAX) NULL,
  projectId   INT           NULL,
  createdAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt   DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_audit_created ON audit_logs(createdAt DESC);

CREATE TABLE uploads (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  userId       INT            NULL REFERENCES users(id),
  originalName NVARCHAR(500)  NULL,
  storedName   NVARCHAR(500)  NULL,
  mimeType     NVARCHAR(100)  NULL,
  size         INT            NULL,
  url          NVARCHAR(1000) NULL,
  createdAt    DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updatedAt    DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
GO

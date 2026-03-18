-- ============================================================
-- inmo. — MySQL 8.0 Schema para backend Java/Spark
-- Uso: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS inmoscout
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inmoscout;

-- ── CIUDADES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciudades (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(100) NOT NULL,
  provincia VARCHAR(100) NOT NULL,
  pais     CHAR(2) NOT NULL DEFAULT 'ES'
);

-- ── BARRIOS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barrios (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  ciudad_id  INT UNSIGNED NOT NULL,
  FOREIGN KEY (ciudad_id) REFERENCES ciudades(id)
);

-- ── PROPIEDADES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS propiedades (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo                VARCHAR(300) NOT NULL,
  descripcion           TEXT,
  operacion             ENUM('venta','alquiler','nueva') NOT NULL,
  tipo                  ENUM('piso','casa','atico','estudio','local','garaje') NOT NULL,
  estado                ENUM('activo','pausado','vendido','alquilado','eliminado') NOT NULL DEFAULT 'activo',

  -- Precio
  precio                DECIMAL(12,2) NOT NULL,
  precio_por_m2         DECIMAL(10,2) GENERATED ALWAYS AS (precio / NULLIF(area_total_m2, 0)) STORED,

  -- Ubicación
  direccion             VARCHAR(400),
  codigo_postal         VARCHAR(10),
  latitud               DECIMAL(10,7),
  longitud              DECIMAL(10,7),
  ciudad_id             INT UNSIGNED NOT NULL,
  barrio_id             INT UNSIGNED,

  -- Características
  area_total_m2         DECIMAL(8,2),
  area_util_m2          DECIMAL(8,2),
  habitaciones          TINYINT UNSIGNED,
  banos                 TINYINT UNSIGNED,
  planta                TINYINT,
  total_plantas         TINYINT UNSIGNED,
  ano_construccion      SMALLINT UNSIGNED,
  certificado_energetico ENUM('A','B','C','D','E','F','G','pendiente') DEFAULT 'pendiente',

  -- Extras (boolean)
  tiene_ascensor        BOOLEAN DEFAULT FALSE,
  tiene_garaje          BOOLEAN DEFAULT FALSE,
  tiene_trastero        BOOLEAN DEFAULT FALSE,
  tiene_terraza         BOOLEAN DEFAULT FALSE,
  tiene_jardin          BOOLEAN DEFAULT FALSE,
  tiene_piscina         BOOLEAN DEFAULT FALSE,
  tiene_ac              BOOLEAN DEFAULT FALSE,
  tiene_calefaccion     BOOLEAN DEFAULT FALSE,
  amueblado             BOOLEAN DEFAULT FALSE,
  admite_mascotas       BOOLEAN DEFAULT FALSE,

  -- Meta
  vistas                INT UNSIGNED NOT NULL DEFAULT 0,
  destacado             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (ciudad_id) REFERENCES ciudades(id),
  FOREIGN KEY (barrio_id) REFERENCES barrios(id),

  INDEX idx_operacion  (operacion),
  INDEX idx_tipo       (tipo),
  INDEX idx_estado     (estado),
  INDEX idx_precio     (precio),
  INDEX idx_ciudad     (ciudad_id),
  INDEX idx_destacado  (destacado),
  FULLTEXT idx_busqueda (titulo, descripcion, direccion)
);

-- ── CONSULTAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultas (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  propiedad_id  INT UNSIGNED,
  nombre        VARCHAR(120),
  email         VARCHAR(255) NOT NULL,
  telefono      VARCHAR(30),
  mensaje       TEXT NOT NULL,
  estado        ENUM('nueva','leida','respondida') NOT NULL DEFAULT 'nueva',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (propiedad_id) REFERENCES propiedades(id) ON DELETE SET NULL
);

-- ── VALORACIONES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS valoraciones (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ciudad        VARCHAR(100) NOT NULL,
  tipo          VARCHAR(50),
  metros        DECIMAL(8,2) NOT NULL,
  estimado_min  DECIMAL(12,2),
  estimado_max  DECIMAL(12,2),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ciudades (nombre, provincia) VALUES
  ('Barcelona','Barcelona'), ('Madrid','Madrid'), ('Valencia','Valencia'),
  ('Sevilla','Sevilla'), ('Málaga','Málaga');

INSERT INTO barrios (nombre, ciudad_id) VALUES
  ('Eixample',1),('Gràcia',1),('Sarrià',1),('Pedralbes',1),
  ('Poble Sec',1),('Sant Gervasi',1),
  ('Salamanca',2),('Malasaña',2),('Lavapiés',2),('Ruzafa',3),
  ('Málaga Este',5);

INSERT INTO propiedades
  (titulo, descripcion, operacion, tipo, precio, direccion, codigo_postal,
   latitud, longitud, ciudad_id, barrio_id,
   area_total_m2, area_util_m2, habitaciones, banos, planta, total_plantas,
   ano_construccion, certificado_energetico,
   tiene_ascensor, tiene_garaje, tiene_terraza, tiene_ac, tiene_calefaccion, tiene_piscina,
   destacado, estado)
VALUES
  ('Piso luminoso en el Eixample',
   'Espectacular piso reformado con materiales de alta calidad. Amplias habitaciones, cocina equipada y mucha luz natural.',
   'venta','piso',485000,'Carrer de Provença 123','08036',41.3946,2.1605,1,1,
   142,128,4,2,3,7,1998,'C',TRUE,FALSE,FALSE,TRUE,TRUE,FALSE,TRUE,'activo'),

  ('Piso moderno en alquiler – Sarrià',
   'Piso completamente reformado en una de las zonas más tranquilas de Barcelona.',
   'alquiler','piso',2100,'Carrer Major de Sarrià 45','08017',41.4044,2.1221,1,3,
   115,102,3,2,1,5,2005,'B',TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,FALSE,'activo'),

  ('Apartamento obra nueva en Gràcia',
   'Apartamento en edificio de nueva construcción. Certificación energética A.',
   'nueva','piso',325000,'Carrer de Verdi 78','08012',41.4036,2.1589,1,2,
   78,70,2,1,4,6,2024,'A',TRUE,FALSE,FALSE,TRUE,TRUE,FALSE,TRUE,'activo'),

  ('Casa con jardín en Pedralbes',
   'Impresionante casa unifamiliar con jardín privado y piscina.',
   'venta','casa',890000,'Avinguda de Pedralbes 22','08034',41.3887,2.1113,1,4,
   280,240,5,3,0,2,1985,'D',FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,'activo'),

  ('Estudio en alquiler – Poble Sec',
   'Coqueto estudio totalmente amueblado con buenas comunicaciones.',
   'alquiler','estudio',1450,'Carrer del Parlament 12','08015',41.3734,2.1600,1,5,
   65,58,2,1,5,6,2001,'E',TRUE,FALSE,FALSE,TRUE,FALSE,FALSE,FALSE,'activo'),

  ('Ático con terraza en Sant Gervasi',
   'Espectacular ático con gran terraza de 80m² y vistas panorámicas.',
   'nueva','atico',620000,'Carrer de Muntaner 210','08021',41.3997,2.1442,1,6,
   195,145,4,3,8,8,2023,'A',TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,TRUE,'activo'),

  ('Piso en el barrio de Salamanca',
   'Amplio piso completamente reformado con materiales premium.',
   'venta','piso',750000,'Calle de Serrano 88','28006',40.4254,-3.6882,2,7,
   165,148,5,3,4,7,1970,'C',TRUE,TRUE,FALSE,TRUE,TRUE,FALSE,FALSE,'activo'),

  ('Piso acogedor en Malasaña',
   'Encantador piso reformado en el bohemio barrio de Malasaña.',
   'alquiler','piso',1800,'Calle del Pez 5','28004',40.4226,-3.7054,2,8,
   72,65,2,1,3,5,1960,'F',FALSE,FALSE,FALSE,FALSE,TRUE,FALSE,FALSE,'activo'),

  ('Apartamento con vistas en Ruzafa, Valencia',
   'Moderno apartamento en el animado barrio de Ruzafa.',
   'venta','piso',285000,'Carrer de Sueca 34','46006',39.4617,-0.3752,3,10,
   88,80,3,2,2,5,2010,'B',TRUE,FALSE,TRUE,TRUE,TRUE,FALSE,FALSE,'activo'),

  ('Chalet adosado en Málaga Este',
   'Chalet adosado con jardín comunitario y piscina. Urbanización privada con seguridad 24h.',
   'venta','casa',420000,'Calle Lirio 8','29018',36.7213,-4.3890,5,11,
   160,145,4,3,0,2,2015,'A',FALSE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,'activo');

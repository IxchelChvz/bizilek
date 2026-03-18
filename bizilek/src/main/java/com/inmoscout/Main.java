package com.inmoscout;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import spark.Request;
import spark.Response;

import java.sql.*;
import java.util.*;

import static spark.Spark.*;

/**
 * inmo. — Portal Inmobiliario
 * Backend: Java 17 + Spark Framework + MySQL JDBC
 *
 * Arrancar:
 *   mvn package
 *   java -jar target/inmo-portal.jar
 *
 * Variables de entorno opcionales:
 *   DB_HOST     (default: localhost)
 *   DB_PORT     (default: 3306)
 *   DB_NAME     (default: inmoscout)
 *   DB_USER     (default: root)
 *   DB_PASSWORD (default: "")
 *   PORT        (default: 4567)
 */
public class Main {

    // ── Configuración ─────────────────────────────────────────
    private static final int    SERVER_PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "4567"));
    private static final String DB_HOST     = System.getenv().getOrDefault("DB_HOST",     "localhost");
    private static final String DB_PORT     = System.getenv().getOrDefault("DB_PORT",     "3306");
    private static final String DB_NAME     = System.getenv().getOrDefault("DB_NAME",     "inmoscout");
    private static final String DB_USER     = System.getenv().getOrDefault("DB_USER",     "root");
    private static final String DB_PASSWORD = System.getenv().getOrDefault("DB_PASSWORD", "Miraclep2002_");
    private static final String JDBC_URL    = String.format(
            "jdbc:mysql://%s:%s/%s?useSSL=false&serverTimezone=UTC&characterEncoding=UTF-8",
            DB_HOST, DB_PORT, DB_NAME);

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    // ── Modelo Propiedad ──────────────────────────────────────
    record Propiedad(
            long   id,
            String titulo,
            String operacion,   // "venta" | "alquiler" | "nueva"
            String tipo,        // "piso" | "casa" | "atico" | "estudio"
            double precio,
            String direccion,
            String ciudad,
            String barrio,
            Double areaTotalM2,
            Integer habitaciones,
            Integer banos,
            Integer planta,
            String  certificadoEnergetico,
            boolean tieneAscensor,
            boolean tieneGaraje,
            boolean tieneTeraza,
            boolean destacado,
            int     vistas
    ) {}

    // ── Respuesta paginada ────────────────────────────────────
    record RespuestaPaginada(
            List<Propiedad> datos,
            int total,
            int pagina,
            int limite,
            int paginas
    ) {}

    // ── Respuesta de error ────────────────────────────────────
    record ErrorResponse(String error, String detalle) {}

    // ── Estadísticas ──────────────────────────────────────────
    record Estadisticas(
            long totalPropiedades,
            long enVenta,
            long enAlquiler,
            long obraNueva,
            double precioMedioVenta
    ) {}

    // ── Valoración ────────────────────────────────────────────
    record SolicitudValoracion(String ciudad, String tipo, double metrosCuadrados) {}
    record ResultadoValoracion(double estimadoMin, double estimadoMax, double precioPorMetro) {}

    // ── Consulta ─────────────────────────────────────────────
    record SolicitudConsulta(long propiedadId, String nombre, String email, String telefono, String mensaje) {}

    // ═══════════════════════════════════════════════════════════
    //  MAIN
    // ═══════════════════════════════════════════════════════════
    public static void main(String[] args) {

        // Puerto
        port(SERVER_PORT);

        // Archivos estáticos — carpeta public/ dentro del JAR
        staticFiles.location("/public");

        // Archivos estáticos externos (desarrollo) — comenta si usas JAR
        // staticFiles.externalLocation("src/main/resources/public");

        // ── CORS ─────────────────────────────────────────────
        before((req, res) -> {
            res.header("Access-Control-Allow-Origin",  "*");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        });
        options("/*", (req, res) -> { res.status(200); return "OK"; });

        // Content-Type por defecto para la API
        before("/api/*", (req, res) -> res.type("application/json;charset=UTF-8"));

        // ── Health check ─────────────────────────────────────
        get("/api/health", (req, res) -> {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("ok",  true);
            r.put("ts",  new java.util.Date().toString());
            r.put("db",  testDbConnection() ? "conectada" : "no disponible");
            return GSON.toJson(r);
        });

        // ── GET /api/propiedades ──────────────────────────────
        get("/api/propiedades", Main::getPropiedades);

        // ── GET /api/propiedades/:id ──────────────────────────
        get("/api/propiedades/:id", Main::getPropiedad);

        // ── GET /api/estadisticas ─────────────────────────────
        get("/api/estadisticas", Main::getEstadisticas);

        // ── GET /api/ciudades ─────────────────────────────────
        get("/api/ciudades", Main::getCiudades);

        // ── POST /api/valoracion ──────────────────────────────
        post("/api/valoracion", Main::calcularValoracion);

        // ── POST /api/consultas ───────────────────────────────
        post("/api/consultas", Main::enviarConsulta);

        // ── 404 para /api/* ───────────────────────────────────
        notFound((req, res) -> {
            res.type("application/json");
            return GSON.toJson(new ErrorResponse("No encontrado", req.uri()));
        });

        // ── Error handler ─────────────────────────────────────
        exception(Exception.class, (e, req, res) -> {
            res.status(500);
            res.type("application/json;charset=UTF-8");
            res.body(GSON.toJson(new ErrorResponse("Error interno", e.getMessage())));
        });

        System.out.println("🚀  inmo. API arrancada en http://localhost:" + SERVER_PORT);
        System.out.println("    Frontend:  http://localhost:" + SERVER_PORT);
        System.out.println("    API base:  http://localhost:" + SERVER_PORT + "/api");
    }

    // ═══════════════════════════════════════════════════════════
    //  HANDLERS
    // ═══════════════════════════════════════════════════════════

    /** GET /api/propiedades?operacion=&tipo=&ciudad=&precioMin=&precioMax=&hab=&pagina=1&limite=9&orden= */
    private static Object getPropiedades(Request req, Response res) {
        String operacion = req.queryParamOrDefault("operacion", "");
        String tipo      = req.queryParamOrDefault("tipo",      "");
        String ciudad    = req.queryParamOrDefault("ciudad",    "");
        String q         = req.queryParamOrDefault("q",         "");
        double precioMin = parseDouble(req.queryParamOrDefault("precioMin", "0"));
        double precioMax = parseDouble(req.queryParamOrDefault("precioMax", "99999999"));
        int    minHab    = parseInt(req.queryParamOrDefault("hab",   "0"));
        int    pagina    = Math.max(1, parseInt(req.queryParamOrDefault("pagina",  "1")));
        int    limite    = Math.min(24, parseInt(req.queryParamOrDefault("limite", "9")));
        String orden     = req.queryParamOrDefault("orden", "created_at DESC");
        boolean soloDestacados = "true".equals(req.queryParamOrDefault("destacados", "false"));

        // Orden seguro (whitelist)
        String orderClause = switch (orden) {
            case "precio_asc"   -> "p.precio ASC";
            case "precio_desc"  -> "p.precio DESC";
            case "area_desc"    -> "p.area_total_m2 DESC";
            case "vistas_desc"  -> "p.vistas DESC";
            default             -> "p.destacado DESC, p.created_at DESC";
        };

        List<String> conds  = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        conds.add("p.estado = 'activo'");

        if (!operacion.isEmpty()) { conds.add("p.operacion = ?");      params.add(operacion); }
        if (!tipo.isEmpty())      { conds.add("p.tipo = ?");           params.add(tipo); }
        if (!ciudad.isEmpty())    { conds.add("c.nombre LIKE ?");      params.add("%" + ciudad + "%"); }
        if (!q.isEmpty())         { conds.add("(p.titulo LIKE ? OR p.direccion LIKE ? OR c.nombre LIKE ?)");
                                    params.add("%" + q + "%"); params.add("%" + q + "%"); params.add("%" + q + "%"); }
        if (precioMin > 0)        { conds.add("p.precio >= ?");        params.add(precioMin); }
        if (precioMax < 99999999) { conds.add("p.precio <= ?");        params.add(precioMax); }
        if (minHab > 0)           { conds.add("p.habitaciones >= ?");  params.add(minHab); }
        if (soloDestacados)       { conds.add("p.destacado = TRUE"); }

        String where = "WHERE " + String.join(" AND ", conds);
        int offset   = (pagina - 1) * limite;

        try (Connection conn = getConnection()) {
            // Count total
            String countSql = """
                SELECT COUNT(*) FROM propiedades p
                LEFT JOIN ciudades c ON p.ciudad_id = c.id
                """ + where;

            int total;
            try (PreparedStatement ps = conn.prepareStatement(countSql)) {
                setParams(ps, params);
                ResultSet rs = ps.executeQuery();
                rs.next();
                total = rs.getInt(1);
            }

            // Fetch page
            String sql = """
                SELECT p.*, c.nombre AS ciudad_nombre, b.nombre AS barrio_nombre
                FROM propiedades p
                LEFT JOIN ciudades   c ON p.ciudad_id  = c.id
                LEFT JOIN barrios    b ON p.barrio_id  = b.id
                """ + where + " ORDER BY " + orderClause + " LIMIT ? OFFSET ?";

            List<Propiedad> lista = new ArrayList<>();
            List<Object> fullParams = new ArrayList<>(params);
            fullParams.add(limite);
            fullParams.add(offset);

            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                setParams(ps, fullParams);
                ResultSet rs = ps.executeQuery();
                while (rs.next()) lista.add(mapPropiedad(rs));
            }

            return GSON.toJson(new RespuestaPaginada(
                    lista, total, pagina, limite,
                    (int) Math.ceil((double) total / limite)
            ));

        } catch (SQLException e) {
            // Fallback a datos simulados si la BD no está disponible
            System.err.println("⚠️  BD no disponible, usando datos simulados: " + e.getMessage());
            return GSON.toJson(new RespuestaPaginada(getDatosMock(), 10, 1, 9, 2));
        }
    }

    /** GET /api/propiedades/:id */
    private static Object getPropiedad(Request req, Response res) {
        long id;
        try { id = Long.parseLong(req.params("id")); }
        catch (NumberFormatException e) { res.status(400); return GSON.toJson(new ErrorResponse("ID inválido", "")); }

        try (Connection conn = getConnection()) {
            String sql = """
                SELECT p.*, c.nombre AS ciudad_nombre, b.nombre AS barrio_nombre
                FROM propiedades p
                LEFT JOIN ciudades c ON p.ciudad_id = c.id
                LEFT JOIN barrios  b ON p.barrio_id = b.id
                WHERE p.id = ? AND p.estado = 'activo'
                """;
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, id);
                ResultSet rs = ps.executeQuery();
                if (!rs.next()) {
                    res.status(404);
                    return GSON.toJson(new ErrorResponse("No encontrado", "Propiedad con id=" + id));
                }
                // Incrementar visitas
                conn.prepareStatement("UPDATE propiedades SET vistas = vistas + 1 WHERE id = " + id).executeUpdate();
                return GSON.toJson(mapPropiedad(rs));
            }
        } catch (SQLException e) {
            res.status(500);
            return GSON.toJson(new ErrorResponse("Error de BD", e.getMessage()));
        }
    }

    /** GET /api/estadisticas */
    private static Object getEstadisticas(Request req, Response res) {
        try (Connection conn = getConnection()) {
            long total    = queryLong(conn, "SELECT COUNT(*) FROM propiedades WHERE estado='activo'");
            long enVenta  = queryLong(conn, "SELECT COUNT(*) FROM propiedades WHERE estado='activo' AND operacion='venta'");
            long alquiler = queryLong(conn, "SELECT COUNT(*) FROM propiedades WHERE estado='activo' AND operacion='alquiler'");
            long nueva    = queryLong(conn, "SELECT COUNT(*) FROM propiedades WHERE estado='activo' AND operacion='nueva'");
            double avg    = queryDouble(conn, "SELECT ROUND(AVG(precio)) FROM propiedades WHERE estado='activo' AND operacion='venta'");
            return GSON.toJson(new Estadisticas(total, enVenta, alquiler, nueva, avg));
        } catch (SQLException e) {
            // Fallback simulado
            return GSON.toJson(new Estadisticas(182000, 95000, 65000, 22000, 487000));
        }
    }

    /** GET /api/ciudades */
    private static Object getCiudades(Request req, Response res) {
        try (Connection conn = getConnection()) {
            List<Map<String, Object>> lista = new ArrayList<>();
            ResultSet rs = conn.createStatement().executeQuery("SELECT id, nombre, provincia FROM ciudades ORDER BY nombre");
            while (rs.next()) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id",       rs.getLong("id"));
                c.put("nombre",   rs.getString("nombre"));
                c.put("provincia",rs.getString("provincia"));
                lista.add(c);
            }
            return GSON.toJson(lista);
        } catch (SQLException e) {
            // Fallback
            return GSON.toJson(List.of(
                Map.of("id",1,"nombre","Barcelona","provincia","Barcelona"),
                Map.of("id",2,"nombre","Madrid","provincia","Madrid"),
                Map.of("id",3,"nombre","Valencia","provincia","Valencia"),
                Map.of("id",4,"nombre","Sevilla","provincia","Sevilla"),
                Map.of("id",5,"nombre","Málaga","provincia","Málaga")
            ));
        }
    }

    /** POST /api/valoracion  body: { ciudad, tipo, metrosCuadrados } */
    private static Object calcularValoracion(Request req, Response res) {
        SolicitudValoracion sol = GSON.fromJson(req.body(), SolicitudValoracion.class);
        if (sol == null || sol.ciudad() == null || sol.metrosCuadrados() <= 0) {
            res.status(400);
            return GSON.toJson(new ErrorResponse("Datos incompletos", "ciudad, tipo y metrosCuadrados son obligatorios"));
        }

        // Precio base por ciudad (€/m²)
        double base = switch (sol.ciudad().toLowerCase()) {
            case "barcelona" -> 4800;
            case "madrid"    -> 4200;
            case "valencia"  -> 2800;
            case "sevilla"   -> 2400;
            case "málaga","malaga" -> 3000;
            default          -> 3000;
        };

        double mul = switch (sol.tipo() != null ? sol.tipo().toLowerCase() : "") {
            case "atico","ático","penthouse" -> 1.35;
            case "casa","house"              -> 1.15;
            case "estudio","studio"          -> 0.85;
            default                          -> 1.0;
        };

        double ppm = base * mul;
        double est = ppm * sol.metrosCuadrados();

        // Guardar valoración en BD si está disponible
        try (Connection conn = getConnection()) {
            conn.prepareStatement(
                "INSERT IGNORE INTO valoraciones (ciudad, tipo, metros, estimado_min, estimado_max) VALUES (?,?,?,?,?)"
            ).execute(); // simplificado — en producción usar PreparedStatement con params
        } catch (SQLException ignored) {}

        return GSON.toJson(new ResultadoValoracion(
                Math.round(est * 0.9),
                Math.round(est * 1.1),
                Math.round(ppm)
        ));
    }

    /** POST /api/consultas  body: { propiedadId, nombre, email, telefono, mensaje } */
    private static Object enviarConsulta(Request req, Response res) {
        SolicitudConsulta sol = GSON.fromJson(req.body(), SolicitudConsulta.class);
        if (sol == null || sol.email() == null || sol.mensaje() == null) {
            res.status(400);
            return GSON.toJson(new ErrorResponse("Datos incompletos", "email y mensaje son obligatorios"));
        }

        try (Connection conn = getConnection()) {
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO consultas (propiedad_id, nombre, email, telefono, mensaje) VALUES (?,?,?,?,?)"
            );
            ps.setLong(1,   sol.propiedadId());
            ps.setString(2, sol.nombre());
            ps.setString(3, sol.email());
            ps.setString(4, sol.telefono());
            ps.setString(5, sol.mensaje());
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("⚠️  No se pudo guardar consulta: " + e.getMessage());
            // No falla — respondemos OK igualmente
        }

        res.status(201);
        return GSON.toJson(Map.of("ok", true, "mensaje", "Consulta recibida. Te contactaremos pronto."));
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS BD
    // ═══════════════════════════════════════════════════════════

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(JDBC_URL, DB_USER, DB_PASSWORD);
    }

    private static boolean testDbConnection() {
        try (Connection c = getConnection()) { return c.isValid(2); }
        catch (SQLException e) { return false; }
    }

    private static void setParams(PreparedStatement ps, List<Object> params) throws SQLException {
        for (int i = 0; i < params.size(); i++) {
            Object p = params.get(i);
            if (p instanceof String s)  ps.setString(i + 1, s);
            else if (p instanceof Integer n) ps.setInt(i + 1, n);
            else if (p instanceof Long n)    ps.setLong(i + 1, n);
            else if (p instanceof Double n)  ps.setDouble(i + 1, n);
            else ps.setObject(i + 1, p);
        }
    }

   private static Propiedad mapPropiedad(ResultSet rs) throws SQLException {
        return new Propiedad(
            rs.getLong("id"),
            rs.getString("titulo"),
            rs.getString("operacion"),
            rs.getString("tipo"),
            rs.getDouble("precio"),
            rs.getString("direccion"),
            rs.getString("ciudad_nombre"),
            rs.getString("barrio_nombre"),
            rs.getObject("area_total_m2") != null ? rs.getDouble("area_total_m2") : null,
            rs.getObject("habitaciones")  != null ? rs.getInt("habitaciones")   : null,
            rs.getObject("banos")         != null ? rs.getInt("banos")          : null,
            rs.getObject("planta")        != null ? rs.getInt("planta")         : null,
            rs.getString("certificado_energetico"),
            rs.getBoolean("tiene_ascensor"),
            rs.getBoolean("tiene_garaje"),
            rs.getBoolean("tiene_terraza"),
            rs.getBoolean("destacado"),
            rs.getInt("vistas")
        );
    }

    private static long queryLong(Connection c, String sql) throws SQLException {
        ResultSet rs = c.createStatement().executeQuery(sql);
        return rs.next() ? rs.getLong(1) : 0;
    }

    private static double queryDouble(Connection c, String sql) throws SQLException {
        ResultSet rs = c.createStatement().executeQuery(sql);
        return rs.next() ? rs.getDouble(1) : 0;
    }

    // ── Datos simulados (fallback sin BD) ────────────────────
    private static List<Propiedad> getDatosMock() {
        return List.of(
            new Propiedad(1,"Piso luminoso en el Eixample","venta","piso",485000,
                "Carrer de Provença 123","Barcelona","Eixample",142.0,4,2,3,"C",true,false,false,true,340),
            new Propiedad(2,"Piso moderno en alquiler","alquiler","piso",2100,
                "Carrer Major de Sarrià 45","Barcelona","Sarrià",115.0,3,2,1,"B",true,true,true,false,210),
            new Propiedad(3,"Apartamento obra nueva en Gràcia","nueva","piso",325000,
                "Carrer de Verdi 78","Barcelona","Gràcia",78.0,2,1,4,"A",true,false,false,true,180),
            new Propiedad(4,"Casa con jardín en Pedralbes","venta","casa",890000,
                "Avinguda de Pedralbes 22","Barcelona","Pedralbes",280.0,5,3,0,"D",false,true,true,true,520),
            new Propiedad(5,"Estudio en alquiler – Poble Sec","alquiler","estudio",1450,
                "Carrer del Parlament 12","Barcelona","Poble Sec",65.0,2,1,5,"E",true,false,false,false,95),
            new Propiedad(6,"Ático con terraza en Sant Gervasi","nueva","atico",620000,
                "Carrer de Muntaner 210","Barcelona","Sant Gervasi",195.0,4,3,8,"A",true,true,true,true,430),
            new Propiedad(7,"Piso en barrio de Salamanca","venta","piso",750000,
                "Calle de Serrano 88","Madrid","Salamanca",165.0,5,3,4,"C",true,true,false,false,280),
            new Propiedad(8,"Piso en Malasaña","alquiler","piso",1800,
                "Calle del Pez 5","Madrid","Malasaña",72.0,2,1,3,"F",false,false,false,false,150),
            new Propiedad(9,"Apartamento en Ruzafa, Valencia","venta","piso",285000,
                "Carrer de Sueca 34","Valencia","Ruzafa",88.0,3,2,2,"B",true,false,true,false,190),
            new Propiedad(10,"Chalet adosado en Málaga","venta","casa",420000,
                "Calle Lirio 8","Málaga","Málaga Este",160.0,4,3,0,"A",false,true,true,false,320)
        );
    }

    // ── Utils ─────────────────────────────────────────────────
    private static double parseDouble(String s) {
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return 0; }
    }
    private static int parseInt(String s) {
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return 0; }
    }
}

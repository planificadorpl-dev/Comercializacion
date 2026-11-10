/**
 * Normalization Rules and Dictionaries extracted and aligned with bot-whatssap
 * Handles canonical mappings for:
 * - Commercial Advisors (Calle / Campo)
 * - Box Office / Reception Agents (Taquilla / Ventas Admin) with physical offices
 * - Planning Analysts (Planificación / Agenda e Incidencias)
 * - External Promoters / Allies (Externos)
 * - Field Technicians and their paired squads (Equipos A through M)
 */

export type AdvisorType = "comercial" | "taquilla" | "planificacion" | "externo" | "otro";

export type StaffDepartment = "ventas" | "tecnico" | "otro";
export type MemberStatus = "fijo" | "ex" | "otro_departamento";

export interface AdvisorCustomConfig {
  type: AdvisorType;
  office?: string;
  isExCollaborator?: boolean;
  status?: MemberStatus;
  department?: StaffDepartment;
  notes?: string;
  updatedAt?: string;
}

export type AdvisorOverridesMap = Record<string, AdvisorCustomConfig>;

export interface TechnicianCustomConfig {
  team?: string;
  isExCollaborator?: boolean;
  status?: MemberStatus;
  department?: StaffDepartment;
  notes?: string;
  updatedAt?: string;
}

export type TechnicianOverridesMap = Record<string, TechnicianCustomConfig>;

export interface PersonnelConfigPayload {
  overrides: AdvisorOverridesMap;
  aliases: Record<string, string>;
  technicianOverrides?: TechnicianOverridesMap;
  technicianAliases?: Record<string, string>;
}

export const KNOWN_OFFICES = [
  "Valle",
  "Independencia",
  "Las Tejerías",
  "Propatria",
  "Colinas",
  "Alí Primera",
  "Call Center / Virtual",
  "Otros",
] as const;

export interface AdvisorMeta {
  name: string;
  type: AdvisorType;
  typeLabel: string;
  office?: string;
}

export const ADVISOR_TYPE_LABELS: Record<AdvisorType, string> = {
  comercial: "Asesor de Ventas",
  taquilla: "Taquilla / Sede",
  planificacion: "Planificación",
  externo: "Externo / Promotor",
  otro: "Otro",
};

export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export const ADVISOR_CANONICAL: Record<string, string> = {
  // Yesenia Terán
  "yesenia teran": "Yesenia Terán",
  "yesenia terán": "Yesenia Terán",
  "yessenia teran": "Yesenia Terán",
  "yessenia terán": "Yesenia Terán",
  "yesica teran": "Yesenia Terán",

  // Bárbara Márquez
  "barbara marquez": "Bárbara Márquez",
  "barbara márquez": "Bárbara Márquez",
  "bárbara márquez": "Bárbara Márquez",

  // Héctor Mendoza (Taquilla Valle)
  "hector mendoza": "Héctor Mendoza",
  "héctor mendoza": "Héctor Mendoza",

  // Sebastián Rodríguez
  "sebastian rodriguez": "Sebastián Rodríguez",
  "sebastián rodriguez": "Sebastián Rodríguez",
  "sebastián rodríguez": "Sebastián Rodríguez",

  // Yuleisy Campomas (Taquilla Tejerías)
  "yuleisy campomas": "Yuleisy Campomas",
  "yuleisy capomas": "Yuleisy Campomas",
  "yuleisy campmas": "Yuleisy Campomas",
  "yuleisy": "Yuleisy Campomas",

  // Alejandro Sánchez (Taquilla Independencia)
  "alejandro sanchez": "Alejandro Sánchez",
  "alejandro sánchez": "Alejandro Sánchez",

  // Génesis Ochoa
  "genesis ochoa": "Génesis Ochoa",
  "génesis ochoa": "Génesis Ochoa",

  // Yeilis Puentes (variantes: Yeylis Puente, Yeilis Puente, Yeylis Puentes)
  "yeilis puentes": "Yeilis Puentes",
  "yeilis puente": "Yeilis Puentes",
  "yeylis puentes": "Yeilis Puentes",
  "yeylis puente": "Yeilis Puentes",
  "yeilis": "Yeilis Puentes",
  "yeylis": "Yeilis Puentes",

  // Branin Berroteran (variantes: Brainin Berrotera, Brainin Berroteran, Branin Berroteran)
  "branin enrique berroteran": "Branin Berroteran",
  "branin enrique berro terán": "Branin Berroteran",
  "branin enrique": "Branin Berroteran",
  "branin berroteran": "Branin Berroteran",
  "branin berroterán": "Branin Berroteran",
  "brainin berrotera": "Branin Berroteran",
  "brainin berroteran": "Branin Berroteran",
  "brainin berroterán": "Branin Berroteran",
  "brainin": "Branin Berroteran",
  "branin": "Branin Berroteran",

  // Lorena Esqueda
  "lorena": "Lorena Esqueda",
  "lorena esqueda": "Lorena Esqueda",
  "lotena": "Lorena Esqueda",

  // Cindy Infante
  "cindy infante": "Cindy Infante",
  "cindy": "Cindy Infante",

  // Diarnelis Mendoza (variante con typo en solicitudes: Dianelis Mendoza)
  "diarnelis mendoza": "Diarnelis Mendoza",
  "dianelis mendoza": "Diarnelis Mendoza",
  "diarnelis": "Diarnelis Mendoza",
  "dianelis": "Diarnelis Mendoza",

  // Stephanie Contreras (variante solo nombre en solicitudes: Stephanie)
  "stephanie contreras": "Stephanie Contreras",
  "stephanie": "Stephanie Contreras",
  "stephany contreras": "Stephanie Contreras",

  // Arianna Montaña (variante solo nombre en solicitudes: Arianna)
  "arianna montaña": "Arianna Montaña",
  "arianna montana": "Arianna Montaña",
  "arianna": "Arianna Montaña",

  // Viviana Carreño
  "viviana carreo": "Viviana Carreño",
  "viviana carreño": "Viviana Carreño",
  "viviana carrño": "Viviana Carreño",

  // Carla Figueroa (Taquilla)
  "carla figueroa": "Carla Figueroa",
  "carlafigueroa": "Carla Figueroa",

  // Ariadne Manrique
  "ariandne manrique": "Ariadne Manrique",
  "ariadne manrique": "Ariadne Manrique",
  "ariandne marique": "Ariadne Manrique",

  // Dadiuska Rincones (Taquilla Propatria)
  "dadiuska rincones": "Dadiuska Rincones",
  "dadiuska": "Dadiuska Rincones",

  // Greacie Cruzado (Asesor de Ventas)
  "greacie cruzado": "Gracie Cruzado",
  "gracie cruzado": "Gracie Cruzado",
  "gracie": "Gracie Cruzado",
  "greacie": "Gracie Cruzado",

  // Yaisen Herrera
  "yaisen herrera": "Yaisen Herrera",

  // Stephany Manrique
  "stephany manrique": "Stephany Manrique",

  // Carlos Ruiz
  "carlos ruiz": "Carlos Ruiz",

  // Roxana Yépez
  "roxana yepez": "Roxana Yépez",
  "roxana yépez": "Roxana Yépez",

  // Patricia Mendoza
  "patricia mendoza": "Patricia Mendoza",
  "patricia": "Patricia Mendoza",

  // Michel Ochoa (Taquilla)
  "michel ochoa": "Michel Ochoa",
  "michel": "Michel Ochoa",

  // Daiana Torres (Asesor de Ventas)
  "daiana torres": "Daiana Torres",
  "daiana torre": "Daiana Torres",
  "dayana torres": "Daiana Torres",
  "dayana torre": "Daiana Torres",

  // Haymar Barros
  "haymar barros": "Haymar Barros",
  "haymar": "Haymar Barros",

  // Accel Moreno
  "accel moreno": "Accel Moreno",

  // Gabriela Marrero (Taquilla)
  "gabriela marrero": "Gabriela Marrero",

  // Johanir Cañizales (Taquilla Valle)
  "johanir cañizales": "Johanir Cañizales",
  "johanir cañlizales": "Johanir Cañizales",
  "johanir canizales": "Johanir Cañizales",

  // Sherezade Gil (Taquilla Colinas)
  "sherezade gil": "Sherezade Gil",

  // Yilda González
  "yilda gonzález": "Yilda González",
  "yilda gonzalez": "Yilda González",

  // Ivoon Viana
  "ivoon viana": "Ivoon Viana",

  // Jafet Mauro (Taquilla Independencia)
  "jafet mauro": "Jafet Mauro",
  "jafet": "Jafet Mauro",

  // Johana Parra
  "johana parra": "Johana Parra",
  "johanna parra": "Johana Parra",
  "johanna": "Johana Parra",

  // Yosmery Hernández
  "yosmery hernández": "Yosmery Hernández",
  "yosmery hernandez": "Yosmery Hernández",

  // Yeniffer Torres
  "yeniffer torres": "Yeniffer Torres",

  // Xahory Gómez
  "xahory gómez": "Xahory Gómez",
  "xahory gomez": "Xahory Gómez",
  "xaori gomez": "Xahory Gómez",
  "xaori": "Xahory Gómez",

  // Rodger Infante (Taquilla Independencia)
  "rodger infante": "Rodger Infante",
  "rdger infante": "Rodger Infante",

  // Daxi / Devi Alayón
  "daxi alayon": "Devi Alayón",
  "devi alayon": "Devi Alayón",
  "devi alayón": "Devi Alayón",

  // Yanely Dávila
  "yanely davila": "Yanely Dávila",
  "yanely dávila": "Yanely Dávila",
  "yanelyp davila": "Yanely Dávila",
  "yasmely dávila": "Yanely Dávila",
  "yasmely davila": "Yanely Dávila",

  // Delia Moniz (Taquilla Colinas)
  "delia moniz": "Delia Moniz",

  // Endely Vegas (Planificación)
  "e v": "Endely Vegas",
  "ev": "Endely Vegas",
  "endely pl": "Endely Vegas",
  "endely vegas": "Endely Vegas",

  // Dayhomy Vivas (Planificación)
  "dayhomy daynerby vivas albornoz": "Dayhomy Vivas",
  "vivasdayhomy": "Dayhomy Vivas",
  "dayhomy vivas": "Dayhomy Vivas",
  "dayhomy": "Dayhomy Vivas",

  // María Azuaje
  "maria azuaje": "María Azuaje",
  "maría azuaje": "María Azuaje",

  // Yamery Rodríguez (variantes: Yanery Rodriguez, Yanery Rodríguez, Yamery)
  "yamery de los angeles rodriguez mezones": "Yamery Rodríguez",
  "yamery de los angeles rodríguez mezones": "Yamery Rodríguez",
  "yamery de los angeles rodriguez": "Yamery Rodríguez",
  "yamery rodriguez": "Yamery Rodríguez",
  "yamery rodríguez": "Yamery Rodríguez",
  "yanery rodriguez": "Yamery Rodríguez",
  "yanery rodríguez": "Yamery Rodríguez",
  "yamery": "Yamery Rodríguez",
  "yanery": "Yamery Rodríguez",

  // Nombres completos registrados en usuarios
  "emmennis gabriela marrero gonzalez": "Gabriela Marrero",
  "emmennis gabriela marrero gonzález": "Gabriela Marrero",
  "josmeiby patricia mendoza oropeza": "Patricia Mendoza",
  "genesis joliana ochoa rodriguez": "Génesis Ochoa",
  "genesis joliana ochoa rodríguez": "Génesis Ochoa",
  "génesis joliana ochoa rodríguez": "Génesis Ochoa",
  "yesenia yusmary teran parisca": "Yesenia Terán",
  "yesenia yusmary terán parisca": "Yesenia Terán",
  "branin enrique berroteran alvarez": "Branin Berroteran",
  "branin enrique berroterán álvarez": "Branin Berroteran",
  "brainin enrique berroteran alvarez": "Branin Berroteran",
  "daiana del carmen torres coronado": "Daiana Torres",
  "stephany jose manrique": "Stephany Manrique",
  "stephany josé manrique": "Stephany Manrique",
  "yuliana armelih carvajal suarez": "Yuliana Carvajal",
  "yuliana armelih carvajal suárez": "Yuliana Carvajal",
  "maria alejandra azuaje araujo": "María Azuaje",
  "maría alejandra azuaje araujo": "María Azuaje",
  "yilda samantha gonzalez rujano": "Yilda González",
  "yilda samantha gonzález rujano": "Yilda González",
  "arianna estefania montaña hernandez": "Arianna Montaña",
  "arianna estefanía montaña hernández": "Arianna Montaña",
  "diarnelis paola mendoza merida": "Diarnelis Mendoza",
  "diarnelis paola mendoza mérida": "Diarnelis Mendoza",
  "andrea danyelit plaza seijas": "Andrea Plaza",
  "danyelis nicleimy muñoz yedra": "Danyelis Muñoz",
  "naomi carolina tovar gauna": "Naomi Tovar",

  // Brayerlyn Rodríguez (variantes: Brayerlin Rodriguez)
  "brayerlyn rodriguez": "Brayerlyn Rodríguez",
  "brayerlyn rodríguez": "Brayerlyn Rodríguez",
  "brayerlin rodriguez": "Brayerlyn Rodríguez",
  "brayerlin rodríguez": "Brayerlyn Rodríguez",
  "brayerlyn": "Brayerlyn Rodríguez",
  "brayerlin": "Brayerlyn Rodríguez",

  // Diego Rodríguez
  "diego rodriguez": "Diego Rodríguez",
  "diego rodríguez": "Diego Rodríguez",

  // Lisbray Suárez
  "lisbray suarez": "Lisbray Suárez",
  "lisbray suárez": "Lisbray Suárez",

  // César Aponte
  "cesar aponte": "César Aponte",
  "césar aponte": "César Aponte",

  // Hernán Fernández
  "hernan fernandez": "Hernán Fernández",
  "hernán fernández": "Hernán Fernández",

  // Gabriel Sánchez
  "gabriel sanchez": "Gabriel Sánchez",
  "gabriel sánchez": "Gabriel Sánchez",

  // Aurimar Solórzano
  "aurimar solorzano": "Aurimar Solórzano",
  "aurimar solórzano": "Aurimar Solórzano",

  // Jefferson Plaza
  "jeferson plaza": "Jefferson Plaza",
  "jefferson plaza": "Jefferson Plaza",

  // Abraham Raga (Planificación)
  "abraham josue raga mendoza": "Abraham Raga",
  "abraham raga": "Abraham Raga",
  "abraham": "Abraham Raga",

  // Daleska Berroterán
  "daleska": "Daleska Berroterán",
  "daleska berroteran": "Daleska Berroterán",
  "daleska berroterán": "Daleska Berroterán",

  // José Mujica
  "jose mujica": "José Mujica",
  "josé mujica": "José Mujica",

  // Dixon (Planificación)
  "dixon pl": "Dixon",
  "dixon": "Dixon",

  // Placeholders y Genéricos
  "asesor no identificado": "Sin Asesor",
  "taquillero no identificado": "Sin Asesor",
  "miembro no identificado": "Sin Asesor",
  "asesor comercial": "Sin Asesor",
  "turegalitoccsfiesta": "Sin Asesor",
  "administrador general": "Sin Asesor",
  "administrador": "Sin Asesor",
  "admin": "Sin Asesor",
  "planificación power": "Planificación",
  "central planificación": "Planificación",
  "central planificacion": "Planificación",

  // Externos
  "externo": "Externo",
  "externos": "Externo",
  "aliado externo": "Externo",
  "promotor": "Externo",
  "promotores": "Externo",
};

export const PLANIFICACION_MEMBERS: Record<string, string> = {
  "endely pl": "Endely Vegas",
  "endely vegas": "Endely Vegas",
  "e v": "Endely Vegas",
  "ev": "Endely Vegas",
  "geoberlay pl": "Geoberlay Noriega",
  "geoberlay noriega": "Geoberlay Noriega",
  "yeniffer pl": "Yeniffer Torres",
  "yeniffer torres": "Yeniffer Torres",
  "jesús lima": "Jesús Lima",
  "jesus lima": "Jesús Lima",
  "zuyerlin pl": "Zuyerlin Ramírez",
  "zuyerlin ramirez": "Zuyerlin Ramírez",
  "zuyerlin ramírez": "Zuyerlin Ramírez",
  "abraham raga": "Abraham Raga",
  "abraham": "Abraham Raga",
  "abraham josue raga mendoza": "Abraham Raga",
  "jafet pl": "Jafet Mauro",
  "dayhomy vivas": "Dayhomy Vivas",
  "dayhomy daynerby vivas albornoz": "Dayhomy Vivas",
  "vivasdayhomy": "Dayhomy Vivas",
  "maría gabriela": "María Gabriela",
  "maria gabriela": "María Gabriela",
  "central planificación": "Planificación",
  "central planificacion": "Planificación",
  "planificacion power": "Planificación",
  "planificación power": "Planificación",
  "planificacion": "Planificación",
  "planificación": "Planificación",
  "dixon pl": "Dixon",
};

export const TAQUILLEROS_SET = new Set([
  "hector mendoza",
  "héctor mendoza",
  "johanir cañizales",
  "johanir canizales",
  "johanir cañlizales",
  "alejandro sanchez",
  "alejandro sánchez",
  "rodger infante",
  "jafet mauro",
  "yuleisy campomas",
  "dadiuska rincones",
  "sherezade gil",
  "delia moniz",
  "michel ochoa",
  "carla figueroa",
  "gabriela marrero",
  "stephanie contreras",
  "stephany contreras",
  "stephanie",
  "taquillero no identificado",
  "taquilla",
  "taquilla virtual",
  "call center",
]);

export const TAQUILLA_OFFICE_MAP: Record<string, string> = {
  "héctor mendoza": "Valle",
  "hector mendoza": "Valle",
  "johanir cañizales": "Valle",
  "johanir canizales": "Valle",
  "alejandro sánchez": "Independencia",
  "alejandro sanchez": "Independencia",
  "rodger infante": "Independencia",
  "jafet mauro": "Independencia",
  "yuleisy campomas": "Las Tejerías",
  "dadiuska rincones": "Propatria",
  "sherezade gil": "Colinas",
  "delia moniz": "Colinas",
  "michel ochoa": "Alí Primera",
  "carla figueroa": "Alí Primera",
  "gabriela marrero": "Alí Primera",
  "stephanie contreras": "Valle",
  "stephany contreras": "Valle",
  "stephanie": "Valle",
};

export const TECNICOS_CANONICAL: Record<string, { name: string; team?: string }> = {
  // Equipo A
  "douglas m.": { name: "Douglas Mayobre", team: "Equipo A" },
  "douglas m": { name: "Douglas Mayobre", team: "Equipo A" },
  "douglas mayobre": { name: "Douglas Mayobre", team: "Equipo A" },
  "d mayobre": { name: "Douglas Mayobre", team: "Equipo A" },
  "moises p.": { name: "Moisés Piñango", team: "Equipo A" },
  "moises p": { name: "Moisés Piñango", team: "Equipo A" },
  "moises piñango": { name: "Moisés Piñango", team: "Equipo A" },
  "moises pinango": { name: "Moisés Piñango", team: "Equipo A" },
  "m piñango": { name: "Moisés Piñango", team: "Equipo A" },

  // Equipo B
  "luis r.": { name: "Luis Rodríguez", team: "Equipo B" },
  "luis r": { name: "Luis Rodríguez", team: "Equipo B" },
  "luis rodriguez": { name: "Luis Rodríguez", team: "Equipo B" },
  "luis rodríguez": { name: "Luis Rodríguez", team: "Equipo B" },
  "l rodriguez": { name: "Luis Rodríguez", team: "Equipo B" },
  "gabriel e.": { name: "Gabriel Espinoza", team: "Equipo B" },
  "gabriel espinoza": { name: "Gabriel Espinoza", team: "Equipo B" },
  "cesar campos": { name: "César Campos", team: "Equipo B" },
  "césar campos": { name: "César Campos", team: "Equipo B" },
  "cesar c.": { name: "César Campos", team: "Equipo B" },
  "cesar c": { name: "César Campos", team: "Equipo B" },
  "c campos": { name: "César Campos", team: "Equipo B" },

  // Equipo C
  "ernesto d.": { name: "Ernesto Delgado", team: "Equipo C" },
  "ernesto d": { name: "Ernesto Delgado", team: "Equipo C" },
  "ernesto delgado": { name: "Ernesto Delgado", team: "Equipo C" },
  "e delgado": { name: "Ernesto Delgado", team: "Equipo C" },
  "luis a.": { name: "Luis Altuve", team: "Equipo C" },
  "luis altuve": { name: "Luis Altuve", team: "Equipo C" },
  "l altuve": { name: "Luis Altuve", team: "Equipo C" },
  "altuve": { name: "Luis Altuve", team: "Equipo C" },
  "zadkiel": { name: "Zadkiel", team: "Equipo C" },

  // Equipo D
  "randy m.": { name: "Randy Moreno", team: "Equipo D" },
  "randy m": { name: "Randy Moreno", team: "Equipo D" },
  "randy moreno": { name: "Randy Moreno", team: "Equipo D" },
  "r moreno": { name: "Randy Moreno", team: "Equipo D" },
  "kevin c.": { name: "Kevin Cortez", team: "Equipo D" },
  "kevin cortez": { name: "Kevin Cortez", team: "Equipo D" },
  "k cortez": { name: "Kevin Cortez", team: "Equipo D" },

  // Equipo E
  "henry c.": { name: "Henry Cartaya", team: "Equipo E" },
  "henry c": { name: "Henry Cartaya", team: "Equipo E" },
  "henry cartaya": { name: "Henry Cartaya", team: "Equipo E" },
  "h cartaya": { name: "Henry Cartaya", team: "Equipo E" },
  "moises m.": { name: "Moisés Mujica", team: "Equipo E" },
  "moises mujica": { name: "Moisés Mujica", team: "Equipo E" },
  "m mujica": { name: "Moisés Mujica", team: "Equipo E" },

  // Equipo F
  "armando g.": { name: "Armando González", team: "Equipo F" },
  "armando g": { name: "Armando González", team: "Equipo F" },
  "armando gonzalez": { name: "Armando González", team: "Equipo F" },
  "armando gonzález": { name: "Armando González", team: "Equipo F" },
  "a gonzalez": { name: "Armando González", team: "Equipo F" },
  "daniel c.": { name: "Daniel Colmenares", team: "Equipo F" },
  "daniel colmenares": { name: "Daniel Colmenares", team: "Equipo F" },
  "d colmenares": { name: "Daniel Colmenares", team: "Equipo F" },

  // Equipo G
  "jonathan g.": { name: "Jonathan Gutiérrez", team: "Equipo G" },
  "jonathan g": { name: "Jonathan Gutiérrez", team: "Equipo G" },
  "jonathan gutierrez": { name: "Jonathan Gutiérrez", team: "Equipo G" },
  "jonathan gutiérrez": { name: "Jonathan Gutiérrez", team: "Equipo G" },
  "j gutierrez": { name: "Jonathan Gutiérrez", team: "Equipo G" },
  "cesar gomez": { name: "César Gómez", team: "Equipo G" },
  "cesar gómez": { name: "César Gómez", team: "Equipo G" },
  "c gomez": { name: "César Gómez", team: "Equipo G" },
  "cesar candia": { name: "César Candia", team: "Equipo G" },
  "deybic m.": { name: "Deybic Martínez", team: "Equipo G" },
  "deybic martinez": { name: "Deybic Martínez", team: "Equipo G" },

  // Equipo H
  "carlos a.": { name: "Carlos Araujo", team: "Equipo H" },
  "carlos araujo": { name: "Carlos Araujo", team: "Equipo H" },
  "c araujo": { name: "Carlos Araujo", team: "Equipo H" },
  "david p.": { name: "David Pereira", team: "Equipo H" },
  "david p": { name: "David Pereira", team: "Equipo H" },
  "david pereira": { name: "David Pereira", team: "Equipo H" },
  "d pereira": { name: "David Pereira", team: "Equipo H" },

  // Equipo I
  "roosvelt lara": { name: "Roosvelt Lara", team: "Equipo I" },
  "roosevelt lara": { name: "Roosvelt Lara", team: "Equipo I" },
  "roosvelt l.": { name: "Roosvelt Lara", team: "Equipo I" },
  "roosevelt l.": { name: "Roosvelt Lara", team: "Equipo I" },
  "johan rodriguez": { name: "Johan Rodríguez", team: "Equipo I" },
  "johan rodríguez": { name: "Johan Rodríguez", team: "Equipo I" },
  "juan mijares": { name: "Juan Mijares", team: "Equipo I" },
  "jober d.": { name: "Jober Delgado", team: "Equipo I" },
  "jober delgado": { name: "Jober Delgado", team: "Equipo I" },
  "steven mardach": { name: "Steven Mardach", team: "Equipo I" },
  "s mardach": { name: "Steven Mardach", team: "Equipo I" },
  "isaac salgado": { name: "Isaac Salgado", team: "Equipo I" },
  "i salgado": { name: "Isaac Salgado", team: "Equipo I" },

  // Equipo J
  "alfredo e.": { name: "Alfredo Escobar", team: "Equipo J" },
  "alfredo e": { name: "Alfredo Escobar", team: "Equipo J" },
  "alfredo escobar": { name: "Alfredo Escobar", team: "Equipo J" },
  "a escobar": { name: "Alfredo Escobar", team: "Equipo J" },
  "simon t.": { name: "Simón Torres", team: "Equipo J" },
  "simon t": { name: "Simón Torres", team: "Equipo J" },
  "simon torres": { name: "Simón Torres", team: "Equipo J" },
  "simón torres": { name: "Simón Torres", team: "Equipo J" },
  "alexis garcia": { name: "Alexis García", team: "Equipo J" },
  "alexis garcía": { name: "Alexis García", team: "Equipo J" },
  "hernan leal": { name: "Hernán Leal", team: "Equipo J" },
  "hernán leal": { name: "Hernán Leal", team: "Equipo J" },
  "h leal": { name: "Hernán Leal", team: "Equipo J" },

  // Equipo K
  "jose leal": { name: "José Leal", team: "Equipo K" },
  "josé leal": { name: "José Leal", team: "Equipo K" },
  "j leal": { name: "José Leal", team: "Equipo K" },
  "jefferson castellanos": { name: "Jefferson Castellanos", team: "Equipo K" },
  "j castellanos": { name: "Jefferson Castellanos", team: "Equipo K" },

  // Equipo L
  "alexis gil": { name: "Alexis Gil", team: "Equipo L" },
  "alexis g.": { name: "Alexis Gil", team: "Equipo L" },
  "a gil": { name: "Alexis Gil", team: "Equipo L" },
  "carlos gil": { name: "Carlos Gil", team: "Equipo L" },
  "kehisber caraballo": { name: "Kehisber Caraballo", team: "Equipo L" },
  "kehisber c.": { name: "Kehisber Caraballo", team: "Equipo L" },
  "k caraballo": { name: "Kehisber Caraballo", team: "Equipo L" },

  // Equipo M
  "keithmel marcano": { name: "Keithmel Marcano", team: "Equipo M" },
  "keithmel m.": { name: "Keithmel Marcano", team: "Equipo M" },
  "keithmel m": { name: "Keithmel Marcano", team: "Equipo M" },
  "k marcano": { name: "Keithmel Marcano", team: "Equipo M" },
  "jefferson marrero": { name: "Jefferson Marrero", team: "Equipo M" },
  "jefferson m.": { name: "Jefferson Marrero", team: "Equipo M" },
  "j marrero": { name: "Jefferson Marrero", team: "Equipo M" },
};

const UNACCENTED_CANONICAL: Record<string, string> = {};
for (const [k, v] of Object.entries(ADVISOR_CANONICAL)) {
  UNACCENTED_CANONICAL[stripAccents(k)] = v;
}
for (const [k, v] of Object.entries(PLANIFICACION_MEMBERS)) {
  UNACCENTED_CANONICAL[stripAccents(k)] = v;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array(an + 1).fill(null).map(() => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[i][0] = i;
  for (let j = 0; j <= bn; j++) matrix[0][j] = j;
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

/**
 * Normalizes an advisor string according to canonical dictionaries and custom aliases.
 */
export function normalizeAdvisorName(
  raw: string | null | undefined,
  customAliases?: Record<string, string>
): string {
  if (!raw) return "Sin Asesor";
  const clean = raw
    .replace(/[\u200e\u200f\u202a\u202c\ufeff\*~`\_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean === "-" || clean.toLowerCase() === "n/a" || clean.toLowerCase() === "sin asesor") {
    return "Sin Asesor";
  }

  // Reject shifted money rows
  if (/^(\$|bs|\d+[\,\.])/i.test(clean)) {
    return "Desconocido";
  }

  const lower = clean.toLowerCase();
  const stripped = stripAccents(clean);

  // 0. Check custom user-defined aliases
  if (customAliases) {
    if (customAliases[clean]) return customAliases[clean];
    if (customAliases[lower]) return customAliases[lower];
    const matchAlias = Object.entries(customAliases).find(
      ([k]) => k.toLowerCase() === lower || stripAccents(k) === stripped
    );
    if (matchAlias) return matchAlias[1];
  }

  // 1. Check direct canonical
  if (ADVISOR_CANONICAL[lower]) return ADVISOR_CANONICAL[lower];
  if (PLANIFICACION_MEMBERS[lower]) return PLANIFICACION_MEMBERS[lower];

  // 2. Check unaccented canonical
  if (UNACCENTED_CANONICAL[stripped]) return UNACCENTED_CANONICAL[stripped];

  // 3. Substring matching
  for (const [k, v] of Object.entries(ADVISOR_CANONICAL)) {
    if (lower.length >= 4 && (lower.startsWith(k) || lower.includes(k))) {
      return v;
    }
  }
  for (const [k, v] of Object.entries(PLANIFICACION_MEMBERS)) {
    if (lower.length >= 4 && (lower.startsWith(k) || lower.includes(k))) {
      return v;
    }
  }
  for (const [k, v] of Object.entries(UNACCENTED_CANONICAL)) {
    if (stripped.length >= 4 && (stripped.startsWith(k) || stripped.includes(k))) {
      return v;
    }
  }

  // 4. Fuzzy Levenshtein matching against canonical dictionary (tolera pequeñas diferencias tipográficas)
  if (stripped.length >= 6) {
    let bestMatch: string | null = null;
    let minDistance = 3; // Tolera distancias <= 2

    for (const [k, v] of Object.entries(UNACCENTED_CANONICAL)) {
      if (k.length >= 6 && Math.abs(k.length - stripped.length) <= 2) {
        const dist = levenshteinDistance(stripped, k);
        if (dist <= 2 && dist < minDistance) {
          minDistance = dist;
          bestMatch = v;
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  // Fallback: title case
  return clean
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Safely looks up an advisor override by canonical name, lowercase, unaccented, or exact match.
 */
export function findAdvisorOverride(
  advisorName: string | null | undefined,
  overrides?: AdvisorOverridesMap
): { key: string; config: AdvisorCustomConfig } | undefined {
  if (!advisorName || !overrides) return undefined;
  if (overrides[advisorName]) return { key: advisorName, config: overrides[advisorName] };
  const norm = normalizeAdvisorName(advisorName);
  if (overrides[norm]) return { key: norm, config: overrides[norm] };
  const lower = advisorName.toLowerCase().trim();
  if (overrides[lower]) return { key: lower, config: overrides[lower] };
  const stripped = stripAccents(advisorName).trim();
  const found = Object.entries(overrides).find(([k]) => {
    const kLower = k.toLowerCase().trim();
    return kLower === lower || stripAccents(k).trim() === stripped;
  });
  if (found) return { key: found[0], config: found[1] };
  return undefined;
}

/**
 * Categorizes an advisor into one of the 4 key business segments:
 * - "comercial" (Asesor Comercial de Calle)
 * - "taquilla" (Taquillero de Sede / Oficina)
 * - "planificacion" (Analista de Planificación / Agenda)
 * - "externo" (Externos / Promotores)
 */
export function classifyAdvisor(
  rawName: string | null | undefined,
  overrides?: AdvisorOverridesMap
): AdvisorType {
  if (!rawName) return "otro";
  const norm = normalizeAdvisorName(rawName);
  const lower = norm.toLowerCase();

  // 0. Manual custom overrides take highest precedence
  if (overrides) {
    const match = findAdvisorOverride(rawName, overrides) || findAdvisorOverride(norm, overrides);
    if (match?.config?.type) return match.config.type;
  }

  if (lower === "desconocido" || lower === "sin asesor") return "otro";

  if (
    lower.includes("externo") ||
    lower.includes("promotor") ||
    lower.includes("freelance") ||
    lower.includes("aliado")
  ) {
    return "externo";
  }

  if (
    lower.includes("planificac") ||
    PLANIFICACION_MEMBERS[lower] !== undefined ||
    Object.values(PLANIFICACION_MEMBERS).map((m) => m.toLowerCase()).includes(lower)
  ) {
    return "planificacion";
  }

  if (
    TAQUILLEROS_SET.has(lower) ||
    lower.includes("taquill") ||
    TAQUILLA_OFFICE_MAP[lower] !== undefined
  ) {
    return "taquilla";
  }

  return "comercial";
}

/**
 * Resolves the physical office / branch for a box office agent (Taquillero).
 */
export function resolveAdvisorOffice(
  advisorName: string,
  overrides?: AdvisorOverridesMap
): string | undefined {
  const norm = normalizeAdvisorName(advisorName);
  const lower = norm.toLowerCase();

  // 0. Manual custom overrides
  if (overrides) {
    const match = findAdvisorOverride(advisorName, overrides) || findAdvisorOverride(norm, overrides);
    if (match?.config?.office) return match.config.office;
  }

  return TAQUILLA_OFFICE_MAP[lower] || (classifyAdvisor(advisorName, overrides) === "taquilla" ? "Alí Primera" : undefined);
}

/**
 * Checks whether an advisor has been marked as a former employee / ex-collaborator.
 */
export function isAdvisorExCollaborator(
  rawName: string | null | undefined,
  overrides?: AdvisorOverridesMap
): boolean {
  if (!rawName) return false;
  const lower = rawName.toLowerCase();
  if (
    lower.includes("ex-colaborador") ||
    lower.includes("ex colaborador") ||
    lower.includes("(ex)") ||
    lower.includes("ex-")
  ) {
    return true;
  }
  if (!overrides) return false;
  const match = findAdvisorOverride(rawName, overrides);
  if (match?.config?.isExCollaborator !== undefined) {
    return Boolean(match.config.isExCollaborator);
  }
  if (match?.config?.status === "ex") {
    return true;
  }
  return false;
}



/**
 * Safely looks up a technician override by name, lowercase, or unaccented match.
 */
export function findTechnicianOverride(
  techName: string | null | undefined,
  overrides?: TechnicianOverridesMap
): { key: string; config: TechnicianCustomConfig } | undefined {
  if (!techName || !overrides) return undefined;
  if (overrides[techName]) return { key: techName, config: overrides[techName] };
  const lower = techName.toLowerCase().trim();
  if (overrides[lower]) return { key: lower, config: overrides[lower] };
  const stripped = stripAccents(techName).trim();
  const found = Object.entries(overrides).find(([k]) => {
    const kLower = k.toLowerCase().trim();
    return kLower === lower || stripAccents(k).trim() === stripped;
  });
  if (found) return { key: found[0], config: found[1] };
  return undefined;
}

/**
 * Checks if a technician has been marked as former employee or moved to another department.
 */
export function isTechnicianExCollaborator(
  rawName: string | null | undefined,
  overrides?: TechnicianOverridesMap
): boolean {
  if (!rawName || !overrides) return false;
  const match = findTechnicianOverride(rawName, overrides);
  if (match?.config?.isExCollaborator !== undefined) {
    return Boolean(match.config.isExCollaborator);
  }
  if (match?.config?.status === "ex") return true;
  return false;
}

/**
 * Normalizes technician names and pairs them with their assigned Squad / Team,
 * taking into account custom technician overrides and aliases.
 */
export function normalizeTechnician(
  raw: string | null | undefined,
  overrides?: TechnicianOverridesMap,
  customAliases?: Record<string, string>
): { name: string; team?: string; isEx?: boolean; status?: MemberStatus; department?: StaffDepartment } {
  if (!raw) return { name: "" };
  const clean = raw
    .replace(/[\u200e\u200f\u202a\u202c\ufeff\*~`\_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean === "-" || clean.toLowerCase() === "n/a" || clean.toUpperCase().includes("TECNICO ")) {
    return { name: "" };
  }

  // 0. Check custom aliases if defined
  let targetClean = clean;
  if (customAliases) {
    if (customAliases[clean]) targetClean = customAliases[clean];
    else {
      const lowerClean = clean.toLowerCase();
      if (customAliases[lowerClean]) targetClean = customAliases[lowerClean];
    }
  }

  const lower = targetClean.toLowerCase();
  let baseName = "";
  let baseTeam: string | undefined = undefined;

  if (TECNICOS_CANONICAL[lower]) {
    baseName = TECNICOS_CANONICAL[lower].name;
    baseTeam = TECNICOS_CANONICAL[lower].team;
  } else {
    for (const [k, v] of Object.entries(TECNICOS_CANONICAL)) {
      if (lower.length >= 4 && (lower === k || lower.startsWith(k) || lower.includes(k))) {
        baseName = v.name;
        baseTeam = v.team;
        break;
      }
    }
  }

  if (!baseName) {
    baseName = targetClean
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // 1. Check custom overrides for squad/team, status, department, and ex collaborator
  if (overrides) {
    const match = findTechnicianOverride(baseName, overrides) || findTechnicianOverride(targetClean, overrides) || findTechnicianOverride(clean, overrides);
    if (match?.config) {
      const isEx = match.config.isExCollaborator !== undefined
        ? Boolean(match.config.isExCollaborator)
        : match.config.status === "ex";

      return {
        name: baseName,
        team: match.config.team !== undefined ? match.config.team : baseTeam,
        isEx,
        status: match.config.status || (isEx ? "ex" : "fijo"),
        department: match.config.department || "tecnico",
      };
    }
  }

  return { name: baseName, team: baseTeam, isEx: false, status: "fijo", department: "tecnico" };
}

const ADVISOR_STOPWORDS = new Set(["de", "del", "la", "las", "los", "san", "santa", "el"]);

function getAdvisorTokens(str: string): string[] {
  return stripAccents(str)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ADVISOR_STOPWORDS.has(w));
}

/**
 * Robust advisor name matcher:
 * Handles legal full names vs commercial short names (e.g. "Yamery de los Angeles Rodríguez Mezones" vs "Yamery Rodriguez")
 */
export function areSameAdvisorName(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const cleanA = stripAccents(nameA);
  const cleanB = stripAccents(nameB);
  if (cleanA === cleanB) return true;

  // 1. Check canonical normalized strings
  const normA = normalizeAdvisorName(nameA);
  const normB = normalizeAdvisorName(nameB);
  if (normA && normB && normA !== "Sin Asesor" && normA === normB) {
    return true;
  }

  // 2. Token overlap: If one name's tokens are a subset of the other's tokens
  const tokensA = getAdvisorTokens(nameA);
  const tokensB = getAdvisorTokens(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;

  // Check if all tokens of the shorter name are contained in the longer name
  const allContained = shorter.every((token) => longer.includes(token));
  if (allContained && shorter.length >= 2) {
    return true;
  }

  // Check for at least 2 common significant tokens (e.g., first name + last name)
  const common = shorter.filter((token) => longer.includes(token));
  if (common.length >= 2) {
    return true;
  }

  return false;
}


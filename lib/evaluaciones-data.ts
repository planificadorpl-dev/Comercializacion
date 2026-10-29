/**
 * Módulo de Evaluación y Supervisión de Asesores
 * Basado en el documento oficial: Formato_Evaluacion_Power_Link-v2.docx
 * POWER LINK CORP, C.A. — FORMATO DE SUPERVISIÓN Y EVALUACIÓN
 */

export type EvaluadorRol = "Supervisor" | "Asesor Impulsador" | "Coordinador" | "supervisor" | "asesor_impulsador" | "coordinador";
export type EvaluacionFrecuencia = "Diaria" | "Semanal" | "Mensual" | "diaria" | "semanal" | "mensual";

export interface EvaluacionItemDef {
  id: string;
  variable: string;
  descripcion: string;
  pregunta: string;
  preguntaEvaluador: string;
}

export interface EvaluacionFactorDef {
  id: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  items: EvaluacionItemDef[];
}

export const EVALUACION_FACTORES: EvaluacionFactorDef[] = [
  {
    id: "territorial",
    nombre: "Territorial",
    titulo: "Factor: Territorial",
    descripcion: "Evaluación de reconocimiento, estudio de terreno y abordaje de zona",
    items: [
      {
        id: "afluencia",
        variable: "Afluencia",
        descripcion: "Identificar sectores con alta y baja afluencia",
        pregunta: "¿Identificaste sectores con alta y baja afluencia de personas?",
        preguntaEvaluador: "¿El asesor identifica con precisión los sectores de alta y baja afluencia de personas en la zona?",
      },
      {
        id: "barridos",
        variable: "Barridos",
        descripcion: "Realizar barridos junto al asesor en la calle / comunidad",
        pregunta: "¿Realizaste barridos y recorridos en calle o comunidad?",
        preguntaEvaluador: "¿El asesor realiza los barridos y abordajes en calle de manera exhaustiva y disciplinada?",
      },
      {
        id: "competencia",
        variable: "Competencia",
        descripcion: "Estudio de precios y planes de la competencia",
        pregunta: "¿Evaluaste los precios, planes y presencia de la competencia?",
        preguntaEvaluador: "¿El asesor conoce y analiza los precios, promociones y cobertura de los operadores competidores?",
      },
      {
        id: "ubicacion",
        variable: "Ubicación",
        descripcion: "Conseguir locaciones para IGLU",
        pregunta: "¿Conseguiste o evaluaste locaciones estratégicas para IGLU?",
        preguntaEvaluador: "¿El asesor gestiona y propone ubicaciones estratégicas y de alto impacto para puntos de venta o Iglú?",
      },
      {
        id: "lideres",
        variable: "Líderes",
        descripcion: "Reuniones previas con líderes comunitarios",
        pregunta: "¿Tuviste contacto o reuniones previas con líderes comunitarios?",
        preguntaEvaluador: "¿El asesor establece contacto previo y alianzas efectivas con los líderes comunitarios o administradores?",
      },
      {
        id: "prospectos",
        variable: "Prospectos",
        descripcion: "Levantamiento de base de datos de prospectos",
        pregunta: "¿Levantaste base de datos de nuevos prospectos en la zona?",
        preguntaEvaluador: "¿El asesor levanta y registra datos completos y verídicos de prospectos interesados durante la jornada?",
      },
    ],
  },
  {
    id: "tecnologico",
    nombre: "Tecnológico",
    titulo: "Factor: Tecnológico",
    descripcion: "Lectura de planta externa, equipos y nociones de conectividad",
    items: [
      {
        id: "lectura",
        variable: "Lectura",
        descripcion: "Lectura técnica previa (postes, tendidos, cajas NAP)",
        pregunta: "¿Hiciste lectura técnica previa (postes, tendidos y cajas NAP)?",
        preguntaEvaluador: "¿El asesor realiza una lectura técnica visual correcta de la infraestructura (postes, tendidos y cajas NAP)?",
      },
      {
        id: "mangas",
        variable: "Mangas",
        descripcion: "Ubicar visualmente mangas y cajas NAP",
        pregunta: "¿Ubicaste visualmente las mangas y cajas NAP disponibles?",
        preguntaEvaluador: "¿El asesor ubica con rapidez las cajas NAP y mangas disponibles más cercanas al cliente?",
      },
      {
        id: "conceptos",
        variable: "Conceptos",
        descripcion: "Conceptos claves sobre internet y fibra óptica",
        pregunta: "¿Dominaste y aplicaste los conceptos clave de internet y fibra óptica?",
        preguntaEvaluador: "¿El asesor domina y explica con claridad los conceptos fundamentales de fibra óptica, velocidad y ancho de banda?",
      },
      {
        id: "routers",
        variable: "Routers",
        descripcion: "Adiestramiento Router y configuraciones",
        pregunta: "¿Explicaste las configuraciones y características técnicas del router?",
        preguntaEvaluador: "¿El asesor explica adecuadamente las características técnicas, alcances y configuraciones de los routers ofrecidos?",
      },
      {
        id: "dispositivos",
        variable: "Dispositivos",
        descripcion: "Dispositivos y conectividad Wifi",
        pregunta: "¿Asesoraste sobre dispositivos compatibles y cobertura WiFi?",
        preguntaEvaluador: "¿El asesor orienta acertadamente sobre dispositivos compatibles y optimización de la cobertura WiFi?",
      },
    ],
  },
  {
    id: "tactico",
    nombre: "Táctico",
    titulo: "Factor: Táctico",
    descripcion: "Técnicas de prospección, abordaje, conexión y metodología en campo",
    items: [
      {
        id: "modelaje",
        variable: "Modelaje",
        descripcion: "Modelar en vivo presentación y captación",
        pregunta: "¿Aplicaste el modelaje de presentación y captación en vivo?",
        preguntaEvaluador: "¿El asesor replica eficazmente las técnicas de presentación comercial y cierre observadas en el modelaje?",
      },
      {
        id: "conexion",
        variable: "Conexión",
        descripcion: "Técnicas para conectar con líderes de la comunidad",
        pregunta: "¿Utilizaste técnicas efectivas para conectar con líderes y la comunidad?",
        preguntaEvaluador: "¿El asesor genera empatía, confianza y una conexión profesional con los residentes y voceros del sector?",
      },
      {
        id: "abordaje",
        variable: "Abordaje",
        descripcion: "Abordaje estratégico del cliente",
        pregunta: "¿Realizaste abordaje estratégico y proactivo a los clientes?",
        preguntaEvaluador: "¿El asesor aborda a los potenciales clientes de manera proactiva, segura y respetuosa en campo?",
      },
      {
        id: "obstaculos",
        variable: "Obstáculos",
        descripcion: "Detectar oportunidades y posibles obstáculos",
        pregunta: "¿Detectaste oportunidades en el terreno y manejaste posibles obstáculos?",
        preguntaEvaluador: "¿El asesor anticipa objeciones comunes y convierte dificultades del terreno en oportunidades de venta?",
      },
      {
        id: "adaptabilidad",
        variable: "Adaptabilidad",
        descripcion: "Adaptarse a la realidad de cada sector",
        pregunta: "¿Te adaptaste a la realidad y condiciones de cada sector?",
        preguntaEvaluador: "¿El asesor adapta su lenguaje y estrategia comercial a la realidad socioeconómica de cada sector?",
      },
      {
        id: "postventa",
        variable: "Postventa",
        descripcion: "Atención posventa",
        pregunta: "¿Brindaste orientación y seguimiento de atención posventa?",
        preguntaEvaluador: "¿El asesor instruye al cliente sobre los canales de soporte y realiza seguimiento a las solicitudes captadas?",
      },
      {
        id: "metodologia",
        variable: "Metodología",
        descripcion: "Evaluación de metodología (Recorridos, Cayapas, etc.)",
        pregunta: "¿Cumpliste la metodología establecida (recorridos, cayapas, etc.)?",
        preguntaEvaluador: "¿El asesor cumple con el protocolo de metodología operativa (recorridos, cayapas, puntos fijos)?",
      },
    ],
  },
  {
    id: "argumentativo",
    nombre: "Argumentativo",
    titulo: "Factor: Argumentativo",
    descripcion: "Defensa del producto, valor agregado y respuesta a objeciones",
    items: [
      {
        id: "beneficios",
        variable: "Beneficios",
        descripcion: "Beneficios directos para el cliente",
        pregunta: "¿Comunicaste con claridad los beneficios directos del servicio?",
        preguntaEvaluador: "¿El asesor comunica con convicción los beneficios prácticos y diferenciales de nuestros planes de servicio?",
      },
      {
        id: "costo_beneficio",
        variable: "Costo-Beneficio",
        descripcion: "Relación costo-beneficio del servicio",
        pregunta: "¿Demostraste la relación costo-beneficio de nuestros planes?",
        preguntaEvaluador: "¿El asesor demuestra convincentemente la relación costo-beneficio y valor agregado de la propuesta?",
      },
      {
        id: "justificacion",
        variable: "Justificación",
        descripcion: "Justificar precios frente a la competencia",
        pregunta: "¿Justificaste la propuesta de valor y precios frente a la competencia?",
        preguntaEvaluador: "¿El asesor justifica los precios de forma correcta frente a los de la competencia?",
      },
      {
        id: "tiempos",
        variable: "Tiempos",
        descripcion: "Tiempos instalación, atención y resolución",
        pregunta: "¿Informaste los tiempos reales de instalación, atención y resolución?",
        preguntaEvaluador: "¿El asesor comunica con honestidad y precisión los tiempos de instalación, atención y resolución técnica?",
      },
      {
        id: "requerimientos",
        variable: "Requerimientos",
        descripcion: "Manejo de requerimientos especiales",
        pregunta: "¿Manejaste adecuadamente los requerimientos especiales del cliente?",
        preguntaEvaluador: "¿El asesor maneja adecuadamente los requerimientos especiales y condiciones específicas del cliente?",
      },
      {
        id: "factibilidad",
        variable: "Factibilidad",
        descripcion: "Factibilidad y calidad de servicio",
        pregunta: "¿Verificaste la factibilidad técnica y calidad del servicio en la zona?",
        preguntaEvaluador: "¿El asesor asegura la validación de cobertura técnica antes de formalizar la captación?",
      },
    ],
  },
  {
    id: "organizacional",
    nombre: "Organizacional",
    titulo: "Factor: Organizacional",
    descripcion: "Disciplina operativa, uso de formatos, reporte oportuno y canales internos",
    items: [
      {
        id: "formatos",
        variable: "Formatos",
        descripcion: "Uso estricto de formatos de registro diario",
        pregunta: "¿Utilizaste estrictamente los formatos de registro diario?",
        preguntaEvaluador: "¿El asesor diligencia los formatos de captación y registro diario de manera completa, ordenada y legible?",
      },
      {
        id: "reporte",
        variable: "Reporte",
        descripcion: "Reporte disciplinado al cierre del día",
        pregunta: "¿Enviaste tu reporte diario de forma disciplinada y puntual?",
        preguntaEvaluador: "¿El asesor envía su resumen de gestión y reporte de números puntualmente al cierre de la jornada?",
      },
      {
        id: "informe",
        variable: "Informe",
        descripcion: "Informe puntual a gerencia al terminar rotación",
        pregunta: "¿Presentaste el informe de avances correspondiente a la jornada?",
        preguntaEvaluador: "¿El asesor entrega oportunamente los recaudos físicos, contratos e informes solicitados por gerencia o supervisión?",
      },
      {
        id: "servicios",
        variable: "Servicios",
        descripcion: "Dominio de información sobre planes y servicios",
        pregunta: "¿Demostraste dominio de la información sobre planes y servicios?",
        preguntaEvaluador: "¿El asesor demuestra un dominio impecable sobre el portafolio de planes, promociones y servicios vigentes?",
      },
      {
        id: "contactos",
        variable: "Contactos",
        descripcion: "Contactos de atención al cliente y soporte",
        pregunta: "¿Facilitaste los contactos oficiales de atención al cliente y soporte?",
        preguntaEvaluador: "¿El asesor suministra los canales oficiales de atención al cliente y soporte para garantizar una atención formal?",
      },
      {
        id: "canales",
        variable: "Canales",
        descripcion: "Canales de comunicación internos",
        pregunta: "¿Utilizaste los canales oficiales de comunicación interna?",
        preguntaEvaluador: "¿El asesor utiliza los canales corporativos oficiales para gestionar escalamientos, novedades y consultas internas?",
      },
    ],
  },
];

export const TOTAL_EVALUACION_ITEMS = EVALUACION_FACTORES.reduce(
  (acc, f) => acc + f.items.length,
  0
); // 30 items
export const MAX_EVALUACION_PUNTOS = TOTAL_EVALUACION_ITEMS * 5; // 150 puntos maximos

export interface EvaluacionItemState {
  puntuacion?: number; // Calificación de 1 a 5
  cumple?: boolean;    // Retrocompatibilidad
  observacion?: string;
}

export interface FactorScore {
  puntos: number;
  puntosMax: number;
  promedio: number;
  cumplidos: number;
  total: number;
  pct: number;
}

export interface TerritorioParroquia {
  nombre: string;
  sectores: string[];
}

export interface TerritorioMunicipio {
  nombre: string;
  parroquias: TerritorioParroquia[];
}

export interface TerritorioEstado {
  nombre: string;
  municipios: TerritorioMunicipio[];
}

export interface TerritorioData {
  estados: TerritorioEstado[];
}

export const TERRITORIOS_VENEZUELA: TerritorioData = {
  "estados": [
    {
      "nombre": "Aragua",
      "municipios": [
        {
          "nombre": "José Rafael Revenga",
          "parroquias": [
            {
              "nombre": "El Consejo",
              "sectores": [
                "Carretera Panamericana El Consejo-Tejerías",
                "Casco Central El Consejo",
                "Corocito",
                "El Buen Paso",
                "El Café",
                "El Conde",
                "El Ingenio de La Cruz",
                "El Tierral",
                "Fila El Picacho",
                "Hacienda La Urbina",
                "Juan Vicente Bolívar y Ponte",
                "La Concepción 1 y 2",
                "La Iguana",
                "La Mora",
                "La Olla",
                "Las Luisas",
                "Las Rosas",
                "Los Cerritos",
                "Los Martínez 1 y 2",
                "Mi Esperanza",
                "Quebrada Seca",
                "Quebrada Seca de Urbina",
                "Sabaneta",
                "Santa Rosalía",
                "Santa Teresa",
                "Santo Domingo",
                "Tiquire Flores",
                "Zurita"
              ]
            }
          ]
        },
        {
          "nombre": "Santos de Michelena",
          "parroquias": [
            {
              "nombre": "Las Tejerías",
              "sectores": [
                "Bella Vista",
                "Bolívar",
                "Brisas de Aragua",
                "Brisas de Bucaral",
                "Cañaote",
                "Caobal",
                "Casco Central",
                "Ciudad Guayas",
                "Colinas de Bucaral",
                "Curiepe",
                "El Beisbol",
                "El Loro",
                "Jabillal",
                "Jerusalén",
                "La Cañada",
                "La Concepción",
                "La Constituyente",
                "La Esperanza",
                "La Gruta",
                "Las Lomitas",
                "Las Mercedes",
                "Llano Grande",
                "Los Límites",
                "Los Panamericanos",
                "Ruiz Pineda",
                "Santo Domingo",
                "Tabacal",
                "Tiara",
                "Tinapuey",
                "Trapiche del Medio",
                "Variantes de Guaya",
                "Zona Industrial Tejería"
              ]
            }
          ]
        }
      ]
    },
    {
      "nombre": "Distrito Capital",
      "municipios": [
        {
          "nombre": "Libertador",
          "parroquias": [
            {
              "nombre": "Coche",
              "sectores": [
                "Coche",
                "Las Mayas"
              ]
            },
            {
              "nombre": "El Valle",
              "sectores": [
                "19 de Abril",
                "24 de Julio",
                "5 de Julio",
                "Bruzual",
                "C.C. El Valle",
                "Cajigal",
                "Calle 1",
                "Calle 10",
                "Calle 12",
                "Calle 13",
                "Calle 14",
                "Calle 15",
                "Calle 16",
                "Calle 17",
                "Calle 18",
                "Calle 2",
                "Calle 3",
                "Calle 7",
                "Calle 8",
                "Calle 9",
                "Calle Apure",
                "Calle Argentina",
                "Calle Cajigal",
                "Calle del Medio",
                "Calle El Loro",
                "Calle Principal",
                "Calle Robles",
                "Calle San Luis",
                "Canisito",
                "Casco Central",
                "Cerro Grande",
                "Chaparral",
                "Davila",
                "El Calvario",
                "El Modulo",
                "El Setenta (El 70)",
                "El Tamarindo",
                "El Triángulo",
                "El Valle",
                "Gallo Rojo",
                "Guzman",
                "La Ceiba",
                "La Cruz",
                "La Matanza",
                "La Pedrera",
                "Las Barandas",
                "Las Barracas",
                "Las Malvinas",
                "Las Marias",
                "Longaray",
                "Los Aguacaticos",
                "Los Cardones",
                "Los Jardines",
                "Los Rosales",
                "Negro Primero",
                "Nube Azul",
                "Primero de Mayo",
                "Res. San Andrés",
                "Res. San Antonio",
                "San Antonio",
                "San Luis",
                "Sector Zamora",
                "Sorocaima",
                "Vengas; Km0",
                "Vuelta Feliciano"
              ]
            },
            {
              "nombre": "La Vega",
              "sectores": [
                "El Carmen",
                "El Milagro",
                "El Petróleo",
                "Francisco de Miranda",
                "Juan Pablo II",
                "La Amapola",
                "La Hoyada",
                "La Luz",
                "La Vega",
                "La Vega (Casco Central)",
                "La Veguita",
                "Las Casitas",
                "Las Dos Rosas",
                "Las Torres",
                "Los Cangilones",
                "Los Cujicitos",
                "Los Mangos",
                "Los Naranjos",
                "Los Paraparos",
                "Montalbán I",
                "Montalbán II",
                "Montalbán III",
                "Parte Alta",
                "Paso Malo",
                "San Miguel",
                "Sector Unido",
                "Sinaí",
                "Terrazas de la Vega",
                "Vista Hermosa"
              ]
            },
            {
              "nombre": "Sucre (Catia)",
              "sectores": [
                "Alta Vista",
                "Aragüaney",
                "Blandín",
                "Boquerón",
                "Calle Argentina",
                "Calle Chile",
                "Calle Colombia",
                "Calle Ecuador",
                "Calle Mexico",
                "Casa Blanca",
                "Casalta I",
                "Casalta II",
                "Casalta III",
                "Casco Viejo de Propatria",
                "Ciudad Tablitas",
                "Cutira",
                "El Amparo",
                "El Cuartel",
                "El Limón",
                "El Nazareno",
                "Federico Quiroz",
                "Gato Negro",
                "Gramoven",
                "Guaicaipuro 2",
                "Isaías Medina Angarita",
                "La Cortada de Catia",
                "La Esperanza",
                "La Silsa",
                "Las Lomas",
                "Las Torres",
                "Lomas de Urdaneta",
                "Los Flores de Catia",
                "Los Frailes de Catia",
                "Los Magallanes de Catia",
                "Los Manquitos",
                "Los Pinos",
                "Mario Briceño Iragorry",
                "Morán",
                "Niño Jesús",
                "Nueva Esparta",
                "Pérez Bonalde",
                "Propatria",
                "Propatria (Bloques)",
                "Ruperto Lugo",
                "Tacagua (Vieja y Nueva)",
                "Vista al Mar"
              ]
            }
          ]
        }
      ]
    },
    {
      "nombre": "Miranda",
      "municipios": [
        {
          "nombre": "Carrizal",
          "parroquias": [
            {
              "nombre": "Carrizal",
              "sectores": [
                "Barola",
                "Barrio Bolívar",
                "Brisas de Oriente",
                "C.C. Coliseo",
                "C.C. Don Pedro",
                "C.C. La Cascada",
                "C.C. Tibisay",
                "Casco Central",
                "Corralito",
                "Francisco de Miranda",
                "José Manuel Álvarez",
                "Km 18",
                "La Ladera",
                "Llano Alto",
                "Lomas de Urquía",
                "Montaña Alta",
                "Monte Bello",
                "Potrero del Medio",
                "Res. Alta Vista",
                "Res. Los Eucaliptos",
                "Santa Eduviges",
                "Yerba Buena"
              ]
            }
          ]
        },
        {
          "nombre": "Guaicaipuro",
          "parroquias": [
            {
              "nombre": "Cecilio Acosta",
              "sectores": [
                "Agua Fría",
                "Cachapal",
                "Cantarrana",
                "Casco Central",
                "Cocorote",
                "Cortada del Guayabo",
                "El Aguacatal",
                "El Calvario",
                "El Guamal",
                "El Ingenio",
                "El Limón",
                "El Naranjal",
                "El Peñón",
                "El Prado",
                "Guaicoco",
                "Guareguare",
                "La Crucesita",
                "La Culebrilla",
                "La Oci",
                "Los Amistosos",
                "Los Colorados",
                "San José",
                "San Rafael",
                "Vista Hermosa"
              ]
            },
            {
              "nombre": "Los Teques",
              "sectores": [
                "23 de Enero",
                "Alberto Ravell",
                "Alto Verde",
                "Aquiles Nazoa",
                "Barrio La Cruz",
                "Barrio Miranda I",
                "Barrio Miranda II",
                "Barrio Venezuela",
                "Brisas de Palo Alto",
                "Buenos Aires",
                "C.C. Alí Primera",
                "C.C. Vasconia",
                "Carretera Vieja Caracas Los Teques",
                "Centro Los Teques",
                "Club Hípico",
                "Colinas del Ángel",
                "Colinas del Paso",
                "Cooperativa Guaicaipuro",
                "Cumbre Rojas",
                "El Ayacucho",
                "El Barbecho",
                "El Bosque",
                "El Cabotaje",
                "El Encanto",
                "El Nacional",
                "El Panadero",
                "El Paso",
                "El Pueblo",
                "El Puinky",
                "El Retén",
                "El Rincón",
                "El Tambor",
                "El Trabuco",
                "El Trigo",
                "El Vigía",
                "Guaremal",
                "Hospital Victorino Santaella",
                "José Gregorio",
                "La Estrella",
                "La Fontanera",
                "La Matica",
                "La Quinta",
                "Lagunetica",
                "Las Cadenas",
                "Los Alpes",
                "Los Amarillos",
                "Los Barriales",
                "Los Cerritos",
                "Los Lagos",
                "Los Mangos",
                "Los Nuevos Teques",
                "Macarena Sur",
                "Mal Paso",
                "Manuela Sáenz",
                "Palo Alto",
                "Punta Brava",
                "Quebrada La Virgen",
                "Ramo Verde",
                "Res. Aldebarán",
                "Res. Caracas",
                "Res. El Chorrito",
                "Res. Escorpio",
                "Res. Ímola",
                "Res. Knoop",
                "Res. La Cima",
                "Res. Lagunetica",
                "Res. Miracielos",
                "Res. Miraflores",
                "Res. Parque Las Américas",
                "Res. Río Arriba",
                "Res. Santa María",
                "Res. Tamari",
                "Res. Tinantonia",
                "Res. Tiuna",
                "Res. Trigo Dorado",
                "Res. Yati",
                "Retamal",
                "Rómulo Gallegos",
                "San Omero",
                "Santa Eduviges",
                "Santa Eulalia",
                "Santa Rosa",
                "Solar de la Quinta",
                "Urb. Simón Bolívar",
                "Valle Alto",
                "Zona Industrial El Tambor"
              ]
            },
            {
              "nombre": "San Pedro de los Altos",
              "sectores": [
                "Bosque de Pinos",
                "El Pueblo",
                "Pozo de Rosas",
                "San Pedro"
              ]
            }
          ]
        },
        {
          "nombre": "Los Salias",
          "parroquias": [
            {
              "nombre": "San Antonio de los Altos",
              "sectores": [
                "Agua Linda",
                "Arboleda",
                "Bosque Alegre",
                "C.C. Cepan",
                "C.C. Club de Campo",
                "C.C. Don Blas",
                "C.C. Galería Las Américas",
                "C.C. La Casona 2",
                "C.C. La Colina",
                "Club de Campo",
                "El Amarillo",
                "El Páramo",
                "El Pueblo",
                "El Retiro",
                "El Sitio",
                "Km 8",
                "La Gonzalera",
                "La Guadalupe",
                "La Morita",
                "La Oveja Negra",
                "La Rosaleda",
                "Las Cumbres",
                "Las Minas",
                "Las Polonias",
                "Los Castores",
                "Los Helechos",
                "Los Llaneros",
                "Res. El Rocío",
                "Res. Las Churuatas",
                "Res. OPS",
                "Res. San Antonio",
                "Sierra Brava",
                "Zona Industrial Las Minas"
              ]
            }
          ]
        }
      ]
    }
  ]
};

export interface EvaluacionRecord {
  id: string;
  asesor: string;
  evaluador: string;
  evaluadorRol: EvaluadorRol;
  frecuencia: EvaluacionFrecuencia;
  fecha: string; // YYYY-MM-DD
  estado?: string;
  municipio?: string;
  parroquia?: string;
  sector: string;
  items: Record<string, EvaluacionItemState>;
  observacionesGenerales: string;
  cumplimientoPct: number;
  puntuacionTotal?: number;
  puntuacionMaxima?: number;
  puntuacionPromedio?: number;
  itemsCumplidos: number;
  itemsTotal: number;
  factorScores: Record<string, FactorScore>;
  createdAt: string;
  updatedAt: string;
}

export function formatFrecuencia(f?: string): EvaluacionFrecuencia {
  if (!f) return "Diaria";
  const clean = f.toLowerCase().trim();
  if (clean === "diaria") return "Diaria";
  if (clean === "semanal") return "Semanal";
  if (clean === "mensual") return "Mensual";
  return "Diaria";
}

export function formatEvaluadorRol(r?: string): EvaluadorRol {
  if (!r) return "Supervisor";
  const clean = r.toLowerCase().trim();
  if (clean === "supervisor") return "Supervisor";
  if (clean === "asesor_impulsador" || clean === "asesor impulsador" || clean === "impulsador") return "Asesor Impulsador";
  if (clean === "coordinador" || clean === "admin") return "Coordinador";
  return "Supervisor";
}

export const EVALUADOR_ROLES_OPTIONS: { value: EvaluadorRol; label: string }[] = [
  { value: "Supervisor", label: "Supervisor" },
  { value: "Asesor Impulsador", label: "Asesor Impulsador" },
  { value: "Coordinador", label: "Coordinador" },
];

export const EVALUACION_FRECUENCIAS_OPTIONS: {
  value: EvaluacionFrecuencia;
  label: string;
}[] = [
  { value: "Diaria", label: "Diaria" },
  { value: "Semanal", label: "Semanal" },
  { value: "Mensual", label: "Mensual" },
];

export function calculateEvaluationScores(items: Record<string, EvaluacionItemState>) {
  let puntuacionTotal = 0;
  const puntuacionMaxima = TOTAL_EVALUACION_ITEMS * 5; // 150 pts max
  const factorScores: Record<string, FactorScore> = {};

  EVALUACION_FACTORES.forEach((factor) => {
    let factorPuntos = 0;
    const factorMax = factor.items.length * 5;

    factor.items.forEach((item) => {
      const it = items[item.id];
      let p = 5;
      if (it) {
        if (typeof it.puntuacion === "number" && !isNaN(it.puntuacion)) {
          p = Math.max(1, Math.min(5, Math.round(it.puntuacion)));
        } else if (it.cumple !== undefined) {
          const isCumple = typeof it.cumple === "boolean"
            ? it.cumple
            : String(it.cumple).toLowerCase() === "sí" ||
              String(it.cumple).toLowerCase() === "si" ||
              String(it.cumple).toLowerCase() === "true";
          p = isCumple ? 5 : 1;
        }
      }
      factorPuntos += p;
      puntuacionTotal += p;
    });

    const factorPromedio = factor.items.length > 0
      ? Number((factorPuntos / factor.items.length).toFixed(1))
      : 0;
    const factorPct = factorMax > 0
      ? Math.round((factorPuntos / factorMax) * 100)
      : 0;

    factorScores[factor.id] = {
      puntos: factorPuntos,
      puntosMax: factorMax,
      promedio: factorPromedio,
      cumplidos: factorPuntos,
      total: factorMax,
      pct: factorPct,
    };
  });

  const promedio = TOTAL_EVALUACION_ITEMS > 0
    ? Number((puntuacionTotal / TOTAL_EVALUACION_ITEMS).toFixed(1))
    : 0;

  const cumplimientoPct =
    puntuacionMaxima > 0
      ? Math.round((puntuacionTotal / puntuacionMaxima) * 100)
      : 0;

  return {
    puntuacionTotal,
    puntuacionMaxima,
    puntuacionPromedio: promedio,
    promedio,
    itemsCumplidos: puntuacionTotal,
    itemsTotal: puntuacionMaxima,
    cumplimientoPct,
    factorScores,
  };
}

export function getCumplimientoLevel(pct: number): {
  label: string;
  colorClass: string;
  dotColorClass: string;
} {
  if (pct >= 90) {
    return {
      label: "Excelente",
      colorClass: "text-emerald-700",
      dotColorClass: "bg-emerald-500",
    };
  }
  if (pct >= 75) {
    return {
      label: "Satisfactorio",
      colorClass: "text-neutral-900",
      dotColorClass: "bg-neutral-800",
    };
  }
  if (pct >= 60) {
    return {
      label: "En desarrollo",
      colorClass: "text-amber-700",
      dotColorClass: "bg-amber-500",
    };
  }
  return {
    label: "Requiere apoyo",
    colorClass: "text-red-700",
    dotColorClass: "bg-red-500",
  };
}

export interface AdvisorChecklistRecord {
  id: string;
  asesor: string;
  fecha: string; // YYYY-MM-DD
  items: Record<string, boolean>; // itemId -> boolean (Sí / No)
  cumplimientoPct: number;
  itemsCumplidos: number;
  itemsTotal: number;
  factorScores: Record<string, { cumplidos: number; total: number; pct: number }>;
  createdAt: string;
}

export function calculateChecklistScores(items: Record<string, boolean>) {
  let totalCumplidos = 0;
  const factorScores: Record<string, { cumplidos: number; total: number; pct: number }> = {};

  EVALUACION_FACTORES.forEach((factor) => {
    let factorCumplidos = 0;
    factor.items.forEach((item) => {
      if (items[item.id]) {
        factorCumplidos++;
        totalCumplidos++;
      }
    });
    const pct =
      factor.items.length > 0
        ? Math.round((factorCumplidos / factor.items.length) * 100)
        : 0;
    factorScores[factor.id] = {
      cumplidos: factorCumplidos,
      total: factor.items.length,
      pct,
    };
  });

  const cumplimientoPct =
    TOTAL_EVALUACION_ITEMS > 0
      ? Math.round((totalCumplidos / TOTAL_EVALUACION_ITEMS) * 100)
      : 0;

  return {
    totalCumplidos,
    totalItems: TOTAL_EVALUACION_ITEMS,
    cumplimientoPct,
    factorScores,
    level: getCumplimientoLevel(cumplimientoPct),
  };
}

export function getChecklistCompletionStatus(items: Record<string, boolean>) {
  let answeredCount = 0;
  const factorStatus: Record<
    string,
    { answered: number; total: number; isComplete: boolean }
  > = {};

  EVALUACION_FACTORES.forEach((factor) => {
    let factorAnswered = 0;
    factor.items.forEach((item) => {
      if (items[item.id] !== undefined) {
        factorAnswered++;
        answeredCount++;
      }
    });
    factorStatus[factor.id] = {
      answered: factorAnswered,
      total: factor.items.length,
      isComplete: factorAnswered === factor.items.length,
    };
  });

  return {
    answeredCount,
    totalItems: TOTAL_EVALUACION_ITEMS,
    pendingCount: TOTAL_EVALUACION_ITEMS - answeredCount,
    isComplete: answeredCount === TOTAL_EVALUACION_ITEMS,
    factorStatus,
  };
}


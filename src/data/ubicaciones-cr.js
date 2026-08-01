// División Territorial Administrativa de Costa Rica (DGT - Hacienda)

export const PROVINCIAS_CR = [
  { id: '1', nombre: 'San José' },
  { id: '2', nombre: 'Alajuela' },
  { id: '3', nombre: 'Cartago' },
  { id: '4', nombre: 'Heredia' },
  { id: '5', nombre: 'Guanacaste' },
  { id: '6', nombre: 'Puntarenas' },
  { id: '7', nombre: 'Limón' }
];

export const CANTONES_CR = {
  '1': [ // San José
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'Escazú' },
    { id: '03', nombre: 'Desamparados' },
    { id: '04', nombre: 'Puriscal' },
    { id: '05', nombre: 'Tarrazú' },
    { id: '06', nombre: 'Aserrí' },
    { id: '07', nombre: 'Mora' },
    { id: '08', nombre: 'Goicoechea' },
    { id: '09', nombre: 'Santa Ana' },
    { id: '10', nombre: 'Alajuelita' },
    { id: '11', nombre: 'Vázquez de Coronado' },
    { id: '12', nombre: 'Acosta' },
    { id: '13', nombre: 'Tibás' },
    { id: '14', nombre: 'Moravia' },
    { id: '15', nombre: 'Montes de Oca' },
    { id: '16', nombre: 'Turrubares' },
    { id: '17', nombre: 'Dota' },
    { id: '18', nombre: 'Curridabat' },
    { id: '19', nombre: 'Pérez Zeledón' },
    { id: '20', nombre: 'León Cortés Castro' }
  ],
  '2': [ // Alajuela
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'San Ramón' },
    { id: '03', nombre: 'Grecia' },
    { id: '04', nombre: 'San Mateo' },
    { id: '05', nombre: 'Atenas' },
    { id: '06', nombre: 'Naranjo' },
    { id: '07', nombre: 'Palmares' },
    { id: '08', nombre: 'Poás' },
    { id: '09', nombre: 'Orotina' },
    { id: '10', nombre: 'San Carlos' },
    { id: '11', nombre: 'Zarcero' },
    { id: '12', nombre: 'Sarchí' },
    { id: '13', nombre: 'Upala' },
    { id: '14', nombre: 'Los Chiles' },
    { id: '15', nombre: 'Guatuso' },
    { id: '16', nombre: 'Río Cuarto' }
  ],
  '3': [ // Cartago
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'Paraíso' },
    { id: '03', nombre: 'La Unión' },
    { id: '04', nombre: 'Jiménez' },
    { id: '05', nombre: 'Turrialba' },
    { id: '06', nombre: 'Alvarado' },
    { id: '07', nombre: 'Oreamuno' },
    { id: '08', nombre: 'El Guarco' }
  ],
  '4': [ // Heredia
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'Barva' },
    { id: '03', nombre: 'Santo Domingo' },
    { id: '04', nombre: 'Santa Bárbara' },
    { id: '05', nombre: 'San Rafael' },
    { id: '06', nombre: 'San Isidro' },
    { id: '07', nombre: 'Belén' },
    { id: '08', nombre: 'Flores' },
    { id: '09', nombre: 'San Pablo' },
    { id: '10', nombre: 'Sarapiquí' }
  ],
  '5': [ // Guanacaste
    { id: '01', nombre: 'Liberia' },
    { id: '02', nombre: 'Nicoya' },
    { id: '03', nombre: 'Santa Cruz' },
    { id: '04', nombre: 'Bagaces' },
    { id: '05', nombre: 'Carrillo' },
    { id: '06', nombre: 'Cañas' },
    { id: '07', nombre: 'Abangares' },
    { id: '08', nombre: 'Tilarán' },
    { id: '09', nombre: 'Nandayure' },
    { id: '10', nombre: 'La Cruz' },
    { id: '11', nombre: 'Hojancha' }
  ],
  '6': [ // Puntarenas
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'Esparza' },
    { id: '03', nombre: 'Buenos Aires' },
    { id: '04', nombre: 'Montes de Oro' },
    { id: '05', nombre: 'Osa' },
    { id: '06', nombre: 'Quepos' },
    { id: '07', nombre: 'Golfito' },
    { id: '08', nombre: 'Coto Brus' },
    { id: '09', nombre: 'Parrita' },
    { id: '10', nombre: 'Corredores' },
    { id: '11', nombre: 'Garabito' },
    { id: '12', nombre: 'Monteverde' },
    { id: '13', nombre: 'Puerto Jiménez' }
  ],
  '7': [ // Limón
    { id: '01', nombre: 'Central' },
    { id: '02', nombre: 'Pococí' },
    { id: '03', nombre: 'Siquirres' },
    { id: '04', nombre: 'Talamanca' },
    { id: '05', nombre: 'Matina' },
    { id: '06', nombre: 'Guácimo' }
  ]
};

export const DISTRITOS_CR = {
  // San José Central (1-01)
  '1-01': ['Carmen', 'Merced', 'Hospital', 'Catedral', 'Zapote', 'San Francisco de Dos Ríos', 'Uruca', 'Mata Redonda', 'Pavas', 'Hatillo', 'San Sebastián'],
  // Escazú (1-02)
  '1-02': ['Escazú', 'San Antonio', 'San Rafael'],
  // Desamparados (1-03)
  '1-03': ['Desamparados', 'San Miguel', 'San Juan de Dios', 'San Rafael Arriba', 'San Antonio', 'Frailes', 'Patarrá', 'San Cristóbal', 'Rosario', 'Damas', 'San Rafael Abajo', 'Gravilias', 'Los Guido'],
  // Puriscal (1-04)
  '1-04': ['Santiago', 'Mercedes Sur', 'Barbacoas', 'Grifo Alto', 'San Rafael', 'Candelaria', 'Desamparaditos', 'San Antonio', 'Chires'],
  // Goicoechea (1-08)
  '1-08': ['Guadalupe', 'San Francisco', 'Calle Blancos', 'Mata de Plátano', 'Ipís', 'Rancho Redondo', 'Purral'],
  // Santa Ana (1-09)
  '1-09': ['Santa Ana', 'Salitral', 'Pozos', 'Uruca', 'Piedades', 'Brasil'],
  // Alajuelita (1-10)
  '1-10': ['Alajuelita', 'San Josecito', 'San Antonio', 'Concepción', 'San Felipe'],
  // Vázquez de Coronado (1-11)
  '1-11': ['San Isidro', 'San Rafael', 'Dulce Nombre de Jesús', 'Patalillo', 'Cascajal'],
  // Tibás (1-13)
  '1-13': ['San Juan', 'Cinco Esquinas', 'Anselmo Llorente', 'León XIII', 'Colima'],
  // Moravia (1-14)
  '1-14': ['San Vicente', 'San Jerónimo', 'La Trinidad'],
  // Montes de Oca (1-15)
  '1-15': ['San Pedro', 'Sabanilla', 'Mercedes', 'San Rafael'],
  // Curridabat (1-18)
  '1-18': ['Curridabat', 'Granadilla', 'Sánchez', 'Tirrases'],
  // Pérez Zeledón (1-19)
  '1-19': ['San Isidro de El General', 'General', 'Daniel Flores', 'Rivas', 'San Pedro', 'Platanares', 'Pejibaye', 'Cajón', 'Barú', 'Río Nuevo', 'Páramo', 'La Amistad'],

  // Alajuela Central (2-01)
  '2-01': ['Alajuela', 'San José', 'Carrizal', 'San Antonio', 'Guácima', 'San Isidro', 'Sabanilla', 'San Rafael', 'Río Segundo', 'Desamparados', 'Turrúcares', 'Tambor', 'Garita', 'Sarapiquí'],
  // San Ramón (2-02)
  '2-02': ['San Ramón', 'Santiago', 'San Juan', 'Piedades Norte', 'Piedades Sur', 'San Rafael', 'San Isidro', 'Angeles', 'Alfaro', 'Volio', 'Concepción', 'Zapotal', 'Peñas Blancas', 'San Lorenzo'],
  // Grecia (2-03)
  '2-03': ['Grecia', 'San Isidro', 'San José', 'San Roque', 'Tacares', 'Bridge', 'Bolívar'],
  // Atenas (2-05)
  '2-05': ['Atenas', 'Jesús', 'Mercedes', 'San Isidro', 'Concepción', 'San José', 'Santa Eulalia', 'Escobal'],
  // Naranjo (2-06)
  '2-06': ['Naranjo', 'San Miguel', 'San José', 'Cirrí Sur', 'San Jerónimo', 'San Juan', 'El Rosario', 'Palmitos'],
  // Palmares (2-07)
  '2-07': ['Palmares', 'Zaragoza', 'Buenos Aires', 'Santiago', 'Candelaria', 'Esquipulas', 'La Granja'],
  // Poás (2-08)
  '2-08': ['San Pedro', 'San Juan', 'San Rafael', 'Carrillos', 'Sabana Redonda'],
  // San Carlos (2-10)
  '2-10': ['Quesada', 'Florencia', 'Buenavista', 'Aguas Zarcas', 'Venecia', 'Pital', 'La Fortuna', 'La Tigra', 'La Palmera', 'Venado', 'Cutris', 'Monterrey', 'Poco Sol'],
  // Zarcero (2-11)
  '2-11': ['Zarcero', 'Laguna', 'Tapesco', 'Guadalupe', 'Palmira', 'Zapote', 'Brisas'],

  // Cartago Central (3-01)
  '3-01': ['Oriental', 'Occidental', 'Carmen', 'San Nicolás', 'Aguacaliente', 'Guadalupe', 'Corralillo', 'Tierra Blanca', 'Dulce Nombre', 'Llano Grande', 'Quebradilla'],
  // Paraíso (3-02)
  '3-02': ['Paraíso', 'Santiago', 'Orosi', 'Cachí', 'Llanos de Santa Lucía'],
  // La Unión (3-03)
  '3-03': ['Tres Ríos', 'San Diego', 'San Juan', 'San Rafael', 'Concepción', 'Dulce Nombre', 'San Ramón', 'Río Azul'],
  // Turrialba (3-05)
  '3-05': ['Turrialba', 'La Suiza', 'Peralta', 'Santa Cruz', 'Santa Teresita', 'Pavones', 'Tuis', 'Tayutic', 'Santa Rosa', 'Tres Equis', 'La Isabel', 'Chirripó'],
  // Oreamuno (3-07)
  '3-07': ['San Rafael', 'Cot', 'Potrero Cerrado', 'Cipreses', 'Santa Rosa'],
  // El Guarco (3-08)
  '3-08': ['El Tejar', 'San Isidro', 'Tobosi', 'Patarrá'],

  // Heredia Central (4-01)
  '4-01': ['Heredia', 'Mercedes', 'San Francisco', 'Ulloa', 'Vara Blanca'],
  // Barva (4-02)
  '4-02': ['Barva', 'San Pedro', 'San Pablo', 'San Roque', 'Santa Lucía', 'San José de la Montaña'],
  // Santo Domingo (4-03)
  '4-03': ['Santo Domingo', 'San Vicente', 'San Miguel', 'Paracito', 'Santo Tomás', 'Santa Rosa', 'Targas', 'Pará'],
  // Santa Bárbara (4-04)
  '4-04': ['Santa Bárbara', 'San Pedro', 'San Juan', 'Jesús', 'Santo Domingo', 'Puraba'],
  // San Rafael (4-05)
  '4-05': ['San Rafael', 'San Josecito', 'Santiago', 'Angeles', 'Concepción'],
  // San Isidro (4-06)
  '4-06': ['San Isidro', 'San José', 'Concepción', 'San Francisco'],
  // Belén (4-07)
  '4-07': ['San Antonio', 'La Ribera', 'La Asunción'],
  // Flores (4-08)
  '4-08': ['San Joaquín', 'Barrantes', 'Llorente'],
  // San Pablo (4-09)
  '4-09': ['San Pablo', 'Rincón de Sabanilla'],

  // Liberia (5-01)
  '5-01': ['Liberia', 'Cañas Dulces', 'Mayorga', 'Nacascolo', 'Curubandé'],
  // Nicoya (5-02)
  '5-02': ['Nicoya', 'Mansión', 'San Antonio', 'Quebrada Honda', 'Sámara', 'Nosara', 'Belén de Nosarita'],
  // Santa Cruz (5-03)
  '5-03': ['Santa Cruz', 'Bolsón', '27 de Abril', 'Tempate', 'Cartagena', 'Cuajiniquil', 'Diriá', 'Cabo Velas', 'Tamarindo'],
  // Carrillo (5-05)
  '5-05': ['Filadelfia', 'Palmira', 'Sardinal', 'Belén'],
  // Cañas (5-06)
  '5-06': ['Cañas', 'Palmira', 'San Miguel', 'Bebedero', 'Porozal'],
  // Tilarán (5-08)
  '5-08': ['Tilarán', 'Quebrada Grande', 'Tronadora', 'Santa Rosa', 'Líbano', 'Tierras Morenas', 'Arenal'],

  // Puntarenas Central (6-01)
  '6-01': ['Puntarenas', 'Pitahaya', 'Chacarita', 'Chira', 'Acapulco', 'El Roble', 'Arancibia'],
  // Esparza (6-02)
  '6-02': ['Espíritu Santo', 'San Juan Grande', 'Macacona', 'San Rafael', 'San Jerónimo', 'Caldera'],
  // Quepos (6-06)
  '6-06': ['Quepos', 'Savegre', 'Naranjito'],
  // Garabito (6-11)
  '6-11': ['Jacó', 'Tárcoles', 'Lagunillas'],

  // Limón Central (7-01)
  '7-01': ['Limón', 'Valle La Estrella', 'Río Blanco', 'Matama'],
  // Pococí (7-02)
  '7-02': ['Guápiles', 'Jiménez', 'Rita', 'Roxana', 'Cariari', 'Colorado', 'La Colonia'],
  // Siquirres (7-03)
  '7-03': ['Siquirres', 'Pacuarito', 'Florida', 'Germania', 'El Cairo', 'Alegría', 'Reventazón'],
  // Guácimo (7-06)
  '7-06': ['Guácimo', 'Mercedes', 'Pocora', 'Río Jiménez', 'Duacarí']
};

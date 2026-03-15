/**
 * Vehicle catalog — curated list of automobile manufacturers and models.
 * Static data served by Next.js, no external API dependency.
 * To update: edit the CATALOG object below and redeploy.
 */

/** Make → Model[] mapping. Models sorted alphabetically. */
const CATALOG: Record<string, string[]> = {
  "Alfa Romeo": ["4C", "8C Competizione", "Giulia", "Giulia GTA", "Giulia Quadrifoglio", "Giulietta", "GTV", "MiTo", "Montreal", "Spider", "Stelvio", "Tonale"],
  "Alpine": ["A110", "A110 R", "A110 S", "A290", "A310", "A610"],
  "Aston Martin": ["DB4", "DB5", "DB6", "DB7", "DB9", "DB11", "DB12", "DBS", "DBS Superleggera", "DBX", "DBX707", "One-77", "Rapide", "V8 Vantage", "V12 Vantage", "Valkyrie", "Valhalla", "Vanquish", "Vulcan"],
  "Audi": ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "e-tron", "e-tron GT", "Q3", "Q5", "Q7", "Q8", "R8", "RS3", "RS4", "RS5", "RS6", "RS7", "RS Q8", "S3", "S4", "S5", "S6", "S7", "S8", "SQ5", "SQ7", "SQ8", "TT", "TT RS"],
  "Bentley": ["Arnage", "Azure", "Bacalar", "Batur", "Bentayga", "Brooklands", "Continental GT", "Continental GTC", "Flying Spur", "Mulsanne", "Speed Six"],
  "BMW": ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "6 Series", "7 Series", "8 Series", "i3", "i4", "i5", "i7", "i8", "iX", "M1", "M2", "M3", "M4", "M5", "M6", "M8", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "XM", "Z3", "Z4", "Z8"],
  "Bugatti": ["Centodieci", "Chiron", "Divo", "EB110", "Mistral", "Tourbillon", "Veyron"],
  "Cadillac": ["ATS", "CT4", "CT5", "CTS", "Eldorado", "Escalade", "Lyriq", "XT4", "XT5", "XT6"],
  "Chevrolet": ["Camaro", "Camaro ZL1", "Corvette", "Corvette C2 Stingray", "Corvette C3", "Corvette C4", "Corvette C5", "Corvette C6", "Corvette C7", "Corvette C8", "Corvette E-Ray", "Corvette Z06", "Corvette ZR1", "Impala"],
  "Chrysler": ["300", "Crossfire", "Viper"],
  "Citroën": ["C3", "C4", "C5", "DS3", "DS4", "DS5", "SM"],
  "Czinger": ["21C"],
  "Datsun": ["240Z", "260Z", "280Z", "280ZX"],
  "De Tomaso": ["Mangusta", "P72", "Pantera"],
  "Dodge": ["Challenger", "Challenger SRT Demon", "Challenger SRT Hellcat", "Charger", "Charger SRT Hellcat", "Viper", "Viper ACR"],
  "Ferrari": ["250 GTO", "275 GTB", "288 GTO", "296 GTB", "296 GTS", "308 GTB", "328 GTB", "348", "355", "360 Modena", "430 Scuderia", "458 Italia", "458 Speciale", "488 GTB", "488 Pista", "599 GTB", "812 Competizione", "812 Superfast", "California", "Daytona SP3", "Dino 246", "Enzo", "F12 Berlinetta", "F12tdf", "F40", "F50", "F8 Tributo", "LaFerrari", "Monza SP1", "Monza SP2", "Portofino", "Purosangue", "Roma", "SF90 Stradale", "SF90 XX", "Testarossa"],
  "Fiat": ["124 Spider", "500", "500 Abarth", "500e"],
  "Ford": ["Bronco", "Focus RS", "GT", "GT40", "Mustang", "Mustang GT", "Mustang Mach 1", "Mustang Mach-E", "Mustang Shelby GT350", "Mustang Shelby GT500", "RS200"],
  "Genesis": ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
  "Gordon Murray": ["T.33", "T.50"],
  "Hennessey": ["Venom F5", "Venom GT"],
  "Hispano Suiza": ["Carmen"],
  "Honda": ["Civic Type R", "NSX", "S2000", "S660"],
  "Hyundai": ["Ioniq 5 N", "N Vision 74", "Veloster N"],
  "Infiniti": ["G37", "Q50", "Q60"],
  "Jaguar": ["C-Type", "D-Type", "E-Type", "F-Pace SVR", "F-Type", "F-Type R", "XE SV Project 8", "XJ", "XJ220", "XJR-15", "XK", "XKR-S"],
  "Jeep": ["Grand Cherokee", "Grand Cherokee SRT", "Grand Cherokee Trackhawk", "Wrangler"],
  "Kia": ["EV6 GT", "Stinger GT"],
  "Koenigsegg": ["Agera", "Agera RS", "CC8S", "CCX", "Gemera", "Jesko", "Jesko Absolut", "One:1", "Regera"],
  "Lamborghini": ["Aventador", "Aventador SVJ", "Centenario", "Countach", "Countach LPI 800-4", "Diablo", "Gallardo", "Huracán", "Huracán Performante", "Huracán STO", "Huracán Tecnica", "Miura", "Murciélago", "Revuelto", "Sián", "Temerario", "Urus", "Urus Performante", "Veneno"],
  "Lancia": ["037", "Delta", "Stratos"],
  "Land Rover": ["Defender", "Range Rover", "Range Rover Sport", "Range Rover Sport SVR", "Range Rover Velar"],
  "Lexus": ["IS F", "LC 500", "LFA", "RC F", "RX"],
  "Lincoln": ["Continental"],
  "Lister": ["Knobbly", "Stealth"],
  "Lotus": ["Elise", "Emira", "Esprit", "Europa", "Evija", "Evora", "Exige"],
  "Lucid": ["Air", "Air Sapphire", "Gravity"],
  "Maserati": ["3500 GT", "Bora", "Ghibli", "GranTurismo", "Grecale", "Levante", "MC12", "MC20", "Merak", "Quattroporte"],
  "Maybach": ["57", "62", "Exelero", "S 580", "S 680"],
  "Mazda": ["MX-5", "MX-5 RF", "RX-7", "RX-8", "RX-Vision"],
  "McLaren": ["540C", "570S", "600LT", "620R", "650S", "675LT", "720S", "750S", "765LT", "Artura", "Elva", "F1", "GT", "MP4-12C", "P1", "Senna", "Solus GT", "Speedtail", "W1"],
  "Mercedes-Benz": ["190E Evo II", "300 SL", "A 45 AMG", "AMG GT", "AMG GT Black Series", "AMG GT R", "AMG One", "C 63 AMG", "CL", "CLK GTR", "CLS", "E 63 AMG", "EQS", "G 63 AMG", "GLE Coupé AMG", "GLS Maybach", "GT 63 AMG", "S-Class", "SL", "SLK", "SLR McLaren", "SLS AMG"],
  "MG": ["B", "MGA", "Midget", "TF"],
  "MINI": ["Cooper JCW", "Cooper S", "Clubman JCW", "GP"],
  "Mitsubishi": ["Lancer Evolution", "3000GT"],
  "Morgan": ["Aero 8", "Plus Four", "Plus Six", "Super 3"],
  "Nissan": ["350Z", "370Z", "GT-R", "GT-R Nismo", "Skyline R32", "Skyline R33", "Skyline R34", "Z"],
  "Noble": ["M400", "M500", "M600"],
  "Opel": ["Speedster"],
  "Pagani": ["Huayra", "Huayra BC", "Huayra R", "Utopia", "Zonda", "Zonda Cinque", "Zonda R"],
  "Peugeot": ["205 GTI", "208 GTi", "308 GTi", "508 PSE", "RCZ"],
  "Pininfarina": ["Battista"],
  "Pontiac": ["Firebird", "GTO"],
  "Porsche": ["356", "550 Spyder", "718 Boxster", "718 Cayman", "718 Spyder", "904", "911 Carrera", "911 GT2 RS", "911 GT3", "911 GT3 RS", "911 R", "911 Sport Classic", "911 Targa", "911 Turbo", "911 Turbo S", "914", "918 Spyder", "928", "935", "944", "959", "962", "968", "Boxster", "Carrera GT", "Cayenne", "Cayenne Turbo GT", "Cayman", "Macan", "Panamera", "Taycan", "Taycan Turbo S"],
  "Radical": ["SR3", "SR8", "SR10"],
  "Renault": ["Alpine A110", "Clio RS", "Clio V6", "Megane RS"],
  "Rimac": ["C_Two", "Nevera"],
  "Rivian": ["R1S", "R1T"],
  "Rolls-Royce": ["Corniche", "Cullinan", "Dawn", "Ghost", "Phantom", "Silver Shadow", "Silver Spirit", "Spectre", "Wraith"],
  "Saleen": ["S7"],
  "Shelby": ["Cobra", "Daytona Coupe", "GT350", "GT500", "Super Snake"],
  "SSC": ["Tuatara", "Ultimate Aero"],
  "Subaru": ["BRZ", "Impreza WRX STI", "WRX"],
  "Suzuki": ["Cappuccino", "Jimny", "Swift Sport"],
  "Tesla": ["Model 3", "Model S", "Model S Plaid", "Model X", "Model Y", "Roadster", "Cybertruck"],
  "Toyota": ["2000GT", "AE86", "GR Corolla", "GR Supra", "GR Yaris", "GR86", "Land Cruiser", "MR2", "Supra"],
  "TVR": ["Cerbera", "Chimaera", "Griffith", "Sagaris", "Tuscan"],
  "Volkswagen": ["Arteon R", "Golf GTI", "Golf R", "ID.3", "ID.4", "ID.Buzz", "Scirocco R", "T-Roc R"],
  "Volvo": ["C70", "P1800", "Polestar 1"],
  "Zenvo": ["ST1", "TSR-S"],
};

/** Sorted list of all makes */
export const MAKE_NAMES: string[] = Object.keys(CATALOG).sort();

/** Get models for a given make */
export function getModelsForMake(make: string): string[] {
  return CATALOG[make] || [];
}

/** Generate year options from current year+1 down to 1920 */
export function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear() + 1;
  const years: { value: string; label: string }[] = [];
  for (let y = current; y >= 1920; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}

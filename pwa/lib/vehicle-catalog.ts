/**
 * Prestige & classic vehicle catalog for cascading Make → Model → Year selection.
 * Years represent known production ranges. Users can still type a custom value.
 */

export interface ModelEntry {
  name: string;
  years: [number, number]; // [from, to]
}

export interface MakeEntry {
  name: string;
  models: ModelEntry[];
}

export const VEHICLE_CATALOG: MakeEntry[] = [
  {
    name: "Ferrari",
    models: [
      { name: "250 GTO", years: [1962, 1964] },
      { name: "275 GTB", years: [1964, 1968] },
      { name: "Dino 246", years: [1969, 1974] },
      { name: "Daytona", years: [1968, 1973] },
      { name: "308 GTB", years: [1975, 1985] },
      { name: "328 GTB", years: [1985, 1989] },
      { name: "288 GTO", years: [1984, 1987] },
      { name: "Testarossa", years: [1984, 1996] },
      { name: "F40", years: [1987, 1992] },
      { name: "348", years: [1989, 1995] },
      { name: "F50", years: [1995, 1997] },
      { name: "355", years: [1994, 1999] },
      { name: "360 Modena", years: [1999, 2005] },
      { name: "Enzo", years: [2002, 2004] },
      { name: "430 Scuderia", years: [2004, 2009] },
      { name: "458 Italia", years: [2009, 2015] },
      { name: "California", years: [2008, 2017] },
      { name: "F12 Berlinetta", years: [2012, 2017] },
      { name: "LaFerrari", years: [2013, 2018] },
      { name: "488 GTB", years: [2015, 2019] },
      { name: "812 Superfast", years: [2017, 2024] },
      { name: "SF90 Stradale", years: [2019, 2025] },
      { name: "296 GTB", years: [2022, 2025] },
      { name: "Roma", years: [2020, 2025] },
      { name: "Purosangue", years: [2023, 2025] },
    ],
  },
  {
    name: "Porsche",
    models: [
      { name: "356", years: [1948, 1965] },
      { name: "911 (Classic)", years: [1964, 1989] },
      { name: "911 (964)", years: [1989, 1994] },
      { name: "911 (993)", years: [1994, 1998] },
      { name: "911 (996)", years: [1998, 2005] },
      { name: "911 (997)", years: [2004, 2012] },
      { name: "911 (991)", years: [2011, 2019] },
      { name: "911 (992)", years: [2019, 2025] },
      { name: "914", years: [1969, 1976] },
      { name: "928", years: [1977, 1995] },
      { name: "944", years: [1982, 1991] },
      { name: "959", years: [1986, 1993] },
      { name: "968", years: [1992, 1995] },
      { name: "Boxster", years: [1996, 2025] },
      { name: "Cayman", years: [2005, 2025] },
      { name: "Carrera GT", years: [2003, 2007] },
      { name: "918 Spyder", years: [2013, 2015] },
      { name: "Cayenne", years: [2002, 2025] },
      { name: "Panamera", years: [2009, 2025] },
      { name: "Taycan", years: [2020, 2025] },
      { name: "Macan", years: [2014, 2025] },
    ],
  },
  {
    name: "Lamborghini",
    models: [
      { name: "Miura", years: [1966, 1973] },
      { name: "Countach", years: [1974, 1990] },
      { name: "Diablo", years: [1990, 2001] },
      { name: "Murciélago", years: [2001, 2010] },
      { name: "Gallardo", years: [2003, 2013] },
      { name: "Aventador", years: [2011, 2022] },
      { name: "Huracán", years: [2014, 2024] },
      { name: "Urus", years: [2018, 2025] },
      { name: "Revuelto", years: [2024, 2025] },
      { name: "Temerario", years: [2025, 2025] },
    ],
  },
  {
    name: "McLaren",
    models: [
      { name: "F1", years: [1992, 1998] },
      { name: "MP4-12C", years: [2011, 2014] },
      { name: "P1", years: [2013, 2015] },
      { name: "650S", years: [2014, 2017] },
      { name: "570S", years: [2015, 2021] },
      { name: "720S", years: [2017, 2023] },
      { name: "Senna", years: [2018, 2020] },
      { name: "Speedtail", years: [2019, 2021] },
      { name: "GT", years: [2019, 2025] },
      { name: "Artura", years: [2022, 2025] },
      { name: "750S", years: [2023, 2025] },
      { name: "W1", years: [2025, 2025] },
    ],
  },
  {
    name: "Bugatti",
    models: [
      { name: "EB110", years: [1991, 1995] },
      { name: "Veyron", years: [2005, 2015] },
      { name: "Chiron", years: [2016, 2024] },
      { name: "Divo", years: [2019, 2021] },
      { name: "Centodieci", years: [2022, 2023] },
      { name: "Mistral", years: [2024, 2025] },
      { name: "Tourbillon", years: [2025, 2025] },
    ],
  },
  {
    name: "Aston Martin",
    models: [
      { name: "DB4", years: [1958, 1963] },
      { name: "DB5", years: [1963, 1965] },
      { name: "DB6", years: [1965, 1971] },
      { name: "V8 Vantage (Classic)", years: [1977, 1989] },
      { name: "DB7", years: [1994, 2004] },
      { name: "Vanquish", years: [2001, 2007] },
      { name: "DB9", years: [2004, 2016] },
      { name: "V8 Vantage", years: [2005, 2017] },
      { name: "DBS", years: [2007, 2012] },
      { name: "One-77", years: [2009, 2012] },
      { name: "Vulcan", years: [2015, 2016] },
      { name: "DB11", years: [2016, 2025] },
      { name: "DBS Superleggera", years: [2018, 2023] },
      { name: "Valhalla", years: [2024, 2025] },
      { name: "Valkyrie", years: [2022, 2025] },
      { name: "DBX", years: [2020, 2025] },
    ],
  },
  {
    name: "Bentley",
    models: [
      { name: "Continental GT", years: [2003, 2025] },
      { name: "Continental GTC", years: [2006, 2025] },
      { name: "Flying Spur", years: [2005, 2025] },
      { name: "Mulsanne", years: [2010, 2020] },
      { name: "Bentayga", years: [2016, 2025] },
      { name: "Bacalar", years: [2021, 2023] },
      { name: "Batur", years: [2024, 2025] },
    ],
  },
  {
    name: "Rolls-Royce",
    models: [
      { name: "Silver Shadow", years: [1965, 1980] },
      { name: "Corniche", years: [1971, 1995] },
      { name: "Silver Spirit", years: [1980, 1998] },
      { name: "Phantom (VII)", years: [2003, 2017] },
      { name: "Phantom (VIII)", years: [2017, 2025] },
      { name: "Ghost", years: [2009, 2025] },
      { name: "Wraith", years: [2013, 2023] },
      { name: "Dawn", years: [2015, 2023] },
      { name: "Cullinan", years: [2018, 2025] },
      { name: "Spectre", years: [2023, 2025] },
    ],
  },
  {
    name: "Mercedes-Benz",
    models: [
      { name: "300 SL", years: [1954, 1963] },
      { name: "SL (R107)", years: [1971, 1989] },
      { name: "SL (R129)", years: [1989, 2001] },
      { name: "CLK GTR", years: [1998, 1999] },
      { name: "SLR McLaren", years: [2003, 2010] },
      { name: "SLS AMG", years: [2010, 2015] },
      { name: "AMG GT", years: [2014, 2025] },
      { name: "AMG GT Black Series", years: [2020, 2022] },
      { name: "AMG One", years: [2022, 2025] },
      { name: "S-Class", years: [1972, 2025] },
      { name: "G-Class", years: [1979, 2025] },
      { name: "Maybach S-Class", years: [2015, 2025] },
    ],
  },
  {
    name: "BMW",
    models: [
      { name: "507", years: [1956, 1959] },
      { name: "2002", years: [1968, 1976] },
      { name: "M1", years: [1978, 1981] },
      { name: "M3 (E30)", years: [1986, 1991] },
      { name: "M3 (E36)", years: [1992, 1999] },
      { name: "M3 (E46)", years: [1999, 2006] },
      { name: "M3 (E90/E92)", years: [2007, 2013] },
      { name: "M3 (F80)", years: [2014, 2018] },
      { name: "M3 (G80)", years: [2021, 2025] },
      { name: "M5", years: [1985, 2025] },
      { name: "Z8", years: [2000, 2003] },
      { name: "i8", years: [2014, 2020] },
    ],
  },
  {
    name: "Pagani",
    models: [
      { name: "Zonda", years: [1999, 2017] },
      { name: "Huayra", years: [2012, 2024] },
      { name: "Utopia", years: [2023, 2025] },
    ],
  },
  {
    name: "Koenigsegg",
    models: [
      { name: "CC8S", years: [2002, 2004] },
      { name: "CCX", years: [2006, 2010] },
      { name: "Agera", years: [2011, 2018] },
      { name: "Regera", years: [2016, 2023] },
      { name: "Jesko", years: [2022, 2025] },
      { name: "Gemera", years: [2024, 2025] },
    ],
  },
  {
    name: "Maserati",
    models: [
      { name: "3500 GT", years: [1957, 1964] },
      { name: "Ghibli (Classic)", years: [1967, 1973] },
      { name: "Bora", years: [1971, 1978] },
      { name: "MC12", years: [2004, 2005] },
      { name: "GranTurismo", years: [2007, 2025] },
      { name: "Quattroporte", years: [2004, 2025] },
      { name: "MC20", years: [2021, 2025] },
      { name: "Levante", years: [2016, 2024] },
    ],
  },
  {
    name: "Jaguar",
    models: [
      { name: "E-Type", years: [1961, 1975] },
      { name: "XJ220", years: [1992, 1994] },
      { name: "XK8", years: [1996, 2006] },
      { name: "XKR-S", years: [2011, 2014] },
      { name: "F-Type", years: [2013, 2024] },
      { name: "XJ (X351)", years: [2010, 2019] },
    ],
  },
  {
    name: "Ford",
    models: [
      { name: "GT40", years: [1964, 1969] },
      { name: "Mustang (Classic)", years: [1964, 1973] },
      { name: "GT (2005)", years: [2005, 2006] },
      { name: "GT (2017)", years: [2017, 2022] },
    ],
  },
  {
    name: "Chevrolet",
    models: [
      { name: "Corvette C1", years: [1953, 1962] },
      { name: "Corvette C2", years: [1963, 1967] },
      { name: "Corvette C3", years: [1968, 1982] },
      { name: "Corvette C4", years: [1984, 1996] },
      { name: "Corvette C8", years: [2020, 2025] },
      { name: "Camaro ZL1", years: [2012, 2024] },
    ],
  },
  {
    name: "Dodge",
    models: [
      { name: "Viper", years: [1992, 2017] },
      { name: "Challenger SRT Hellcat", years: [2015, 2023] },
      { name: "Charger SRT Hellcat", years: [2015, 2023] },
    ],
  },
  {
    name: "Lotus",
    models: [
      { name: "Esprit", years: [1976, 2004] },
      { name: "Elise", years: [1996, 2021] },
      { name: "Exige", years: [2000, 2021] },
      { name: "Evora", years: [2009, 2021] },
      { name: "Emira", years: [2022, 2025] },
      { name: "Evija", years: [2024, 2025] },
    ],
  },
  {
    name: "Alpine",
    models: [
      { name: "A110 (Classic)", years: [1961, 1977] },
      { name: "A110 (2017)", years: [2017, 2025] },
      { name: "A290", years: [2025, 2025] },
    ],
  },
  {
    name: "De Tomaso",
    models: [
      { name: "Mangusta", years: [1967, 1971] },
      { name: "Pantera", years: [1971, 1993] },
    ],
  },
];

/** Sorted list of make names */
export const MAKE_NAMES = VEHICLE_CATALOG.map((m) => m.name).sort();

/** Get models for a given make */
export function getModelsForMake(make: string): ModelEntry[] {
  const entry = VEHICLE_CATALOG.find(
    (m) => m.name.toLowerCase() === make.toLowerCase()
  );
  return entry?.models || [];
}

/** Get year range for a given make + model */
export function getYearsForModel(
  make: string,
  model: string
): number[] | null {
  const models = getModelsForMake(make);
  const m = models.find((md) => md.name.toLowerCase() === model.toLowerCase());
  if (!m) return null;
  const years: number[] = [];
  for (let y = m.years[1]; y >= m.years[0]; y--) {
    years.push(y);
  }
  return years;
}

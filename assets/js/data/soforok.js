// ==========================================================
// TransIT v4.4 – Sofőr adatbázis (Demo Dataset)
// 3 belföldes + 3 nemzetközi (1 kezes) + 3 nemzetközi (2 kezes)
// ADR érték RANDOM generálva betöltéskor
// Forrásadatok: sofor_lista_kategoriak.xlsx  [1](https://technetichu-my.sharepoint.com/personal/szabolcs_gilincsek_technetic_hu/_layouts/15/Doc.aspx?sourcedoc=%7B0C0ECEB8-D05C-4DBC-A063-AF58EDE235BF%7D&file=sofor_lista_kategoriak.xlsx&action=default&mobileredirect=true)
// ==========================================================

// Random ADR generátor
function randomADR() {
  return Math.random() < 0.3; // 30% esély, piaci átlagnak megfelelő
}

export const SOFOROK = [
  // ===========================
  // 3 BELFÖLDES SOFŐR
  // ===========================
  {
    id: "S1",
    nev: "Aranyos László",
    tipus: "belföldes",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "S2",
    nev: "Berek Gábor",
    tipus: "belföldes",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Győr" },
    timeline: []
  },
  {
    id: "S3",
    nev: "Vagi Tamás",
    tipus: "belföldes",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Kecskemét" },
    timeline: []
  },

  // ===========================
  // 3 NEMZETKÖZI – 1 KEZES
  // ===========================
  {
    id: "S4",
    nev: "Árgyellán István Augusto",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "S5",
    nev: "Árvai Gábor",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Tatabánya" },
    timeline: []
  },
  {
    id: "S6",
    nev: "Balázs István",
    tipus: "nemzetkozi",
    kezes: "1",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Székesfehérvár" },
    timeline: []
  },

  // ===========================
  // 3 NEMZETKÖZI – 2 KEZES
  // ===========================
  {
    id: "S7",
    nev: "Adamek István",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "S8",
    nev: "Bagi Lajos",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Győr" },
    timeline: []
  },
  {
    id: "S9",
    nev: "Csák László",
    tipus: "nemzetkozi",
    kezes: "2",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Pécs" },
    timeline: []
  }
];

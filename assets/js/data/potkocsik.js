// ==========================================================
// TransIT v4.4 – Pótkocsi adatbázis (Demo Dataset)
// 3 belföldi + 3 nemzetközi pótkocsi
// ADR érték random generálva
// ==========================================================

// Random ADR generátor (30% esély)
function randomADR() {
  return Math.random() < 0.3;
}

export const POTKOCSIK = [

  // ===========================
  // 3 BELFÖLDI PÓTKOCSI
  // ===========================
  /*
  {
    id: "P1",
    rendszam: "WBU760",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "P2",
    rendszam: "XZE830",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Győr" },
    timeline: []
  },
  {
    id: "P3",
    rendszam: "XYS995",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Pécs" },
    timeline: []
  },
  */

  // ===========================
  // 3 NEMZETKÖZI PÓTKOCSI
  // ===========================
  {
    id: "P4",
    rendszam: "AAKW011",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "P5",
    rendszam: "WAB112",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Tatabánya" },
    timeline: []
  },
  {
    id: "P6",
    rendszam: "WGG021",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Székesfehérvár" },
    timeline: []
  }

];

// ==========================================================
// TransIT v4.4 – Pótkocsi adatbázis (Demo Dataset)
// 3 belföldi + 3 nemzetközi pótkocsi
// Forrásadatok: Gépkocsitörzs Excel file  [1](https://technetichu-my.sharepoint.com/personal/szabolcs_gilincsek_technetic_hu/_layouts/15/Doc.aspx?sourcedoc=%7BE4F49845-3E48-4629-9F17-368EFABCD60D%7D&file=Ge%CC%81pja%CC%81rmu%CC%8Bto%CC%88rzs_20260127083949%20(1).xlsx&action=default&mobileredirect=true).xlsx&action=default&mobileredirect=true)
// ADR értn=default&mobileredirect=true)
// ADR érték random generálva (sofőrökhöz igazítva)
// ==========================================================

// Random ADR generátor (30%generálva (sofőrökhöz igazítva)
// ==========================================================

// Random ADR generátor (30% esély)
function randomADR() {
  return Math.random() < 0.3;
}

export const POTKOCSIK = [

  // ===========================
  // 3 BELFÖLDI PÓTKOCSI
  // ===========================
  {
    id: "P1",
    rendszam==========
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
    tipus: "belföld  rendszam: "XZE830",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Győr" },
    timeline: []
  },
  {
    id: "P3",
    rendszam: "XYS995,
  {
    id: "P3",
    rendszam: "XYS995",
    tipus: "belföldi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Pécs" },
    timeline: []
  },

  // ===========================
  // 3 NEMZETKÖZI PÓTKOCSI
  // ===========================
  {
    id: "P4",
    rendszam: "AAKW011",
    tipus: "nemzetkorendszam: "AAKW011",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Budapest" },
    timeline: []
  },
  {
    id: "P5",
    rendszame: []
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
    tipus: "nemzetkoziendszam: "WGG021",
    tipus: "nemzetkozi",
    adr: randomADR(),
    jelenlegi_pozicio: { hely: "Székesfehérvár" },
    timeline: []
  }

];

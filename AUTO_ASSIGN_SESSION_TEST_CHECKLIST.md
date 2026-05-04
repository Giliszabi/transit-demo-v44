# Auto-Assign + Session Rehydrate Kezi Teszt Checklist

Datum: 2026-05-04
Scope: Fuvarszervezes es Menetiranyitas modulok kozotti allapotmegorzes

## Elokeszites

1. Nyisd meg a Fuvarszervezes oldalt.
2. Ellenorizd, hogy legalabb egy fuvar, sofor, vontato es potkocsi latszik.
3. A Dispatch profil panelen valassz egy aktiv profilt (pl. C vagy D).

## A. Profilvezerelt futas ellenorzese

1. Kattints a Fuvarok osszerakasa gombra.
2. Ellenorizd a modal elonezetben:
- latszik a Profil cimke
- latszanak a fo parameterek
3. Nyomd meg az Alkalmaz gombot.
4. Ellenorizd, hogy megjelenik a toast uzenet:
- Kiosztas alkalmazva es sessionbe mentve

Elvart eredmeny:
- A futas profilinformacioval megy, nem vakon alap modban.

## B. Fuvarszervezes nezetkonzisztencia

1. Alkalmazas utan ellenorizd a fuvar kartykat:
- assignedSoforId
- assignedVontatoId
- assignedPotkocsiId
2. Ellenorizd az Eroforras idovonalat.
3. Ellenorizd a Szerelveny idovonalat.

Elvart eredmeny:
- A kiosztott fuvarok es timeline blokkok konzisztensen latszanak.

## C. Modulvaltas utani rehydrate

1. Menj at a Menetiranyitas oldalra.
2. Ellenorizd az Eroforras idovonalat.
3. Ellenorizd a Szerelveny idovonalat.

Elvart eredmeny:
- Ugyanaz az assignment/timeline allapot latszik, mint Fuvarszervezesben.

## D. Hard reload ugyanabban a tabban

1. Menetiranyitas vagy Fuvarszervezes oldalon nyomj hard reloadot.
2. Ellenorizd ujra az assignment es timeline allapotot.

Elvart eredmeny:
- A sessionStorage-bol visszatoltott allapot latszik ugyanabban a tabban.

## E. Profil mismatch jelzes

1. Ments kiosztast egy aktiv profil alatt.
2. Kapcsold ki azt a profilt, vagy valts masik profilra.
3. Frissits oldalt.
4. Ellenorizd a Dispatch profil panel osszegzot.

Elvart eredmeny:
- Megjelenik a jelzes: Sessionben mentett kiosztas mas profil alatt keszult.

## F. Kezi session reset

1. Kattints a Session kiosztas torlese gombra a Dispatch profil panelen.
2. Ellenorizd, hogy eltunik a mismatch jelzes.
3. Frissits nezetet (vagy oldalt) es ellenorizd az allapotot.

Elvart eredmeny:
- Session torlodik, a mentett allapot nem toltodik vissza.

## G. Robusztussagi ellenorzes

1. Nyisd meg a DevTools Console panelt.
2. Ellenorizd, hogy nincs runtime crash.
3. Ha van hianyzo ID, csak warning log jelenjen meg.

Elvart eredmeny:
- Nincs UI osszeomlas.
- Ismeretlen ID eseten skip + warn, nem exception.

## Rogzites

Minden blokk utan jelold:
- PASS
- FAIL
- NOTE

Javasolt rovid report formatum:
- Build/commit:
- Tesztelo:
- Datum:
- FAIL pontok:
- Megjegyzes:

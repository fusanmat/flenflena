#!/usr/bin/env python3
"""Flenflena v4 · tiempos de Cercanías València a partir del GTFS oficial de Renfe.

Uso (a mano, no hay tarea programada):
    python3 tools/build-cercanias.py fomento_transit.zip 2026-11-12 > data/cercanias.json

Fuente: Renfe Cercanías, GTFS «fomento_transit.zip»
        https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip (data.renfe.com)
- Estaciones: stops.txt (coordenadas oficiales) dentro de VALENCIA_BBOX.
- Para cada par de estaciones y cada salida programada entre 07:00 y 20:00 del día indicado,
  llegada más temprana directa o con UN transbordo en València Nord (8 min, transfers.txt).
- Se guarda la mediana y el mínimo de esos tiempos (andén a andén) y el número de salidas.
"""
import csv, io, json, statistics, sys, zipfile

BBOX = [-0.62, 39.08, -0.20, 39.70]
NORD, XFER = "65000", 8
URL = "https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip"


def rows(z, name):
    with z.open(name) as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")):
            yield {k.strip(): (v or "").strip() for k, v in r.items()}


def mins(t):
    h, m, _ = map(int, t.split(":"))
    return h * 60 + m


def main(zpath, day):
    ymd = day.replace("-", "")
    wd = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    import datetime
    dow = wd[datetime.date(int(day[:4]), int(day[5:7]), int(day[8:10])).weekday()]
    z = zipfile.ZipFile(zpath)
    stations = {}
    for r in rows(z, "stops.txt"):
        la, lo = float(r["stop_lat"]), float(r["stop_lon"])
        if BBOX[0] <= lo <= BBOX[2] and BBOX[1] <= la <= BBOX[3]:
            stations[r["stop_id"]] = {"id": r["stop_id"], "n": r["stop_name"], "lat": round(la, 5), "lng": round(lo, 5)}
    svc = {r["service_id"] for r in rows(z, "calendar.txt") if r["start_date"] <= ymd <= r["end_date"] and r[dow] == "1"}
    trips = {r["trip_id"] for r in rows(z, "trips.txt") if r["route_id"].startswith("40T") and r["service_id"] in svc}
    seq = {}
    for r in rows(z, "stop_times.txt"):
        if r["trip_id"] in trips:
            seq.setdefault(r["trip_id"], []).append((int(r["stop_sequence"]), r["stop_id"], mins(r["arrival_time"]), mins(r["departure_time"])))
    legs = [sorted(v) for v in seq.values()]
    cache = {}

    def direct(a, b):
        if (a, b) not in cache:
            out = []
            for L in legs:
                ia = [i for i, x in enumerate(L) if x[1] == a]
                ib = [i for i, x in enumerate(L) if x[1] == b]
                if ia and ib and ia[0] < ib[-1]:
                    out.append((L[ia[0]][3], L[ib[-1]][2]))
            cache[(a, b)] = out
        return cache[(a, b)]

    pairs = {}
    for a in sorted(stations):
        for b in sorted(stations):
            if a == b:
                continue
            via = a != NORD and b != NORD
            deps = sorted({d for d, _ in direct(a, b)} | ({d for d, _ in direct(a, NORD)} if via else set()))
            res = []
            for t0 in deps:
                if not 7 * 60 <= t0 <= 20 * 60:
                    continue
                best = None
                for d, ar in direct(a, b):
                    if d == t0 and (best is None or ar < best[0]):
                        best = (ar, "direct")
                if via:
                    for d, ar in direct(a, NORD):
                        if d != t0:
                            continue
                        for d2, ar2 in direct(NORD, b):
                            if d2 >= ar + XFER and (best is None or ar2 < best[0]):
                                best = (ar2, "nord")
                if best:
                    res.append((t0, best[0] - t0, best[1]))
            # quita salidas dominadas (una salida posterior llega antes o igual)
            res = [x for i, x in enumerate(res) if not any(y[0] > x[0] and y[0] + y[1] <= x[0] + x[1] for y in res[i + 1:i + 8])]
            if not res:
                continue
            durs = [x[1] for x in res]
            kinds = [x[2] for x in res]
            pairs[a + ">" + b] = {"med": round(statistics.median(durs)), "min": min(durs), "n": len(res),
                                  "via": "nord" if kinds.count("nord") > kinds.count("direct") else "direct"}
    out = {
        "_note": "Tiempos andén a andén de Cercanías València (mediana de las salidas de 07:00 a 20:00, directo o con un transbordo de 8 min en València Nord). Generado con tools/build-cercanias.py.",
        "source": "Renfe Cercanías · GTFS oficial (fomento_transit.zip)",
        "source_url": URL,
        "service_date": day,
        "window": "07:00-20:00",
        "transfer_min": XFER,
        "stations": [stations[k] for k in sorted(stations)],
        "pairs": pairs,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "2026-11-12")

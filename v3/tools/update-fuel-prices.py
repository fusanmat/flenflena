#!/usr/bin/env python3
"""Refresh v3/data/fuel_prices.json from an official, keyless public source.

Primary: MITECO / Geoportal Gasolineras REST API, province 46 (Valencia).
  GET .../EstacionesTerrestres/FiltroProvincia/46
  Averages "Precio Gasolina 95 E5" and "Precio Gasoleo A" over stations
  that post a price in the sanity range 1.0–2.5 €/L.

Alternative (not used here; official, also keyless, Spain-wide weekly):
  EU Weekly Oil Bulletin — Euro-super 95 and diesel, Spain
  https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en

Electricity is not fetched: REE/ESIOS PVPC requires a token. The EV
figure (home-charging assumption) is kept as ev_eur_kwh in the JSON.

On a failed fetch or failed sanity check the existing file is left
unchanged and the process exits 1 (the site keeps the last good file).
If prices/date/station counts are unchanged, the file is not rewritten
(so the weekly Action commits only when something actually changed).
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_URL = (
    "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/"
    "PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/46"
)
SOURCE_NAME = "MITECO · Geoportal Gasolineras (provincia de Valencia)"
SOURCE_URL = "https://geoportalgasolineras.es/"
PROVINCE = "46"
GASOLINE_KEY = "Precio Gasolina 95 E5"
DIESEL_KEY = "Precio Gasoleo A"
MIN_EUR_L = 1.0
MAX_EUR_L = 2.5
MIN_STATIONS = 50
EV_EUR_KWH = 0.3166  # assumption: home charging; not an official weekly series
ROOT = Path(__file__).resolve().parents[1]  # v3/
OUT = ROOT / "data" / "fuel_prices.json"


def parse_es_price(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def mean(values):
    return sum(values) / len(values)


def collect(stations, key):
    out = []
    for st in stations:
        v = parse_es_price(st.get(key))
        if v is None:
            continue
        if MIN_EUR_L <= v <= MAX_EUR_L:
            out.append(v)
    return out


def parse_fecha(fecha):
    """'10/11/2026 10:45:57' → date 2026-11-10 (local Spain timestamp from the API)."""
    if not fecha:
        return None
    part = str(fecha).strip().split()[0]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(part, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def fetch():
    req = urllib.request.Request(
        API_URL,
        headers={
            "User-Agent": "Flenflena/v3 fuel-prices (weekly official average)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        if getattr(resp, "status", 200) != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        raw = resp.read()
    data = json.loads(raw.decode("utf-8"))
    if (data.get("ResultadoConsulta") or data.get("Resultado") or "").upper() not in ("OK", ""):
        # Some payloads only set Fecha + list; accept if stations present
        if not data.get("ListaEESSPrecio"):
            raise RuntimeError("API result not OK: " + str(data.get("ResultadoConsulta")))
    stations = data.get("ListaEESSPrecio") or []
    if not stations:
        raise RuntimeError("empty station list")
    petrol = collect(stations, GASOLINE_KEY)
    diesel = collect(stations, DIESEL_KEY)
    if len(petrol) < MIN_STATIONS or len(diesel) < MIN_STATIONS:
        raise RuntimeError(
            f"too few quotes in range: petrol={len(petrol)} diesel={len(diesel)}"
        )
    p = round(mean(petrol), 4)
    d = round(mean(diesel), 4)
    if not (MIN_EUR_L <= p <= MAX_EUR_L and MIN_EUR_L <= d <= MAX_EUR_L):
        raise RuntimeError(f"average out of range: petrol={p} diesel={d}")
    date = parse_fecha(data.get("Fecha")) or datetime.now().astimezone().date().isoformat()
    return {
        "date": date,
        "week": date,
        "petrol_eur_l": p,
        "diesel_eur_l": d,
        "ev_eur_kwh": EV_EUR_KWH,
        "ev_note": "assumption: home charging; not an official weekly series",
        "source": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "api_url": API_URL,
        "province": PROVINCE,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "n_stations": {
            "petrol": len(petrol),
            "diesel": len(diesel),
            "total": len(stations),
        },
    }


def significant(old, new):
    if not old:
        return True
    keys = ("date", "week", "petrol_eur_l", "diesel_eur_l", "ev_eur_kwh")
    if any(old.get(k) != new.get(k) for k in keys):
        return True
    return old.get("n_stations") != new.get("n_stations")


def main():
    try:
        payload = fetch()
    except Exception as e:
        print(f"update-fuel-prices: fetch/sanity failed; keeping existing file. ({e})", file=sys.stderr)
        return 1
    old = None
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            old = None
    if not significant(old, payload):
        print(
            "update-fuel-prices: no change in prices/date/stations "
            f"(petrol={payload['petrol_eur_l']} diesel={payload['diesel_eur_l']} date={payload['date']})"
        )
        return 0
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(OUT)
    print(
        "update-fuel-prices: wrote "
        f"{OUT} petrol={payload['petrol_eur_l']} diesel={payload['diesel_eur_l']} "
        f"date={payload['date']} n={payload['n_stations']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

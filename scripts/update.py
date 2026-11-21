#!/usr/bin/env python3
"""Actualiza los próximos 7 días de partidos y publica JSON para GitHub Pages.

Usa API-FOOTBALL API-SPORTS v3. La clave sólo vive en GitHub Secrets.
Sin librerías externas; límite local de consultas configurado para planes gratis.
"""
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from zoneinfo import ZoneInfo

from model import analyze_fixture, date_of

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "predictions.json"
KEY = os.environ.get("APISPORTS_KEY", "").strip()
TIMEZONE = ZoneInfo(os.environ.get("APP_TIMEZONE", "America/Tijuana"))
MAX_LEAGUES = min(120, max(1, int(os.getenv("MAX_LEAGUES", "35"))))
MAX_H2H = min(40, max(0, int(os.getenv("MAX_H2H", "12"))))
MAX_CALLS = min(7000, max(5, int(os.getenv("MAX_CALLS", "85"))))
INCLUDE_CUPS = os.getenv("INCLUDE_CUPS", "false").lower() == "true"
REQUEST_INTERVAL = float(os.getenv("REQUEST_INTERVAL", "6.6"))
API = "https://v3.football.api-sports.io"

# Competencias de interés, no una lista excluyente.
PRIORITY_IDS = [
    140, 39, 135, 78, 61, 262, 94, 88, 203, 179, 144, 71, 128, 253, 307,
    2, 3, 848, 13, 11, 40, 41, 136, 79, 62, 141, 72, 239, 197, 235, 119,
    103, 113, 106, 283, 345, 281, 172, 169, 218, 207, 98, 333
]
CUP_WORDS = re.compile(r"\b(cup|copa|taça|pokal|trophy|trofeo|supercopa|super cup|friendly|friendlies|amistoso|qualif|qualification|play[- ]?offs?)\b", re.I)

class ApiProblem(Exception):
    pass

class FootballAPI:
    def __init__(self, key):
        self.key = key
        self.calls = 0
        self.last = 0
        self.remaining = None

    def get(self, endpoint, **params):
        if self.calls >= MAX_CALLS:
            raise ApiProblem(f"Presupuesto de {MAX_CALLS} solicitudes agotado")
        if self.remaining is not None and self.remaining <= 2:
            raise ApiProblem("Cuota de API próxima a agotarse")
        elapsed = time.monotonic() - self.last
        if self.calls and elapsed < REQUEST_INTERVAL:
            time.sleep(REQUEST_INTERVAL - elapsed)
        url = API + endpoint + "?" + urlencode(params)
        req = Request(url, headers={"x-apisports-key": self.key, "Accept": "application/json", "User-Agent": "PronosticosLocales/1.0"})
        self.calls += 1
        self.last = time.monotonic()
        try:
            with urlopen(req, timeout=32) as response:
                if response.headers.get("x-ratelimit-requests-remaining"):
                    self.remaining = int(response.headers["x-ratelimit-requests-remaining"])
                payload = json.load(response)
        except HTTPError as ex:
            raise ApiProblem(f"Error HTTP {ex.code} de API-Football ({endpoint})") from ex
        except (URLError, TimeoutError, ValueError) as ex:
            raise ApiProblem(f"Falló la conexión ({endpoint}): {type(ex).__name__}") from ex
        if payload.get("errors"):
            errors = payload["errors"]
            raise ApiProblem(f"API-Football respondió un error ({endpoint}): {str(errors)[:240]}")
        return payload.get("response", [])


def write(data):
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardado: {DEST} ({len(data.get('partidos', []))} pronósticos)")


def is_cup(league_name):
    return bool(CUP_WORDS.search(league_name or ""))


def run():
    now = datetime.now(timezone.utc)
    local_today = now.astimezone(TIMEZONE).date()
    window_end = local_today + timedelta(days=6)
    base = {
        "version": 1,
        "estado": "sin_configurar",
        "actualizado": now.isoformat(),
        "zona_horaria": str(TIMEZONE),
        "inicio": local_today.isoformat(),
        "fin": window_end.isoformat(),
        "fuente": "API-Football (API-SPORTS)",
        "nota": "Porcentajes heurísticos, sin calibración histórica; NO son certezas ni usan cuotas.",
        "cobertura": {},
        "partidos": []
    }
    if not KEY:
        base["mensaje"] = "Configura el secreto APISPORTS_KEY en GitHub para recibir partidos reales."
        write(base)
        return

    api = FootballAPI(KEY)
    errors = []
    try:
        # Día extra a cada lado para evitar perder juegos por el huso horario del país.
        matches = api.get("/fixtures", **{
            "from": (local_today - timedelta(days=1)).isoformat(),
            "to": (window_end + timedelta(days=1)).isoformat()
        })
    except ApiProblem as ex:
        base["estado"] = "error"
        base["mensaje"] = str(ex)
        write(base)
        return

    by_league = defaultdict(list)
    total_future = 0
    cup_count = 0
    for m in matches:
        kickoff = date_of(m)
        if not kickoff or not (local_today <= kickoff.astimezone(TIMEZONE).date() <= window_end):
            continue
        status = (m.get("fixture") or {}).get("status", {}).get("short")
        if status not in ("NS", "TBD") or kickoff < now:
            continue
        total_future += 1
        league = m.get("league") or {}
        if not INCLUDE_CUPS and is_cup(league.get("name", "")):
            cup_count += 1
            continue
        if league.get("id") is None or league.get("season") is None:
            continue
        by_league[(int(league["id"]), int(league["season"]))].append(m)

    def rank(item):
        (lid, season), games = item
        try:
            priority = PRIORITY_IDS.index(lid)
        except ValueError:
            priority = 1000
        return (priority, -len(games), lid)

    leagues = sorted(by_league.items(), key=rank)
    cap = min(MAX_LEAGUES, max(0, MAX_CALLS - MAX_H2H - 3))
    chosen = leagues[:cap]
    predicted = []
    skipped = Counter()
    completed_leagues = 0
    for (league_id, season), fixtures in chosen:
        try:
            history = api.get("/fixtures", league=league_id, season=season)
        except ApiProblem as ex:
            errors.append(f"Liga {league_id}: {ex}")
            continue
        completed_leagues += 1
        for fixture in fixtures:
            try:
                pred, reason = analyze_fixture(fixture, history)
            except (KeyError, ValueError, TypeError, OverflowError, ZeroDivisionError) as ex:
                skipped["datos_invalidos"] += 1
                continue
            if pred is None:
                skipped[reason or "sin_datos"] += 1
            else:
                predicted.append(pred)

    # Sólo H2H de los candidatos mejor posicionados: capado para ahorrar cuota.
    predicted.sort(key=lambda p: (-p["prob_modelo"], p["fecha"]))
    if MAX_H2H > 0:
        fixtures_by_id = {int(m["fixture"]["id"]): m for fixtures in by_league.values() for m in fixtures}
        histories_by_league = {}  # El pronóstico no depende de actualizarse con H2H si no está disponible.
        for candidate in predicted[:MAX_H2H]:
            fixture = fixtures_by_id.get(candidate["id"])
            if not fixture:
                continue
            try:
                hid = fixture["teams"]["home"]["id"]
                aid = fixture["teams"]["away"]["id"]
                head = api.get("/fixtures/headtohead", h2h=f"{hid}-{aid}", last=5)
                # Recálculo ligero de H2H sin otra consulta de datos históricos.
                candidate["h2h"] = []
                for m in reversed(head):
                    if (m.get("fixture") or {}).get("status", {}).get("short") != "FT":
                        continue
                    when = date_of(m)
                    if when is None or when >= date_of(fixture):
                        continue
                    candidate["h2h"].append({
                        "fecha": when.date().isoformat(),
                        "local": m["teams"]["home"]["name"],
                        "visita": m["teams"]["away"]["name"],
                        "marcador": f"{m['goals']['home']}-{m['goals']['away']}"
                    })
                if candidate["h2h"]:
                    candidate["advertencias"] = [x for x in candidate["advertencias"] if not x.startswith("No hay H2H")]
                # No modificar % luego de ver H2H: bajo poder predictivo, evita sobreajuste.
            except (ApiProblem, KeyError, TypeError) as ex:
                errors.append(f"H2H partido {candidate['id']}: {str(ex)[:110]}")

    predicted.sort(key=lambda p: (p["fecha"], -p["prob_modelo"]))
    base["estado"] = "ok" if completed_leagues > 0 else "sin_datos"
    base["mensaje"] = ("Pronósticos actualizados." if completed_leagues > 0 else
                       "No se pudo obtener historial de las ligas; revisa el plan y la temporada de tu API.")
    base["partidos"] = predicted
    base["cobertura"] = {
        "partidos_programados_en_api": total_future,
        "ligas_detectadas": len(leagues),
        "ligas_consultadas": completed_leagues,
        "ligas_omitidas_por_limite": max(0, len(leagues) - len(chosen)),
        "copas_omitidas": cup_count,
        "partidos_descartados": dict(skipped),
        "partidos_seleccionados": len(predicted),
        "solicitudes_consumidas": api.calls,
        "solicitudes_restantes": api.remaining,
        "errores": errors[:12],
        "nota": "Se priorizan ligas principales. La app no cubre todos los encuentros mundiales con una cuenta limitada."
    }
    write(base)
    print(json.dumps(base["cobertura"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()

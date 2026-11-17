import math
from .validation import validate_payload

# Saaty's random consistency index (RI), n=1..10.
RANDOM_INDEX = {1: 0, 2: 0, 3: .58, 4: .90, 5: 1.12, 6: 1.24,
                7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}

def ahp_priorities(matrix):
    """Principal eigenvector + Saaty CI/CR using power iteration."""
    n = len(matrix)
    weights = [1 / n] * n
    for _ in range(2000):
        updated = [sum(matrix[i][j] * weights[j] for j in range(n)) for i in range(n)]
        scale = sum(updated)
        updated = [v / scale for v in updated]
        delta = max(abs(a - b) for a, b in zip(updated, weights))
        weights = updated
        if delta < 1e-13:
            break
    transformed = [sum(matrix[i][j] * weights[j] for j in range(n)) for i in range(n)]
    eigenvalue = sum(transformed[i] / weights[i] for i in range(n)) / n
    ci = max(0.0, (eigenvalue - n) / (n - 1)) if n > 1 else 0.0
    cr = ci / RANDOM_INDEX[n] if RANDOM_INDEX[n] else 0.0
    return {"weights": weights, "lambda_max": eigenvalue, "ci": ci, "cr": cr,
            "consistent": cr < 0.10}

def normalize_weights(criteria):
    raw = [c["weight"] for c in criteria]
    total = sum(raw)
    return [w / total for w in raw]

def topsis(rows, criteria, weights):
    """Vector normalisation, weighted ideal and anti-ideal, relative proximity."""
    n, m = len(rows), len(criteria)
    denominators = [math.sqrt(sum(rows[i][j] ** 2 for i in range(n))) for j in range(m)]
    weighted = [[((rows[i][j] / denominators[j]) if denominators[j] else 0) * weights[j]
                 for j in range(m)] for i in range(n)]
    best, worst = [], []
    for j, criterion in enumerate(criteria):
        column = [weighted[i][j] for i in range(n)]
        best.append(max(column) if criterion["direction"] == "max" else min(column))
        worst.append(min(column) if criterion["direction"] == "max" else max(column))
    scores = []
    for values in weighted:
        d_plus = math.sqrt(sum((v - b) ** 2 for v, b in zip(values, best)))
        d_minus = math.sqrt(sum((v - w) ** 2 for v, w in zip(values, worst)))
        scores.append(d_minus / (d_plus + d_minus) if d_plus + d_minus > 1e-12 else 0.5)
    return scores

def utilities(rows, criteria):
    n, m = len(rows), len(criteria)
    result = [[0.0] * m for _ in range(n)]
    for j, criterion in enumerate(criteria):
        column = [rows[i][j] for i in range(n)]
        low, high = min(column), max(column)
        for i in range(n):
            if high - low < 1e-12:
                result[i][j] = 1.0
            elif criterion["direction"] == "max":
                result[i][j] = (rows[i][j] - low) / (high - low)
            else:
                result[i][j] = (high - rows[i][j]) / (high - low)
    return result

def electre_i(utility, weights, names, concordance_threshold=0.65, discordance_threshold=0.35):
    """Simplified ELECTRE I outranking; net flow is a visualization heuristic."""
    n, m = len(utility), len(weights)
    concordance = [[0.0] * n for _ in range(n)]
    discordance = [[0.0] * n for _ in range(n)]
    graph = [[False] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            concordance[i][j] = sum(weights[k] for k in range(m)
                                    if utility[i][k] >= utility[j][k] - 1e-12)
            discordance[i][j] = max(max(0.0, utility[j][k] - utility[i][k])
                                    for k in range(m))
            graph[i][j] = (concordance[i][j] >= concordance_threshold
                            and discordance[i][j] <= discordance_threshold)
    flow = [sum(graph[i]) - sum(graph[j][i] for j in range(n)) for i in range(n)]
    edges = [{"source": names[i], "target": names[j]}
             for i in range(n) for j in range(n) if graph[i][j]]
    return {"flow": flow, "edges": edges,
            "concordance": concordance, "discordance": discordance,
            "thresholds": {"concordance": concordance_threshold,
                           "discordance": discordance_threshold}}

def rank(names, values, field="score"):
    order = sorted(range(len(names)), key=lambda i: (-values[i], i))
    return [{"name": names[i], field: round(values[i], 6), "rank": index + 1}
            for index, i in enumerate(order)]

def run_analysis(raw):
    payload = validate_payload(raw)
    criteria, alternatives = payload["criteria"], payload["alternatives"]
    names = [a["name"] for a in alternatives]
    keys = [c["key"] for c in criteria]
    rows = [[a["values"][key] for key in keys] for a in alternatives]
    direct_weights = normalize_weights(criteria)
    if payload["pairwise"] is not None:
        ahp = ahp_priorities(payload["pairwise"])
        weights = ahp["weights"]
    else:
        ahp = None
        weights = direct_weights

    top = topsis(rows, criteria, weights)
    utility = utilities(rows, criteria)
    el = electre_i(utility, weights, names)
    saw = [sum(w * v for w, v in zip(weights, item)) for item in utility]
    sensitivity = []
    for j, criterion in enumerate(criteria):
        for factor in (0.8, 1.2):
            adjusted = [w * (factor if k == j else 1) for k, w in enumerate(weights)]
            total = sum(adjusted)
            adjusted = [w / total for w in adjusted]
            scores = topsis(rows, criteria, adjusted)
            leader = max(range(len(scores)), key=lambda i: (scores[i], -i))
            sensitivity.append({
                "criterion": criterion["label"], "factor": factor,
                "leader": names[leader], "score": round(scores[leader], 6),
            })

    winner = max(range(len(top)), key=lambda i: (top[i], -i))
    contributions = sorted(range(len(keys)), key=lambda j: -(weights[j] * utility[winner][j]))
    reasons = [{"criterion": criteria[j]["label"], "weight": round(weights[j], 4),
                "utility": round(utility[winner][j], 4)}
               for j in contributions[:3]]
    return {
        "weights": [{"key": criterion["key"], "label": criterion["label"],
                     "weight": round(w, 8)} for criterion, w in zip(criteria, weights)],
        "ahp": ({"weights": [round(w, 8) for w in ahp["weights"]],
                 "ci": round(ahp["ci"], 8), "cr": round(ahp["cr"], 8),
                 "lambda_max": round(ahp["lambda_max"], 8),
                 "consistent": ahp["consistent"]} if ahp else None),
        "topsis": rank(names, top),
        "electre": {**{k: v for k, v in el.items() if k != "flow"},
                    "ranking": rank(names, el["flow"], "flow")},
        "saw": rank(names, saw),
        "sensitivity": sensitivity,
        "recommendation": {
            "name": names[winner], "score": round(top[winner], 6),
            "reasons": reasons,
            "note": "Лидер по TOPSIS; решение остаётся за пользователем.",
        },
    }

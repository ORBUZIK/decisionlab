import math
import re

class DataError(ValueError):
    """Invalid decision matrix or AHP preferences."""

def finite_number(value, where):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise DataError(f"{where}: ожидается число")
    if not math.isfinite(value):
        raise DataError(f"{where}: число должно быть конечным")
    return float(value)

def validate_payload(data):
    if not isinstance(data, dict):
        raise DataError("Ожидается JSON-объект")
    criteria, alternatives = data.get("criteria"), data.get("alternatives")
    if not isinstance(criteria, list) or not 2 <= len(criteria) <= 10:
        raise DataError("Нужно от 2 до 10 критериев")
    if not isinstance(alternatives, list) or not 2 <= len(alternatives) <= 200:
        raise DataError("Нужно от 2 до 200 альтернатив")

    clean_criteria, keys = [], set()
    for index, criterion in enumerate(criteria, 1):
        if not isinstance(criterion, dict):
            raise DataError(f"Критерий {index}: неверный формат")
        key, label = criterion.get("key"), criterion.get("label")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,39}", key):
            raise DataError(f"Критерий {index}: ключ должен состоять из латиницы, цифр и _")
        if key in keys:
            raise DataError(f"Повтор критерия: {key}")
        if not isinstance(label, str) or not 1 <= len(label.strip()) <= 80:
            raise DataError(f"Критерий {index}: название от 1 до 80 символов")
        if criterion.get("direction") not in ("min", "max"):
            raise DataError(f"Критерий {index}: направление min или max")
        weight = finite_number(criterion.get("weight"), f"Вес {key}")
        if weight < 0:
            raise DataError("Веса не могут быть отрицательными")
        keys.add(key)
        clean_criteria.append({
            "key": key, "label": label.strip(),
            "direction": criterion["direction"], "weight": weight,
        })
    if sum(c["weight"] for c in clean_criteria) <= 0:
        raise DataError("Сумма весов должна быть положительной")

    clean_alternatives, names = [], set()
    for index, alternative in enumerate(alternatives, 1):
        if not isinstance(alternative, dict):
            raise DataError(f"Альтернатива {index}: неверный формат")
        name, values = alternative.get("name"), alternative.get("values")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise DataError(f"Альтернатива {index}: название от 1 до 100 символов")
        if name.strip().casefold() in names:
            raise DataError(f"Дублирующаяся альтернатива: {name}")
        if not isinstance(values, dict) or set(values) != keys:
            raise DataError(f"{name}: нужны значения всех критериев")
        names.add(name.strip().casefold())
        clean_alternatives.append({
            "name": name.strip(),
            "values": {c["key"]: finite_number(values[c["key"]], f"{name}/{c['key']}")
                       for c in clean_criteria},
        })

    matrix = data.get("pairwise")
    if matrix is not None:
        n = len(criteria)
        if not isinstance(matrix, list) or len(matrix) != n:
            raise DataError("Матрица AHP должна быть квадратной")
        cleaned = []
        for i, row in enumerate(matrix):
            if not isinstance(row, list) or len(row) != n:
                raise DataError("Матрица AHP должна быть квадратной")
            numbers = [finite_number(value, f"AHP[{i},{j}]") for j, value in enumerate(row)]
            if any(not 1 / 9 - 1e-8 <= v <= 9 + 1e-8 for v in numbers):
                raise DataError("Для AHP допустимы оценки от 1/9 до 9")
            cleaned.append(numbers)
        for i in range(n):
            if abs(cleaned[i][i] - 1) > 1e-6:
                raise DataError("Диагональ AHP должна состоять из единиц")
            for j in range(i + 1, n):
                if abs(cleaned[i][j] * cleaned[j][i] - 1) > 1e-5:
                    raise DataError("AHP: попарные оценки должны быть взаимно обратными")
        matrix = cleaned
    return {"criteria": clean_criteria, "alternatives": clean_alternatives, "pairwise": matrix}

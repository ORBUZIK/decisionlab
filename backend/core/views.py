from django.http import Http404
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .analysis import run_analysis
from .models import Scenario
from .validation import DataError

@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})

@api_view(["POST"])
def analyze(request):
    try:
        return Response(run_analysis(request.data))
    except (DataError, ValueError, TypeError, OverflowError) as exc:
        return Response({"error": str(exc)}, status=400)

@api_view(["GET", "POST"])
def scenarios(request):
    if request.method == "GET":
        items = Scenario.objects.all()[:100]
        return Response([{"id": str(s.id), "name": s.name, "created_at": s.created_at,
                          "alternatives": len(s.payload["alternatives"])} for s in items])
    if not isinstance(request.data, dict):
        return Response({"error": "Ожидается объект JSON"}, status=400)
    name = request.data.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        return Response({"error": "Укажите название расчёта (до 120 символов)"}, status=400)
    try:
        result = run_analysis(request.data.get("payload"))
        scenario = Scenario.objects.create(
            name=name.strip(), payload=request.data["payload"], result=result
        )
    except (DataError, ValueError, TypeError, OverflowError) as exc:
        return Response({"error": str(exc)}, status=400)
    return Response({"id": str(scenario.id), "name": scenario.name}, status=201)

@api_view(["GET", "DELETE"])
def scenario_detail(request, scenario_id):
    try:
        scenario = Scenario.objects.get(pk=scenario_id)
    except Scenario.DoesNotExist:
        raise Http404
    if request.method == "DELETE":
        scenario.delete()
        return Response(status=204)
    return Response({"id": str(scenario.id), "name": scenario.name,
                     "created_at": scenario.created_at,
                     "payload": scenario.payload, "result": scenario.result})

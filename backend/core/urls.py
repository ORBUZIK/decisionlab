from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("analyze/", views.analyze),
    path("scenarios/", views.scenarios),
    path("scenarios/<uuid:scenario_id>/", views.scenario_detail),
]

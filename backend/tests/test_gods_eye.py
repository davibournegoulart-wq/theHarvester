import pytest
from app.recon.gods_eye import (
    propagate_keplerian_orbit,
    fetch_orbital_satellites,
    fetch_space_launches,
    fetch_submarine_cables_data,
    fetch_maritime_vessels_data,
    fetch_critical_infrastructure_data,
)

def test_propagate_keplerian_orbit_calculation():
    # ISS orbital elements sample
    lat, lon, alt_km, v_kms = propagate_keplerian_orbit(
        epoch_iso="2026-09-13T04:12:47",
        mean_motion=15.49,
        eccentricity=0.00049,
        inclination_deg=51.64,
        raan_deg=224.6,
        arg_perigee_deg=134.6,
        mean_anomaly_deg=225.4,
    )
    assert -90.0 <= lat <= 90.0
    assert -180.0 <= lon <= 180.0
    assert 300.0 <= alt_km <= 550.0
    assert 7.0 <= v_kms <= 8.5

@pytest.mark.asyncio
async def test_fetch_orbital_satellites():
    sats = await fetch_orbital_satellites(group="stations")
    assert len(sats) >= 1
    assert any("ISS" in s["name"] or "CSS" in s["name"] or "TIANGONG" in s["name"] for s in sats)
    first = sats[0]
    assert "latitude" in first
    assert "longitude" in first
    assert "altitude_km" in first
    assert "velocity_kms" in first
    assert -90.0 <= first["latitude"] <= 90.0
    assert -180.0 <= first["longitude"] <= 180.0

@pytest.mark.asyncio
async def test_fetch_space_launches():
    launches = await fetch_space_launches()
    assert len(launches) >= 1
    first = launches[0]
    assert "mission_name" in first
    assert "provider" in first
    assert "rocket" in first
    assert "latitude" in first
    assert "longitude" in first

def test_submarine_cables_and_landing_points():
    cables = fetch_submarine_cables_data()
    assert len(cables) >= 3
    first = cables[0]
    assert "name" in first
    assert "landing_points" in first
    assert len(first["landing_points"]) >= 2
    assert "lat" in first["landing_points"][0]
    assert "lon" in first["landing_points"][0]

def test_maritime_vessels_and_chokepoints():
    vessels = fetch_maritime_vessels_data()
    assert len(vessels) >= 3
    first = vessels[0]
    assert "mmsi" in first
    assert "name" in first
    assert "chokepoint" in first
    assert "lat" in first
    assert "lon" in first

def test_critical_infrastructure():
    infra = fetch_critical_infrastructure_data(category="all")
    assert len(infra) >= 3
    assert any("Ashburn" in i["name"] or "Pine Gap" in i["name"] or "Dam" in i["name"] for i in infra)

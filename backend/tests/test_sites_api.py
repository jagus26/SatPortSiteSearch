import uuid


async def test_create_site(client):
    response = await client.post("/api/sites", json={
        "name": "Sao Paulo Station",
        "slug": "sao-paulo-station",
        "latitude": -23.5505,
        "longitude": -46.6333,
        "status": "candidate",
        "region": "South America",
        "country": "Brazil",
        "country_code": "BR",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Sao Paulo Station"
    assert data["slug"] == "sao-paulo-station"
    assert "id" in data


async def test_list_sites(client):
    # Create two sites
    await client.post("/api/sites", json={
        "name": "Site A",
        "slug": "site-a",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    await client.post("/api/sites", json={
        "name": "Site B",
        "slug": "site-b",
        "latitude": 1.0,
        "longitude": 1.0,
    })
    response = await client.get("/api/sites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


async def test_get_site_by_id(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Single Site",
        "slug": "single-site",
        "latitude": 10.0,
        "longitude": 20.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.get(f"/api/sites/{site_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Single Site"


async def test_get_site_not_found(client):
    fake_id = uuid.uuid4()
    response = await client.get(f"/api/sites/{fake_id}")
    assert response.status_code == 404


async def test_update_site(client):
    create_resp = await client.post("/api/sites", json={
        "name": "Old Name",
        "slug": "old-name",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.patch(f"/api/sites/{site_id}", json={
        "name": "New Name",
        "status": "approved",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["status"] == "approved"


async def test_delete_site(client):
    create_resp = await client.post("/api/sites", json={
        "name": "To Delete",
        "slug": "to-delete",
        "latitude": 0.0,
        "longitude": 0.0,
    })
    site_id = create_resp.json()["id"]

    response = await client.delete(f"/api/sites/{site_id}")
    assert response.status_code == 204

    get_resp = await client.get(f"/api/sites/{site_id}")
    assert get_resp.status_code == 404

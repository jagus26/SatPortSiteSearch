from app.services.auth import hash_password, verify_password, create_access_token, decode_token


async def test_password_hashing():
    password = "securepassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


async def test_jwt_token_roundtrip():
    token = create_access_token({"sub": "user@example.com", "role": "internal"})
    payload = decode_token(token)
    assert payload["sub"] == "user@example.com"
    assert payload["role"] == "internal"


async def test_register_and_login(client):
    # Register
    response = await client.post("/api/auth/register", json={
        "email": "admin@satport.com",
        "password": "securepass123",
        "role": "internal",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "admin@satport.com"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()

    # Login
    response = await client.post("/api/auth/login", json={
        "email": "admin@satport.com",
        "password": "securepass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json={
        "email": "user@test.com",
        "password": "correctpassword",
        "role": "internal",
    })
    response = await client.post("/api/auth/login", json={
        "email": "user@test.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_nonexistent_user(client):
    response = await client.post("/api/auth/login", json={
        "email": "nobody@test.com",
        "password": "anything",
    })
    assert response.status_code == 401


async def test_me_endpoint(client):
    await client.post("/api/auth/register", json={
        "email": "me@test.com",
        "password": "mypassword",
        "role": "internal",
    })
    login_resp = await client.post("/api/auth/login", json={
        "email": "me@test.com",
        "password": "mypassword",
    })
    token = login_resp.json()["access_token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "me@test.com"
    assert response.json()["role"] == "internal"


async def test_me_endpoint_no_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401

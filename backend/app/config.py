from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://netscraper:netscraper@postgres:5432/netscraper"
    request_timeout_seconds: float = 8.0
    max_concurrent_checks: int = 20
    cors_allowed_origins: list[str] = ["http://localhost:3100", "http://127.0.0.1:3100"]
    tor_proxy_url: str = "socks5://127.0.0.1:9050"

    # Fonte governamental oficial (único link externo aceito fora de fluxo público de plataforma)
    ofac_sdn_url: str = "https://sanctionssearch.ofac.treas.gov"
    opensanctions_url: str = "https://api.opensanctions.org"
    # OpenSanctions passou a exigir API key (gratuita mediante cadastro em
    # opensanctions.org/api/ — confirmado em teste ao vivo, corrige suposição
    # anterior de endpoint keyless). Ainda é agregador sem fins lucrativos de
    # dado governamental, não serviço privado comercial — não viola a regra
    # de arquitetura, só precisa de configuração.
    opensanctions_api_key: str | None = None

    class Config:
        env_prefix = "NETSCRAPER_"


settings = Settings()

"""OSINT de conta Google via sessão OAuth do próprio investigador.

Reimplementação nativa do padrão GHunt (ver vault: Tools - Identifier
Lookup#GHunt). A autenticação é SEMPRE a do usuário do Net Scraper logado
com sua própria conta Google (nunca sessão/cookie de terceiro) — isso é o
que separa essa técnica das excluídas (Nqntnqnqmb/Toutatis).

TODO:
- Fluxo OAuth próprio (armazenar refresh token por investigador, não por
  investigação)
- `lookup_gaia_profile`: dado um e-mail Gmail, resolver Gaia ID e o que
  estiver publicamente exposto (nome, foto, YouTube, avaliação no Maps,
  evento público de Calendar)
"""

from dataclasses import dataclass


@dataclass
class GoogleAccountProfile:
    email: str
    gaia_id: str | None
    display_name: str | None
    profile_photo_url: str | None
    youtube_channel_url: str | None
    discovered_by: str = "checkers.google_account"


async def lookup_gaia_profile(email: str, investigator_oauth_token: str) -> GoogleAccountProfile:
    raise NotImplementedError("Ver vault: Tools - Identifier Lookup#GHunt para o mapeamento de endpoint interno do Google.")

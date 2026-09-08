"""Serialização de dado do caso pro formato que o frontend renderiza como gráfico.

Ver vault: Tools - Presentation Output. A renderização em si (D3/Observable
Plot) acontece no frontend — aqui só formatamos os dados agregados, sem
gerar imagem/PDF no backend nem depender de app externo (RAWGraphs/Datawrapper).
"""

from collections import Counter
from dataclasses import dataclass

from app.models.identifier import Account


@dataclass
class ChartSeries:
    label: str
    value: int


def accounts_by_platform(accounts: list[Account]) -> list[ChartSeries]:
    counts = Counter(account.platform for account in accounts if account.exists)
    return [ChartSeries(label=platform, value=count) for platform, count in counts.most_common()]


def accounts_by_discovery_source(accounts: list[Account]) -> list[ChartSeries]:
    counts = Counter(account.discovered_by for account in accounts if account.exists)
    return [ChartSeries(label=source, value=count) for source, count in counts.most_common()]

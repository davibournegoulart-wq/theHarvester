"""Exploração de CSV/dump em massa — substitui embutir o Datasette.

Ver vault: Tools - Correlation and Case Management#Datasette. Endpoint
próprio: aceita CSV, expõe colunas + filtro/busca full-text simples sobre
as linhas. Schema dinâmico — não criamos uma tabela SQL por dataset
importado, só lemos sob demanda (arquivo referenciado em BulkDataset.source_path).
"""

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DatasetPreview:
    columns: list[str]
    row_count: int
    sample_rows: list[dict]


def inspect_csv(path: str, sample_size: int = 20) -> DatasetPreview:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        rows = list(reader)

    return DatasetPreview(columns=columns, row_count=len(rows), sample_rows=rows[:sample_size])


def filter_csv(path: str, query: str, columns: list[str] | None = None) -> list[dict]:
    """Busca full-text simples: retorna linha se `query` aparece em qualquer
    valor de célula (ou só nas `columns` informadas)."""
    matches: list[dict] = []
    query_lower = query.lower()

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            haystack = row.values() if not columns else (row[c] for c in columns if c in row)
            if any(query_lower in str(value).lower() for value in haystack):
                matches.append(row)

    return matches


def register_dataset(source_path: str, name: str) -> DatasetPreview:
    if not Path(source_path).exists():
        raise FileNotFoundError(source_path)
    return inspect_csv(source_path)

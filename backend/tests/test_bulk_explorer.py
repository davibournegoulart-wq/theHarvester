import csv

import pytest

from app.bulk.explorer import filter_csv, inspect_csv, register_dataset


@pytest.fixture
def sample_csv(tmp_path):
    path = tmp_path / "sample.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email"])
        writer.writeheader()
        writer.writerow({"name": "Davi Goulart", "email": "davi@example.com"})
        writer.writerow({"name": "Outra Pessoa", "email": "outra@example.com"})
    return str(path)


def test_inspect_csv_reads_columns_and_rows(sample_csv):
    preview = inspect_csv(sample_csv)
    assert preview.columns == ["name", "email"]
    assert preview.row_count == 2
    assert preview.sample_rows[0]["name"] == "Davi Goulart"


def test_inspect_csv_respects_sample_size(sample_csv):
    preview = inspect_csv(sample_csv, sample_size=1)
    assert preview.row_count == 2  # total continua contando todas as linhas
    assert len(preview.sample_rows) == 1  # mas a amostra respeita o limite


def test_filter_csv_matches_across_all_columns(sample_csv):
    matches = filter_csv(sample_csv, "Davi")
    assert len(matches) == 1
    assert matches[0]["name"] == "Davi Goulart"


def test_filter_csv_is_case_insensitive(sample_csv):
    matches = filter_csv(sample_csv, "davi goulart")
    assert len(matches) == 1


def test_filter_csv_can_be_scoped_to_specific_columns(sample_csv):
    # "outra" só aparece no e-mail de uma linha e no nome de outra ("Outra Pessoa") —
    # restringindo a busca à coluna "email" só deve casar quem tem no e-mail.
    matches = filter_csv(sample_csv, "outra", columns=["email"])
    assert len(matches) == 1
    assert matches[0]["email"] == "outra@example.com"


def test_filter_csv_returns_empty_when_nothing_matches(sample_csv):
    assert filter_csv(sample_csv, "não existe nesse csv") == []


def test_register_dataset_raises_for_missing_file():
    with pytest.raises(FileNotFoundError):
        register_dataset("/caminho/que/nao/existe.csv", "teste")


def test_register_dataset_returns_preview_for_existing_file(sample_csv):
    preview = register_dataset(sample_csv, "teste")
    assert preview.row_count == 2

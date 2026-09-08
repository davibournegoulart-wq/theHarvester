from app.recon.email_pattern import generate_permutations


def test_generates_expected_permutation_shapes():
    permutations = generate_permutations("Davi", "Goulart", "example.com")
    assert permutations == [
        "davi.goulart@example.com",
        "dgoulart@example.com",
        "davig@example.com",
        "davi@example.com",
        "davi_goulart@example.com",
    ]


def test_lowercases_regardless_of_input_case():
    permutations = generate_permutations("DAVI", "GOULART", "example.com")
    assert permutations[0] == "davi.goulart@example.com"

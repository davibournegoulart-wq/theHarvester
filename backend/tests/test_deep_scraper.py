from app.recon.deep_scraper import extract_entities

def test_extract_entities():
    text = """
    Encontramos o alvo. O e-mail dele é hacker_master@gmail.com e o telefone secundário 
    é +55 11 99999-1234. O CPF do laranja é 123.456.789-00, e ele recebeu pagamento 
    na carteira BTC 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa. Também tem uma ETH 0x32Be343B94f860124dC4fEe278FDCBD38C102D88.
    Outro email test.email@protonmail.ch.
    """
    
    result = extract_entities(text)
    
    assert len(result.emails) == 2
    assert "hacker_master@gmail.com" in result.emails
    assert "test.email@protonmail.ch" in result.emails
    
    assert len(result.phones) == 1
    assert result.phones[0] == "+55 11 99999-1234"
    
    assert len(result.cpfs) == 1
    assert result.cpfs[0] == "123.456.789-00"
    
    assert len(result.btc_addresses) == 1
    assert result.btc_addresses[0] == "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    
    assert len(result.eth_addresses) == 1
    assert result.eth_addresses[0] == "0x32Be343B94f860124dC4fEe278FDCBD38C102D88"

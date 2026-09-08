from app.recon.reverse_image import generate_reverse_image_links


def test_generates_all_engine_links():
    links = generate_reverse_image_links("https://example.com/photo.jpg")
    engines = {link.engine for link in links}
    assert engines == {"Google Images", "Yandex", "TinEye", "Bing"}
    for link in links:
        assert "example.com%2Fphoto.jpg" in link.search_url

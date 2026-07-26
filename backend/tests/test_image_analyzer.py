import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.image_analyzer import ImageAnalyzer, ImageFetchError
from app.crawler import ImageData


@pytest.fixture
def analyzer():
    return ImageAnalyzer()


def mock_async_cm(resp_mock):
    ctx_mgr = MagicMock()
    ctx_mgr.__aenter__ = AsyncMock(return_value=resp_mock)
    ctx_mgr.__aexit__ = AsyncMock(return_value=None)
    return ctx_mgr


class TestImageAnalyzer:
    @pytest.mark.asyncio
    async def test_download_success(self, analyzer):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "image/jpeg"}
        mock_resp.read = AsyncMock(return_value=b"fake_image_bytes")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            data = await analyzer.download("https://example.com/image.jpg")
            assert data == b"fake_image_bytes"

    @pytest.mark.asyncio
    async def test_download_404(self, analyzer):
        mock_resp = MagicMock()
        mock_resp.status = 404

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            with pytest.raises(ImageFetchError):
                await analyzer.download("https://example.com/missing.jpg")

    @pytest.mark.asyncio
    async def test_download_non_image_content(self, analyzer):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "text/html"}

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            with pytest.raises(ImageFetchError):
                await analyzer.download("https://example.com/not-an-image")

    @pytest.mark.asyncio
    async def test_download_caches(self, analyzer):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "image/png"}
        mock_resp.read = AsyncMock(return_value=b"data")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            data1 = await analyzer.download("https://example.com/img.png")
            data2 = await analyzer.download("https://example.com/img.png")
            assert data1 == data2
            assert mock_session.get.call_count == 1

    def test_deduplicate(self, analyzer):
        images = [
            ImageData(url="https://example.com/a.jpg", source_page="https://example.com/1"),
            ImageData(url="https://example.com/b.jpg", source_page="https://example.com/2"),
            ImageData(url="https://example.com/a.jpg", source_page="https://example.com/3"),
        ]
        unique = analyzer.deduplicate(images)
        assert len(unique) == 2
        assert unique[0].url == "https://example.com/a.jpg"
        assert unique[1].url == "https://example.com/b.jpg"

    @pytest.mark.asyncio
    async def test_validate_image_url_success(self, analyzer):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "image/webp"}
        mock_resp.read = AsyncMock(return_value=b"data")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            result = await analyzer.validate_image_url("https://example.com/test.webp")
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_image_url_failure(self, analyzer):
        mock_get = MagicMock(side_effect=Exception("Network error"))
        mock_session = MagicMock()
        mock_session.get = mock_get

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            result = await analyzer.validate_image_url("https://example.com/broken")
            assert result is False

    def test_extract_context(self, analyzer):
        html = """
        <html>
        <body>
            <figure>
                <img src="/images/photo.jpg" alt="The CEO">
                <figcaption>CEO at company event</figcaption>
            </figure>
        </body>
        </html>
        """
        context = analyzer.extract_context(html, "photo.jpg")
        assert context is not None
        assert "CEO" in context

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.crawler import Crawler, SearchResult, PageData, ImageData, CrawlerError


@pytest.fixture
def crawler():
    return Crawler()


def mock_async_cm(resp_mock):
    ctx_mgr = MagicMock()
    ctx_mgr.__aenter__ = AsyncMock(return_value=resp_mock)
    ctx_mgr.__aexit__ = AsyncMock(return_value=None)
    return ctx_mgr


class TestCrawler:
    @pytest.mark.asyncio
    async def test_search_parses_valid_response(self, crawler):
        mock_data = {
            "results": [
                {"title": "Result 1", "url": "https://example.com/1", "content": "Snippet 1"},
                {"title": "Result 2", "url": "https://example.com/2", "content": "Snippet 2", "thumbnail": "https://example.com/img.jpg"},
            ]
        }

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_data)

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        session_cm = mock_async_cm(mock_session)

        with patch("aiohttp.ClientSession", return_value=session_cm):
            results = await crawler.search("test query")
            assert len(results) == 2
            assert results[0].title == "Result 1"
            assert results[1].img_src == "https://example.com/img.jpg"

    @pytest.mark.asyncio
    async def test_search_empty_results(self, crawler):
        mock_data = {"results": []}

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_data)

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            results = await crawler.search("garbage query")
            assert len(results) == 0

    @pytest.mark.asyncio
    async def test_search_respects_max_results(self, crawler):
        mock_data = {
            "results": [
                {"title": f"Result {i}", "url": f"https://example.com/{i}", "content": ""}
                for i in range(20)
            ]
        }

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.json = AsyncMock(return_value=mock_data)

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            results = await crawler.search("test", max_results=5)
            assert len(results) == 5

    @pytest.mark.asyncio
    async def test_search_http_error(self, crawler):
        mock_resp = MagicMock()
        mock_resp.status = 500

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            with pytest.raises(CrawlerError):
                await crawler.search("test")

    @pytest.mark.asyncio
    async def test_fetch_page_success(self, crawler):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.url = "https://example.com/page"
        mock_resp.text = AsyncMock(return_value="<html><body><p>Hello</p></body></html>")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            page = await crawler.fetch_page("https://example.com/page")
            assert page.status == 200
            assert "<p>Hello</p>" in page.html

    @pytest.mark.asyncio
    async def test_fetch_page_http_error(self, crawler):
        mock_resp = MagicMock()
        mock_resp.status = 404
        mock_resp.url = "https://example.com/notfound"
        mock_resp.text = AsyncMock(return_value="Not Found")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            page = await crawler.fetch_page("https://example.com/notfound")
            assert page.status == 404

    @pytest.mark.asyncio
    async def test_fetch_pages_concurrent(self, crawler):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.url = "https://example.com/page"
        mock_resp.text = AsyncMock(return_value="<html></html>")

        ctx_mgr = mock_async_cm(mock_resp)
        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=ctx_mgr)

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            pages = await crawler.fetch_pages([
                "https://example.com/1",
                "https://example.com/2",
                "https://example.com/3",
            ])
            assert len(pages) == 3

    @pytest.mark.asyncio
    async def test_fetch_pages_skips_errors(self, crawler):
        mock_resp_ok = MagicMock()
        mock_resp_ok.status = 200
        mock_resp_ok.url = "https://example.com/ok"
        mock_resp_ok.text = AsyncMock(return_value="<html></html>")

        ctx_mgr_ok = mock_async_cm(mock_resp_ok)
        mock_session = MagicMock()

        def get_side_effect(*args, **kwargs):
            # Return OK for first and third, raise for second
            ctx_mgr_ok2 = mock_async_cm(MagicMock(
                status=200,
                url="https://example.com/ok2",
                text=AsyncMock(return_value="<html></html>"),
            ))
            # We need to track calls; this is a rough simulation
            return ctx_mgr_ok

        mock_session.get = MagicMock(side_effect=[ctx_mgr_ok, Exception("fail"), ctx_mgr_ok])

        with patch("aiohttp.ClientSession", return_value=mock_async_cm(mock_session)):
            pages = await crawler.fetch_pages([
                "https://example.com/ok",
                "https://example.com/fail",
                "https://example.com/ok2",
            ])
            assert len(pages) == 2

    def test_extract_text_removes_tags(self, crawler):
        page = PageData(
            url="https://example.com",
            html="<html><body><p>Main content</p><script>alert('x')</script><style>.c{}</style><nav>Menu</nav></body></html>",
        )
        text = crawler.extract_text(page)
        assert "Main content" in text
        assert "alert" not in text
        assert "Menu" not in text

    def test_extract_text_truncates(self, crawler):
        page = PageData(
            url="https://example.com",
            html=f"<html><body><p>{'x' * 15000}</p></body></html>",
        )
        text = crawler.extract_text(page)
        assert len(text) <= 10000

    def test_extract_images(self, crawler):
        page = PageData(
            url="https://example.com/page",
            html="""
            <html>
            <body>
                <img src="https://example.com/img1.jpg" alt="Image 1">
                <figure>
                    <img src="/relative/img2.jpg" alt="Image 2">
                    <figcaption>The caption</figcaption>
                </figure>
                <img data-src="https://example.com/img3.png" alt="">
            </body>
            </html>
            """,
        )
        images = crawler.extract_images(page)
        assert len(images) == 3
        assert images[0].url == "https://example.com/img1.jpg"
        assert images[0].alt_text == "Image 1"
        assert images[1].url == "https://example.com/relative/img2.jpg"
        assert images[1].context is not None
        assert images[2].url == "https://example.com/img3.png"

    def test_extract_images_empty(self, crawler):
        page = PageData(url="https://example.com", html="<html><body></body></html>")
        images = crawler.extract_images(page)
        assert len(images) == 0

    def test_extract_images_max_limit(self, crawler):
        imgs = "".join(f'<img src="https://example.com/img{i}.jpg">' for i in range(20))
        page = PageData(url="https://example.com", html=f"<html><body>{imgs}</body></html>")
        images = crawler.extract_images(page, max_images=10)
        assert len(images) == 10

import asyncio
import re
import ssl
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin

import aiohttp
from bs4 import BeautifulSoup

from app.config import settings

_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    img_src: Optional[str] = None


@dataclass
class PageData:
    url: str
    html: str
    status: int = 200


@dataclass
class ImageData:
    url: str
    alt_text: Optional[str] = None
    context: Optional[str] = None
    source_page: str = ""


class CrawlerError(Exception):
    pass


class Crawler:
    def __init__(self):
        self.searxng_url = settings.searxng_url
        self.timeout = aiohttp.ClientTimeout(total=settings.crawl_request_timeout)
        self.max_concurrent = settings.max_concurrent_fetches
        self._semaphore = asyncio.Semaphore(self.max_concurrent)

    async def search(self, query: str, max_results: int = 10, categories: list[str] = None) -> list[SearchResult]:
        params = {
            "q": query,
            "format": "json",
            "pageno": 1,
            "language": "en",
        }
        if categories:
            params["categories"] = ",".join(categories)
        else:
            params["categories"] = "general"

        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(
                    f"{self.searxng_url}/search",
                    params=params,
                ) as resp:
                    if resp.status != 200:
                        raise CrawlerError(f"SearXNG returned status {resp.status}")
                    data = await resp.json()
        except asyncio.TimeoutError:
            raise CrawlerError("SearXNG request timed out")
        except aiohttp.ClientError as e:
            raise CrawlerError(f"SearXNG connection error: {str(e)}")

        results = []
        for r in data.get("results", [])[:max_results]:
            results.append(SearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                snippet=r.get("content", ""),
                img_src=r.get("thumbnail") or r.get("img_src"),
            ))

        return results

    async def fetch_page(self, url: str) -> PageData:
        async with self._semaphore:
            try:
                async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_ssl_ctx), timeout=self.timeout) as session:
                    async with session.get(
                        url,
                        headers={
                            "User-Agent": "Mozilla/5.0 (compatible; TargetDeepSearch/1.0)",
                            "Accept": "text/html,application/xhtml+xml",
                        },
                        allow_redirects=True,
                    ) as resp:
                        html = await resp.text()
                        return PageData(url=str(resp.url), html=html, status=resp.status)
            except asyncio.TimeoutError:
                raise CrawlerError(f"Timeout fetching {url}")
            except aiohttp.ClientError as e:
                raise CrawlerError(f"Error fetching {url}: {str(e)}")

    async def fetch_pages(self, urls: list[str]) -> list[PageData]:
        tasks = [self.fetch_page(url) for url in urls if url]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        pages = []
        for result in results:
            if isinstance(result, CrawlerError):
                continue
            if isinstance(result, PageData):
                pages.append(result)

        return pages

    def extract_text(self, page: PageData) -> str:
        soup = BeautifulSoup(page.html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)
        text = re.sub(r"\s+", " ", text)
        return text[:10000]

    def extract_images(self, page: PageData, max_images: int = 15) -> list[ImageData]:
        soup = BeautifulSoup(page.html, "lxml")
        images = []

        for img in soup.find_all("img"):
            if len(images) >= max_images:
                break

            src = img.get("src") or img.get("data-src")
            if not src:
                continue

            if not src.startswith(("http://", "https://")):
                src = urljoin(page.url, src)

            alt = img.get("alt", "") or ""

            parent = img.find_parent(["p", "div", "figure", "section"])
            context = parent.get_text(strip=True)[:300] if parent else ""

            images.append(ImageData(
                url=src,
                alt_text=alt[:200] if alt else None,
                context=context if context else None,
                source_page=page.url,
            ))

        return images

    def extract_text_and_images(self, page: PageData) -> tuple[str, list[ImageData]]:
        text = self.extract_text(page)
        images = self.extract_images(page)
        return text, images

import asyncio
from typing import Optional
import aiohttp
from app.crawler import ImageData, _ssl_ctx


class ImageFetchError(Exception):
    pass


class ImageAnalyzer:
    def __init__(self):
        self._cache: dict = {}

    async def download(self, url: str) -> bytes:
        if url in self._cache:
            return self._cache[url]

        try:
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_ssl_ctx)) as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=10),
                    headers={"User-Agent": "Mozilla/5.0 (compatible; TargetDeepSearch/1.0)"},
                ) as resp:
                    if resp.status != 200:
                        raise ImageFetchError(f"Image fetch returned {resp.status}")
                    content_type = resp.headers.get("Content-Type", "")
                    if "image" not in content_type:
                        raise ImageFetchError(f"URL does not point to an image: {content_type}")
                    data = await resp.read()
                    if len(data) > 10 * 1024 * 1024:
                        raise ImageFetchError("Image too large (>10MB)")
                    self._cache[url] = data
                    return data
        except asyncio.TimeoutError:
            raise ImageFetchError(f"Timeout fetching image {url}")
        except aiohttp.ClientError as e:
            raise ImageFetchError(f"Error fetching image {url}: {str(e)}")

    def extract_context(self, html: str, image_url: str) -> Optional[str]:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src and src.endswith(image_url.split("/")[-1]):
                parent = img.find_parent(["p", "div", "figure", "section"])
                if parent:
                    return parent.get_text(strip=True)[:300]
        return None

    def deduplicate(self, images: list) -> list:
        seen_urls = set()
        unique = []
        for img in images:
            if img.url not in seen_urls:
                seen_urls.add(img.url)
                unique.append(img)
        return unique

    async def validate_image_url(self, url: str) -> bool:
        try:
            await self.download(url)
            return True
        except (ImageFetchError, Exception):
            return False

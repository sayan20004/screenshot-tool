const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Endpoint to capture screenshot
app.post('/api/screenshot', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set a standard desktop viewport
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to the URL
    // waitUntil networkidle2 ensures most of the page has loaded
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Capture the full page screenshot
    const screenshotBuffer = await page.screenshot({ fullPage: true, encoding: 'base64' });

    // Extract all internal links from the page
    const baseUrl = new URL(url);
    const origin = baseUrl.origin;

    const extractedLinks = await page.evaluate((pageOrigin, currentUrl) => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const links = anchors
        .map((a) => a.getAttribute('href')) // Get raw href to avoid browser pre-resolution in some cases
        .filter(Boolean)
        .map((href) => {
          try {
            // Handle relative paths and absolute paths
            const parsedUrl = new URL(href, pageOrigin);
            return parsedUrl.href;
          } catch (e) {
            return null;
          }
        })
        .filter((href) => href && href.startsWith(pageOrigin)); // Only keep internal links

      // Return unique links
      const uniqueLinks = [...new Set(links)];

      // Ensure the home page is always available in the dropdown
      if (!uniqueLinks.includes(pageOrigin) && !uniqueLinks.includes(`${pageOrigin}/`)) {
        uniqueLinks.unshift(pageOrigin); // Prepend origin to list
      }

      // Ensure the current URL is also in the list if it's somehow missing but we are on it
      if (currentUrl && !uniqueLinks.includes(currentUrl) && currentUrl.startsWith(pageOrigin)) {
        uniqueLinks.push(currentUrl);
      }

      return uniqueLinks;
    }, origin, url);

    res.json({
      success: true,
      image: `data:image/png;base64,${screenshotBuffer}`,
      subPages: extractedLinks,
    });
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    res.status(500).json({ error: 'Failed to capture screenshot', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Screenshot API listening on http://localhost:${PORT}`);
});

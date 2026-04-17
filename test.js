const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', error => console.log('ERR:', error.message));
        page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure().errorText));
        await page.goto('file:///home/akash/chess/index.html', { waitUntil: 'networkidle0' });
        console.log('PAGE TITLE:', await page.title());
        await browser.close();
    } catch(e) {
        console.log('exception:', e);
    }
})();

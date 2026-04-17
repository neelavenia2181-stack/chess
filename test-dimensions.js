const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('file:///home/akash/chess/index.html', { waitUntil: 'networkidle0' });
    
    // Evaluate in browser context
    const dimensions = await page.evaluate(() => {
        const board = document.getElementById('board');
        const boardArea = document.querySelector('.board-area');
        const boardReact = board ? board.getBoundingClientRect() : null;
        const areaReact = boardArea ? boardArea.getBoundingClientRect() : null;
        const squares = document.querySelectorAll('.square').length;
        
        return {
            board: boardReact ? { w: boardReact.width, h: boardReact.height, vis: window.getComputedStyle(board).display } : null,
            area: areaReact ? { w: areaReact.width, h: areaReact.height, opacity: window.getComputedStyle(boardArea).opacity } : null,
            squares: squares
        };
    });
    
    console.log(JSON.stringify(dimensions, null, 2));
    await browser.close();
})();

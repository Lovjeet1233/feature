// scraper/linkedin.js
const puppeteer = require('puppeteer');
require('dotenv').config();

// LinkedIn credentials from environment variables
const EMAIL = process.env.LINKEDIN_EMAIL;
const PASSWORD = process.env.LINKEDIN_PASSWORD;

// Helper function for creating delays (works with any Puppeteer version)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main scraper function
async function scrapeCompanyPeople(companyHandle) {
  console.log(`Scraping profiles from: ${companyHandle}`);
  
  // Launch browser in headless mode
  const browser = await puppeteer.launch({
    headless: true, // Use basic 'true' for compatibility with all versions
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Set longer navigation timeout
    page.setDefaultNavigationTimeout(30000); // 60 seconds
    
    // Login to LinkedIn
    console.log("Navigating to LinkedIn login page...");
    await page.goto('https://www.linkedin.com/login', { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Check if we have credentials
    if (!EMAIL || !PASSWORD) {
      throw new Error('LinkedIn credentials are missing in environment variables');
    }
    
    console.log("Logging in to LinkedIn...");
    // Enter email and password
    await page.type('#username', EMAIL);
    await page.type('#password', PASSWORD);
    
    // Click the sign in button
    try {
      await Promise.all([
        page.click('.login__form_action_container button'),
        // Wait for navigation with longer timeout
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
      ]);
    } catch (error) {
      console.log("Navigation timeout during login, but continuing...");
      // Continue execution even if timeout occurs - sometimes LinkedIn continues loading
    }
    
    // Check if login was successful by looking for a common LinkedIn dashboard element
    try {
      await page.waitForSelector('#global-nav, .feed-identity-module', { timeout: 10000 });
      console.log('Successfully logged in to LinkedIn');
    } catch (error) {
      console.log("Could not verify login success, but continuing...");
      // Add a delay to give the page more time to load
      await delay(5000); // Custom delay function
    }
    
    // Navigate to company's people page
    console.log(`Navigating to company page for: ${companyHandle}`);
    const companyUrl = `https://www.linkedin.com/company/${companyHandle}/people/`;
    
    try {
      await page.goto(companyUrl, { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    } catch (error) {
      console.log("Navigation timeout on company page, but continuing...");
      // Add a delay to give the page more time to load
      await delay(10000); // Custom delay function
    }
    
    console.log("Scrolling to load more profiles...");
    // Scroll down to load more profiles
    await autoScroll(page);
    
    // Wait for profile cards to load with a more reliable selector
    console.log("Waiting for profile cards to load...");
    try {
      await page.waitForSelector('li.org-people-profile-card', { 
        timeout: 15000 
      });
    } catch (error) {
      console.log("Selector timeout, trying alternative selector...");
      try {
        // Try alternative selector
        await page.waitForSelector('.org-people-profile-card', { 
          timeout: 10000 
        });
      } catch (error) {
        console.log("Could not find profile cards with expected selectors");
      }
    }
    
    // Extract data from profile cards with multiple potential selectors
    console.log("Extracting profile data...");
    const data = await page.evaluate(() => {
      // Try different selectors that LinkedIn might be using
      const cards = document.querySelectorAll('li.org-people-profile-card__profile-card-spacing, li.org-people-profile-card, .org-people-profile-card');
      const profiles = [];
      
      cards.forEach(card => {
        try {
          // Profile name and URL - try multiple selectors
          let linkTag = card.querySelector('a[data-test-app-aware-link]');
          if (!linkTag) linkTag = card.querySelector('.org-people-profile-card__profile-title a');
          if (!linkTag) linkTag = card.querySelector('a.app-aware-link');
          
          const profileName = linkTag ? linkTag.innerText.trim() : 'N/A';
          const profileUrl = linkTag ? linkTag.href : 'N/A';
          
          // Image URL - try multiple selectors
          let imgTag = card.querySelector('img');
          const imageUrl = imgTag ? imgTag.src : 'Not Available';
          
          // Title - try multiple selectors
          let titleElement = card.querySelector('div.artdeco-entity-lockup__title');
          if (!titleElement) titleElement = card.querySelector('.org-people-profile-card__profile-title');
          const title = titleElement ? titleElement.innerText.trim() : 'N/A';
          
          // Subtitle (Role/Skills) - try multiple selectors
          let subtitleElement = card.querySelector('div.artdeco-entity-lockup__subtitle');
          if (!subtitleElement) subtitleElement = card.querySelector('.org-people-profile-card__profile-sub-title');
          const subtitle = subtitleElement ? subtitleElement.innerText.trim() : 'N/A';
          
          profiles.push({
            profileName,
            profileUrl,
            imageUrl,
            title,
            subtitle
          });
        } catch (error) {
          console.error('Error processing card:', error);
        }
      });
      
      return profiles;
    });
    
    console.log(`Found ${data.length} profiles`);
    
    if (data.length === 0) {
      console.log("No profiles found.");
    }
    
    return data;
    
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    // Always close the browser
    await browser.close();
    console.log("Browser closed");
  }
}

// Helper function to scroll down the page and load more content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      let iterations = 0;
      const maxIterations = 20; // Limit scrolling to prevent infinite loops
      
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        iterations++;
        
        if (totalHeight >= scrollHeight || iterations >= maxIterations) {
          clearInterval(timer);
          resolve();
        }
      }, 200); // Slower scrolling to give content time to load
    });
  });
  
  // Wait a moment after scrolling using custom delay function
  await delay(3000);
}

module.exports = {
  scrapeCompanyPeople
};
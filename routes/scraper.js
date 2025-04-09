const express = require('express');
const router = express.Router();
const linkedinScraper = require('../scraper/linkedin');

router.post('/scrape', async (req, res) => {
  try {
    const { companyHandle } = req.body;
    
    if (!companyHandle) {
      return res.status(400).json({ 
        success: false, 
        message: 'Company handle is required' 
      });
    }

    console.log(`Starting to scrape company: ${companyHandle}`);
    const data = await linkedinScraper.scrapeCompanyPeople(companyHandle);
    
    res.json({
      success: true,
      company: companyHandle,
      data: data
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error occurred during scraping' 
    });
  }
});

module.exports = router;
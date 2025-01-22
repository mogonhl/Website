from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import json
import re
import time
from typing import Dict, List
import os
import requests

class HypurrScraper:
    def __init__(self, headless=False):
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument('--headless=new')  # New headless mode
        options.add_argument('--start-maximized')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-popup-blocking')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # Reduce noise in logs
        options.add_argument('--log-level=3')
        options.add_experimental_option('excludeSwitches', ['enable-logging'])
        
        # Performance options
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--no-sandbox')
        
        # Enable performance logging
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        print("Initializing Chrome...")
        self.driver = webdriver.Chrome(options=options)
        print("Chrome initialized successfully")
        self.stream_id = None
        self.market_caps: Dict[str, float] = {}  # Track market caps
        self.launches_data: List[dict] = []  # Store all launch data

    def get_network_requests(self):
        """Extract network requests from browser logs"""
        # Wait a bit for the request to happen
        time.sleep(2)
        logs = self.driver.get_log('performance')
        
        # Clear previous logs
        self.driver.execute_script("console.clear()")
        
        for log in logs:
            try:
                network_log = json.loads(log['message'])['message']
                
                request = network_log['params'].get('request', {})
                url = request.get('url', '')
                method = request.get('method', '')
                
                # Look specifically for HyperliquidLaunchCandleStream POST requests
                if 'HyperliquidLaunchCandleStream' in url and method == 'POST':
                    stream_id = request.get('postData', '')
                    if stream_id:
                        print(f"\nFound HyperliquidLaunchCandleStream POST request:")
                        print(f"URL: {url}")
                        print(f"Method: {method}")
                        print(f"StreamId: {stream_id}")
                        return stream_id
                        
            except Exception as e:
                print(f"Error parsing network log: {e}")
                continue
        return None

    def wait_for_element_with_retry(self, script, max_wait=30, check_interval=0.5):
        """Wait for an element to be present using JavaScript, with adaptive timing"""
        start_time = time.time()
        while time.time() - start_time < max_wait:
            result = self.driver.execute_script(script)
            if result:
                return result
            time.sleep(check_interval)
        return None

    def extract_links(self, description):
        links = {}
        # Extract Twitter/X links
        twitter_match = re.search(r'(?:twitter\.com|x\.com)/(\S+)', description)
        if twitter_match:
            links['twitter'] = f"https://x.com/{twitter_match.group(1)}"
            
        # Extract Telegram links
        telegram_match = re.search(r't\.me/(\S+)', description)
        if telegram_match:
            links['telegram'] = f"https://t.me/{telegram_match.group(1)}"
            
        # Extract website links
        website_match = re.search(r'(?:https?://)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', description)
        if website_match and 'x.com' not in website_match.group(0) and 't.me' not in website_match.group(0):
            links['website'] = website_match.group(0)
            
        return links

    def parse_market_cap(self, text):
        """Convert market cap string to numeric value in dollars"""
        try:
            # Remove $ and any whitespace
            clean = text.replace('$', '').strip()
            
            # Handle different formats
            if 'M' in clean:
                return float(clean.replace('M', '')) * 1_000_000
            elif 'K' in clean:
                return float(clean.replace('K', '')) * 1_000
            else:
                return float(clean)
        except:
            return 0

    def wait_for_page_load(self):
        """Wait for the page to load and scroll to trigger lazy loading"""
        print("Waiting for page to load...")
        time.sleep(2)
        
        # Scroll to trigger any lazy loading
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1)
        self.driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(1)

    def scrape_launch_page(self, url):
        print(f"\nNavigating to {url}")
        max_retries = 2
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                self.driver.get(url)
                self.wait_for_page_load()
                print("Waiting for page elements...")
                
                # Get streamId from network requests
                stream_id = self.get_network_requests()
                print(f"StreamId from network: {stream_id}")
                
                # If not found in network, try page source as fallback
                if not stream_id:
                    try:
                        page_source = self.driver.page_source
                        stream_match = re.search(r'AAAAAAcI[a-zA-Z0-9]+', page_source)
                        if stream_match:
                            stream_id = stream_match.group(0)
                            print(f"StreamId from page source: {stream_id}")
                    except Exception as e:
                        print(f"Error finding streamId in page source: {e}")
                
                if not stream_id:
                    print("Could not find streamId, will retry")
                    retry_count += 1
                    continue
                
                # Wait for market cap with more precise detection
                market_cap_text = self.wait_for_element_with_retry("""
                    function findMarketCap() {
                        // First try the most reliable selector
                        const elements = document.querySelectorAll('div.text-\\\\[10px\\\\]');
                        for (const el of elements) {
                            if (el.textContent.includes('Market cap')) {
                                const value = el.textContent.split(':')[1];
                                if (value && (value.includes('$') || value.includes('K') || value.includes('M'))) {
                                    return el.textContent;
                                }
                            }
                        }
                        
                        // Fallback to any element with proper market cap format
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            const text = el.textContent;
                            if (text.includes('Market cap:') && 
                                (text.includes('$') || text.includes('K') || text.includes('M'))) {
                                return text;
                            }
                        }
                        return null;
                    }
                    return findMarketCap();
                """)
                
                if not market_cap_text:
                    print("Could not find market cap after waiting")
                    retry_count += 1
                    continue
                
                # Extract just the value part if it contains "Market Cap:"
                if ':' in market_cap_text:
                    market_cap_text = market_cap_text.split(':')[1].strip()
                
                market_cap_value = self.parse_market_cap(market_cap_text)
                print(f"Market cap: {market_cap_text} (${market_cap_value:,.2f})")
                
                if market_cap_value < 10_000:
                    print(f"Skipping due to low market cap: {market_cap_text}")
                    return None
                
                # Wait for all required elements with adaptive timing
                page_data = self.wait_for_element_with_retry("""
                    const data = {};
                    
                    // Get title and ticker
                    const title = document.querySelector('h2');
                    if (!title) return null;
                    
                    data.fullTitle = title.textContent;
                    const ticker = title.querySelector('p[class*="text-gray-500"]');
                    if (!ticker) return null;
                    data.ticker = ticker.textContent;
                    
                    // Get description
                    const desc = document.querySelector('p[class*="text-[10px]"]');
                    if (!desc) return null;
                    data.description = desc.textContent;
                    
                    // Get icon - look for the specific token's icon
                    const icons = document.querySelectorAll('img[src*="media.hypurr.fun"]');
                    for (const icon of icons) {
                        // Check if icon is within the main content area
                        if (icon.closest('[class*="flex"]')) {
                            data.icon = icon.src;
                            break;
                        }
                    }
                    if (!data.icon) return null;
                    
                    return data;
                """)
                
                if not page_data:
                    print("Could not find all required elements after waiting")
                    retry_count += 1
                    continue
                
                # Process the data
                ticker = page_data['ticker'].strip('()') if page_data.get('ticker') else None
                name = page_data['fullTitle'].replace(page_data['ticker'], '').strip()
                
                if not ticker:
                    print("Could not extract ticker")
                    retry_count += 1
                    continue
                
                # Store market cap
                self.market_caps[ticker] = market_cap_value
                
                print(f"Successfully extracted data:")
                print(f"Name: {name}")
                print(f"Ticker: {ticker}")
                print(f"StreamId: {stream_id}")
                print(f"Icon: {page_data['icon']}")
                
                links = self.extract_links(page_data['description'])
                print(f"Links: {links}")
                
                launch_data = {
                    "id": ticker,
                    "streamId": stream_id,
                    "ticker": ticker,
                    "name": name,
                    "icon": page_data['icon'],
                    "hypurr": url,
                    "links": links,
                    "market_cap": market_cap_value
                }
                
                # Verify all required fields are present
                required_fields = ['id', 'streamId', 'ticker', 'name', 'icon', 'hypurr', 'links']
                missing_fields = [field for field in required_fields if not launch_data.get(field)]
                
                if missing_fields:
                    print(f"Missing required fields: {', '.join(missing_fields)}")
                    retry_count += 1
                    continue
                
                self.launches_data.append(launch_data)
                return launch_data
                
            except Exception as e:
                print(f"Error during page scrape: {e}")
                retry_count += 1
                continue
            
        print(f"Failed to scrape {url} after {max_retries} attempts")
        return None

    def update_launches_data(self):
        """Update launches-data.js with the top 30 assets by market cap"""
        try:
            # Sort launches by market cap
            sorted_launches = sorted(
                self.launches_data,
                key=lambda x: x.get('market_cap', 0),
                reverse=True
            )
            
            # Take top 30
            top_30_launches = sorted_launches[:30]
            
            # Remove market_cap field before saving
            for launch in top_30_launches:
                launch.pop('market_cap', None)
            
            data = {"tokens": top_30_launches}
            
            # Upload to Redis
            print("\nUploading launches data to Redis...")
            try:
                response = requests.post(
                    'https://witty-dassie-40050.upstash.io/set/launches_data',
                    headers={
                        'Authorization': 'Bearer AZxyAAIjcDE3Mzk2MTJkNzJjMDg0Yzk0ODMyZWE3YmRjOGRmZTQxZHAxMA'
                    },
                    json={
                        'key': 'launches_data',
                        'value': {
                            'tokens': top_30_launches
                        }
                    }
                )
                print("Redis request payload:", {
                    'key': 'launches_data',
                    'value': str(data)[:100] + '...' if len(str(data)) > 100 else str(data)
                })
                if response.ok:
                    print("Successfully uploaded launches data to Redis")
                    print("Response:", response.json())
                else:
                    print(f"Failed to upload to Redis: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"Error uploading to Redis: {str(e)}")

            # Format the output JSON for the file
            output_json = json.dumps(data, indent=4, ensure_ascii=False)
            # Clean up any trailing commas in the formatted output
            output_json = re.sub(r',(\s*[}\]])', r'\1', output_json)
            
            # Write back to file using correct path relative to script location
            with open('public/js/launches-data.js', 'w', encoding='utf-8') as f:
                f.write('const launchesData = ' + output_json + ';')
            print(f"\nUpdated launches-data.js with top 30 assets by market cap")
            print(f"Total assets found: {len(self.launches_data)}")
            print(f"Top 30 market caps:")
            for i, launch in enumerate(top_30_launches, 1):
                ticker = launch['ticker']
                mcap = self.market_caps.get(ticker, 0)
                print(f"{i}. {ticker}: ${mcap:,.2f}")
                
        except Exception as e:
            print(f"Error updating launches data: {str(e)}")
            import traceback
            traceback.print_exc()

    def scrape_all_launches(self):
        print("\nNavigating to launches page...")
        max_retries = 2
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                self.driver.get('https://app.hypurr.fun/launches')
                
                # Wait for links with adaptive timing
                urls = self.wait_for_element_with_retry("""
                    const links = document.querySelectorAll('a[href*="/launch/"]');
                    if (links.length === 0) return null;
                    return Array.from(links)
                        .map(a => a.href)
                        .filter((v, i, a) => a.indexOf(v) === i);
                """)
                
                if not urls:
                    print("Could not find any launch links after waiting")
                    retry_count += 1
                    continue
                    
                print(f"\nFound {len(urls)} launch links")
                print(f"\nProcessing {len(urls)} unique launch URLs")
                
                for url in urls:
                    try:
                        print(f"\nScraping {url}")
                        self.scrape_launch_page(url)
                        time.sleep(0.5)  # Small delay between pages to avoid rate limiting
                    except Exception as e:
                        print(f"Error processing {url}: {e}")
                        if "connection" in str(e).lower():
                            print("Connection error detected, restarting Chrome...")
                            try:
                                self.driver.quit()
                            except:
                                pass
                            options = webdriver.ChromeOptions()
                            if self.headless:
                                options.add_argument('--headless=new')
                            options.add_argument('--start-maximized')
                            options.add_argument('--disable-blink-features=AutomationControlled')
                            options.add_argument('--disable-notifications')
                            options.add_argument('--disable-popup-blocking')
                            options.add_experimental_option("excludeSwitches", ["enable-automation"])
                            options.add_experimental_option('useAutomationExtension', False)
                            options.add_argument('--log-level=3')
                            options.add_experimental_option('excludeSwitches', ['enable-logging'])
                            options.add_argument('--disable-gpu')
                            options.add_argument('--disable-dev-shm-usage')
                            options.add_argument('--no-sandbox')
                            options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
                            self.driver = webdriver.Chrome(options=options)
                            continue
                
                self.update_launches_data()
                return
                
            except Exception as e:
                print(f"Error in scrape_all_launches: {e}")
                retry_count += 1
                continue
                
        print("Failed to scrape launches after maximum retries")

    def close(self):
        self.driver.quit()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Scrape Hypurr launches')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    args = parser.parse_args()
    
    print("Starting Hypurr scraper...")
    scraper = HypurrScraper(headless=args.headless)
    try:
        scraper.scrape_all_launches()
    except KeyboardInterrupt:
        print("\nScraping interrupted by user")
    except Exception as e:
        print(f"\nError during scraping: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\nClosing browser...")
        scraper.close()
        print("Done!") 
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
        time.sleep(3)
        logs = self.driver.get_log('performance')
        for log in logs:
            try:
                network_log = json.loads(log['message'])['message']
                if 'Network.requestWillBeSent' not in network_log['method']:
                    continue
                    
                request = network_log['params'].get('request', {})
                if 'HyperliquidLaunchCandleStream' in request.get('url', ''):
                    post_data = request.get('postData', '')
                    if post_data and post_data.startswith('AAAAAA'):
                        return post_data
            except Exception as e:
                print(f"Error parsing network log: {e}")
                continue
        return None

    def wait_for_page_load(self):
        """Wait for the page to load and scroll to trigger lazy loading"""
        print("Waiting for page to load...")
        time.sleep(5)  # Increased initial wait
        
        # Scroll multiple times to trigger lazy loading
        for i in range(3):
            self.driver.execute_script("""
                window.scrollTo({
                    top: document.body.scrollHeight,
                    behavior: 'smooth'
                });
            """)
            time.sleep(2)  # Increased scroll wait
            print(f"Scroll {i+1}/3 complete")
            
        # Scroll back to top
        self.driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(2)  # Increased final wait

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

    def scrape_launch_page(self, url):
        print(f"\nNavigating to {url}")
        self.driver.get(url)
        wait = WebDriverWait(self.driver, 30)  # Increased timeout
        
        try:
            # Wait for any element to confirm page load
            print("Waiting for page to load...")
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-v-f82ffaa3]')))
            time.sleep(3)  # Added extra wait after initial load
            
            # Wait for market cap element specifically
            print("Waiting for market cap...")
            try:
                # Try multiple selectors for market cap
                selectors = [
                    'div.text-\\[10px\\]',  # New primary selector based on screenshot
                    'div[class*="text-[10px]"]',  # Backup with wildcard
                    'div.text-xs',  # More general text size
                    'div[class*="text-xs"]',  # Backup with wildcard
                    'div:contains("Market cap")',  # Content-based selector
                ]
                
                market_cap_elem = None
                market_cap_text = None
                
                for selector in selectors:
                    try:
                        print(f"Trying selector: {selector}")
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        for elem in elements:
                            text = elem.text
                            if 'Market cap' in text:
                                market_cap_elem = elem
                                market_cap_text = text
                                print(f"Found market cap with selector: {selector}")
                                break
                        if market_cap_text:
                            break
                    except Exception as e:
                        continue
                
                if not market_cap_elem or not market_cap_text:
                    # Try JavaScript to find any element containing market cap text
                    market_cap_text = self.driver.execute_script("""
                        const elements = document.querySelectorAll('*');
                        for (const el of elements) {
                            const text = el.textContent.toLowerCase();
                            if (text.includes('market cap')) {
                                return el.textContent;
                            }
                        }
                        return null;
                    """)
                
                if not market_cap_text:
                    print("Could not find market cap with any method")
                    return None
                    
                # Extract just the value part if it contains "Market Cap:"
                if ':' in market_cap_text:
                    market_cap_text = market_cap_text.split(':')[-1].strip()
                
                market_cap_value = self.parse_market_cap(market_cap_text)
                print(f"Market cap: {market_cap_text} (${market_cap_value:,.2f})")
                
                if market_cap_value < 10_000:  # Skip very low market caps
                    print(f"Skipping due to low market cap: {market_cap_text}")
                    return None
                    
            except Exception as e:
                print(f"Could not verify market cap: {e}")
                return None

            # Wait a bit more for other elements to load
            time.sleep(2)

            try:
                # Get all the data we need in one go to minimize DOM queries
                title_element = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'h2[data-v-f82ffaa3]'))
                )
                ticker_element = title_element.find_element(By.CSS_SELECTOR, 'p[class*="text-gray-500"]')
                desc_elem = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'p[data-v-f82ffaa3][class*="text-[10px]"]'))
                )
                icon = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'img[src*="media.hypurr.fun"]'))
                )
                
                # Process the data
                full_title = title_element.text
                ticker_text = ticker_element.text
                ticker = ticker_text.strip('()') if ticker_text else None
                name = full_title.replace(ticker_text, '').strip()
                description = desc_elem.text
                icon_url = icon.get_attribute('src')
                
                if not ticker:
                    print("Could not find ticker")
                    return None
                    
                print(f"Found name: {name}")
                print(f"Found ticker: {ticker}")
                
                links = self.extract_links(description)
                print(f"Found links: {links}")
                print(f"Found icon: {icon_url}")
                
                # Look for streamId in network requests
                print("Looking for streamId...")
                self.stream_id = self.get_network_requests()
                if not self.stream_id:
                    # Try to find it in the page source as fallback
                    try:
                        page_source = self.driver.page_source
                        stream_match = re.search(r'AAAAAAcI[a-zA-Z0-9]+', page_source)
                        if stream_match:
                            self.stream_id = stream_match.group(0)
                    except:
                        pass
                
                print(f"StreamId: {self.stream_id}")
                
                launch_data = {
                    "id": ticker,
                    "streamId": self.stream_id,
                    "ticker": ticker,
                    "name": name,
                    "icon": icon_url,
                    "hypurr": url,
                    "links": links,
                    "market_cap": market_cap_value  # Add market cap to track
                }
                
                # Store the launch data
                self.launches_data.append(launch_data)
                self.market_caps[ticker] = market_cap_value
                
                return launch_data
                
            except Exception as e:
                print(f"Error extracting data: {e}")
                return None
            
        except TimeoutException as e:
            print(f"Timeout while waiting for page load: {str(e)}")
            return None
        except Exception as e:
            print(f"Error scraping {url}: {str(e)}")
            return None

    def update_launches_data(self):
        """Update launches-data.js with only the top 20 assets by market cap"""
        try:
            # Sort launches by market cap
            sorted_launches = sorted(
                self.launches_data,
                key=lambda x: x.get('market_cap', 0),
                reverse=True
            )
            
            # Take only top 20
            top_20_launches = sorted_launches[:20]
            
            # Remove market_cap field before saving
            for launch in top_20_launches:
                launch.pop('market_cap', None)
            
            data = {"tokens": top_20_launches}
            
            # Format the output JSON
            output_json = json.dumps(data, indent=4, ensure_ascii=False)
            # Clean up any trailing commas in the formatted output
            output_json = re.sub(r',(\s*[}\]])', r'\1', output_json)
            
            # Create directories if they don't exist, using path relative to workspace root
            os.makedirs('../public/js', exist_ok=True)
            
            # Write back to file, using path relative to workspace root
            with open('../public/js/launches-data.js', 'w', encoding='utf-8') as f:
                f.write('const launchesData = ' + output_json + ';')
            print(f"\nUpdated launches-data.js with top 20 assets by market cap")
            print(f"Total assets found: {len(self.launches_data)}")
            print(f"Top 20 market caps:")
            for i, launch in enumerate(top_20_launches, 1):
                ticker = launch['ticker']
                mcap = self.market_caps.get(ticker, 0)
                print(f"{i}. {ticker}: ${mcap:,.2f}")
                
        except Exception as e:
            print(f"Error updating launches data: {str(e)}")
            import traceback
            traceback.print_exc()

    def scrape_all_launches(self):
        print("\nNavigating to launches page...")
        self.driver.get('https://app.hypurr.fun/launches')
        self.wait_for_page_load()
        wait = WebDriverWait(self.driver, 15)  # Reduced timeout
        
        try:
            # Try to find the launch links directly
            print("\nLooking for launch links...")
            links = wait.until(
                EC.presence_of_all_elements_located(
                    (By.CSS_SELECTOR, 'a[data-v-2d151ead][data-v-0936fb31][href*="/launch/"]')
                )
            )
            
            if not links:
                print("Could not find any launch links")
                return
                
            print(f"\nFound {len(links)} launch links")
            
            # Extract all URLs
            urls = []
            for link in links:
                try:
                    href = link.get_attribute('href')
                    if href and '/launch/' in href and href not in urls:
                        urls.append(href)
                except Exception as e:
                    print(f"Error extracting URL from link: {e}")
            
            print(f"\nProcessing {len(urls)} unique launch URLs")
            
            for url in urls:
                print(f"\nScraping {url}")
                self.scrape_launch_page(url)
                time.sleep(0.5)  # Reduced delay between pages
            
            # After scraping all launches, update the file with top 20
            self.update_launches_data()
                
        except Exception as e:
            print(f"Error in scrape_all_launches: {str(e)}")

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
from playwright.sync_api import sync_playwright

def run_test(page):
    print("Navigating to page...")
    page.goto("http://localhost:4009")
    page.wait_for_timeout(2000)

    # Login
    print("Logging in...")
    page.fill('input[placeholder="Enter your username"]', os.environ.get('TEST_USERNAME', 'admin'))
    page.fill('input[placeholder="Enter your password"]', os.environ.get('TEST_PASSWORD', 'admin123'))
    page.click('button:has-text("Sign In")')
    page.wait_for_timeout(3000)

    print("Taking screenshot...")
    page.screenshot(path="sidebar_optim.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="./test-videos")
        page = context.new_page()
        try:
            run_test(page)
        finally:
            context.close()
            browser.close()

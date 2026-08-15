from playwright.sync_api import sync_playwright

url = "file:///C:/Users/neary/Projects/msk-quiz/msk-quiz.html"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.goto(url)
    page.wait_for_selector("#format-chips")
    page.screenshot(path="test_load_setup.png")
    print("format chips:", page.locator("#format-chips .chip").count())
    print("type chips:", page.locator("#type-chips .chip").count())
    print("pool summary:", page.locator("#pool-summary").inner_text())
    page.click("#nav-learn-btn")
    page.wait_for_timeout(300)
    page.screenshot(path="test_load_learn.png")
    print("learn cards:", page.locator(".learn-card").count())
    print("errors:", errors)
    browser.close()

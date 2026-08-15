from playwright.sync_api import sync_playwright

url = "file:///C:/Users/neary/Projects/msk-quiz/msk-quiz.html"
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 1000})
    page.on("console", lambda msg: errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
    page.goto(url)
    page.wait_for_selector("#format-chips")

    # --- Learn -> Test yourself bridge ---
    page.click("#nav-learn-btn")
    page.wait_for_timeout(200)
    # narrow to just Shoulder in learn mode (all start selected; deselect every other one)
    for label in ["All upper limb", "Elbow", "Wrist & hand", "All lower limb", "Hip", "Knee", "Ankle & foot", "Spine & back", "Torso"]:
        page.locator("#learn-region-chips .chip", has_text=label).click()
    page.wait_for_timeout(200)
    print("learn regions selected:", page.locator("#learn-count").inner_text())
    page.click("#learn-test-btn")
    page.wait_for_timeout(200)
    print("after bridge, quiz regions selected:", page.locator("#region-sel-count").inner_text())
    print("setup panel visible:", "hidden" not in (page.locator("#setup-panel").get_attribute("class") or ""))
    page.screenshot(path="test_bridge.png")

    # --- reset to all regions/types/formats, start session ---
    page.click('[data-action="regions-all"]')
    page.click('[data-action="types-all"]')
    page.click('[data-action="formats-all"]')
    page.click('[data-action="structure-all"]')
    page.wait_for_timeout(200)
    print("pool summary:", page.locator("#pool-summary").inner_text())
    page.click("#start-btn")
    page.wait_for_selector("#quiz-panel:not(.hidden)")

    seen_qtypes = set()
    seen_formats = set()
    want_qtypes = {"identify", "origin", "insertion", "nerve", "action", "locate", "attachment", "identify-structure"}
    want_formats = {"flashcard", "multiple-choice", "type-answer"}
    shots = {"locate": False, "flashcard_hint": False, "type-answer": False, "multiple-choice": False}

    progress_log = []
    stall_count = 0
    last_progress = None
    for i in range(250):
        if seen_qtypes >= want_qtypes and all(shots.values()):
            break
        tag = page.locator("#qtype-tag").inner_text().lower()
        cur_progress = page.locator("#progress-current").inner_text()
        progress_log.append(cur_progress + ":" + tag)
        seen_qtypes.add(tag)

        if cur_progress == last_progress:
            stall_count += 1
            if stall_count >= 5:
                dbg = page.evaluate("""() => ({
                    qIndex: window.__DEBUG_qIndex, queueLen: window.__DEBUG_queueLen,
                    item: window.__DEBUG_item, error: window.__DEBUG_error
                })""")
                print("STALLED. debug dump:", dbg)
                print("next-btn visible:", page.locator("#next-btn").is_visible())
                print("mc-area visible:", "hidden" not in (page.locator("#mc-area").get_attribute("class") or ""))
                print("flash-area visible:", "hidden" not in (page.locator("#flash-area").get_attribute("class") or ""))
                print("type-area visible:", "hidden" not in (page.locator("#type-area").get_attribute("class") or ""))
                break
        else:
            stall_count = 0
        last_progress = cur_progress

        flash_visible = "hidden" not in (page.locator("#flash-area").get_attribute("class") or "")
        mc_visible = "hidden" not in (page.locator("#mc-area").get_attribute("class") or "")
        type_visible = "hidden" not in (page.locator("#type-area").get_attribute("class") or "")

        if tag == "locate" and not shots["locate"]:
            hl_class = page.locator("#question-highlight").get_attribute("class") or ""
            print("locate: highlight hidden?", "hidden" in hl_class, "polygon count:", page.locator("#question-highlight polygon").count())
            page.screenshot(path="test_locate.png")
            shots["locate"] = True

        if flash_visible:
            seen_formats.add("flashcard")
            if not shots["flashcard_hint"]:
                page.fill("#flash-answer-input", "test guess")
                page.click("#hint-btn")
                page.wait_for_timeout(100)
                print("hint text:", page.locator("#hint-text").inner_text())
                page.screenshot(path="test_flashcard_hint.png")
                page.click("#reveal-btn")
                page.wait_for_timeout(100)
                page.screenshot(path="test_flashcard_revealed.png")
                shots["flashcard_hint"] = True
                page.click(".grade-btn.yes")
            else:
                page.click("#reveal-btn")
                page.wait_for_timeout(50)
                page.click(".grade-btn.yes")
        elif mc_visible:
            seen_formats.add("multiple-choice")
            if not shots["multiple-choice"]:
                page.screenshot(path="test_mc.png")
                shots["multiple-choice"] = True
            page.locator(".choice-btn").first.click()
        elif type_visible:
            seen_formats.add("type-answer")
            page.fill("#type-answer-input", "test")
            if not shots["type-answer"]:
                page.screenshot(path="test_type_answer.png")
                shots["type-answer"] = True
            page.click("#check-answer-btn")

        page.wait_for_timeout(60)
        if page.locator("#next-btn").is_visible():
            page.click("#next-btn")
        page.wait_for_timeout(60)

    print("progress_log:", progress_log)
    print("seen_qtypes:", seen_qtypes)
    print("missing qtypes:", want_qtypes - seen_qtypes)
    print("seen_formats:", seen_formats)
    print("missing formats:", want_formats - seen_formats)
    print("shots complete:", shots)
    print("errors:", errors)
    browser.close()

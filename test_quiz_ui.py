import time
from playwright.sync_api import sync_playwright

url = "file:///C:/Users/neary/Projects/msk-quiz/msk-quiz.html"
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))

    page.goto(url)
    page.wait_for_selector("#structure-chips")
    page.screenshot(path="test_1_setup.png")

    # turn on both structure question types
    chips = page.locator("#structure-chips .chip")
    print("structure chip count:", chips.count())
    for i in range(chips.count()):
        chips.nth(i).click()

    # turn off the 5 default muscle types so we land on structure questions reliably
    type_chips = page.locator("#type-chips .chip.on")
    for i in range(type_chips.count()):
        type_chips.nth(0).click()  # always click index 0 since the "on" list shrinks

    page.screenshot(path="test_2_structure_selected.png")
    print("pool summary:", page.locator("#pool-summary").inner_text())
    print("structure chips on:", page.locator("#structure-chips .chip.on").count(), "/", page.locator("#structure-chips .chip").count())

    page.click("#start-btn")
    page.wait_for_selector("#quiz-panel:not(.hidden)")

    found_attachment = False
    found_identify_structure = False
    tally = {}
    for i in range(60):
        tag = page.locator("#qtype-tag").inner_text()
        tally[tag] = tally.get(tag, 0) + 1
        img_area_hidden = "hidden" in (page.locator("#question-image-area").get_attribute("class") or "")
        print(f"q{i}: qtype={tag} image_hidden={img_area_hidden}")

        if tag == "ATTACHMENT" and not found_attachment:
            found_attachment = True
            page.screenshot(path="test_3_attachment.png")
            img_src = page.locator("#question-image").get_attribute("src")
            print("attachment image src:", img_src)
            page.fill("#type-answer-input", "test answer")
            page.click("#check-answer-btn")
            page.wait_for_timeout(200)
            page.screenshot(path="test_4_attachment_graded.png")

        if tag == "IDENTIFY-STRUCTURE" and not found_identify_structure:
            found_identify_structure = True
            page.screenshot(path="test_5_identify_structure.png")
            img_src = page.locator("#question-image").get_attribute("src")
            pin_hidden = "hidden" in (page.locator("#question-pin").get_attribute("class") or "")
            pin_style = page.locator("#question-pin").get_attribute("style")
            print("identify-structure image src:", img_src, "pin_hidden:", pin_hidden, "pin_style:", pin_style)
            first_choice = page.locator(".choice-btn").first
            first_choice.click()
            page.wait_for_timeout(200)
            page.screenshot(path="test_6_identify_structure_graded.png")

        if found_attachment and found_identify_structure:
            break

        next_btn = page.locator("#next-btn")
        if next_btn.is_visible():
            next_btn.click()
        else:
            # not yet graded (shouldn't happen for types we didn't handle above, e.g. plain identify/origin etc if any leaked in)
            page.locator("#type-giveup-btn").click() if page.locator("#type-giveup-btn").is_visible() else None
            page.wait_for_timeout(100)
            if page.locator("#next-btn").is_visible():
                page.locator("#next-btn").click()

    print("found_attachment:", found_attachment, "found_identify_structure:", found_identify_structure)
    print("tally:", tally)
    print("console_errors:", console_errors)
    browser.close()
